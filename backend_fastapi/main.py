from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import os
import mysql.connector
from mysql.connector import pooling

app = FastAPI(
    title="Pizzeria BOM API",
    description="Backend en FastAPI para gestion de Bill of Materials (BOM) e inventario de Pizzeria.",
    version="1.0.0"
)

# Configurar middleware de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuración de Pool de Conexiones de MySQL
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "J0hanny$")
DB_NAME = os.getenv("DB_NAME", "pizzeria_db")
DB_PORT = int(os.getenv("DB_PORT", "3306"))

try:
    db_pool = pooling.MySQLConnectionPool(
        pool_name="pizzeria_pool",
        pool_size=5,
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        port=DB_PORT
    )
except Exception as e:
    print(f"Alerta: No se pudo conectar al pool MySQL: {e}.")
    db_pool = None


def get_db():
    if not db_pool:
        raise HTTPException(
            status_code=500,
            detail="La conexion al servidor MySQL no esta configurada o no esta disponible."
        )
    conn = db_pool.get_connection()
    try:
        yield conn
    finally:
        conn.close()


# =======================================================
# MODELOS PYDANTIC para Validación de Datos
# =======================================================

class ArticuloResponse(BaseModel):
    id: int
    nombre: str
    tipo: str
    unidad_medida: str
    stock_actual: float
    stock_minimo: float
    precio_venta: Optional[float] = None

    class Config:
        from_attributes = True


class ProduccionRequest(BaseModel):
    semi_id: int = Field(..., description="ID del articulo SEMI_ELABORADO")
    cantidad: int = Field(..., gt=0, description="Cantidad a producir (debe ser mayor a 0)")


class VentaDetalleItem(BaseModel):
    plato_id: int = Field(..., description="ID del PLATO_FINAL a vender")
    cantidad: int = Field(..., gt=0, description="Cantidad a vender")


class VentaRequest(BaseModel):
    detalles: List[VentaDetalleItem] = Field(..., min_items=1, description="Detalle de platos a vender")


class ProduccionLogResponse(BaseModel):
    id: int
    semi_id: int
    semi_nombre: str
    cantidad: int
    fecha: datetime


class VentaDetalleResponse(BaseModel):
    id: int
    venta_id: int
    plato_id: int
    plato_nombre: str
    cantidad: int
    fecha: datetime
    total_venta: float


# =======================================================
# ENDPOINTS API - LOGICA DE NEGOCIO
# =======================================================

@app.get("/api/articulos/cocina", response_model=List[ArticuloResponse])
def get_articulos_cocina(conn=Depends(get_db)):
    """
    To-Do List de Producción (Cocina):
    Obtiene solo los articulos de tipo 'SEMI_ELABORADO' donde el stock_actual es menor al stock_minimo.
    """
    cursor = conn.cursor(dictionary=True)
    try:
        query = """
            SELECT id, nombre, tipo, unidad_medida, stock_actual, stock_minimo, precio_venta
            FROM articulo
            WHERE tipo = 'SEMI_ELABORADO' AND stock_actual < stock_minimo
        """
        cursor.execute(query)
        result = cursor.fetchall()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al buscar articulos de cocina: {str(e)}")
    finally:
        cursor.close()


@app.post("/api/produccion", status_code=status.HTTP_201_CREATED)
def registrar_produccion_cocina(payload: ProduccionRequest, conn=Depends(get_db)):
    """
    Registra la produccion llamando al procedimiento almacenado 'registrar_produccion'.
    Suma stock del semi-elaborado y descuenta sus ingredientes de materia prima de acuerdo al BOM.
    """
    cursor = conn.cursor()
    try:
        # Verificar que el articulo existe y es un SEMI_ELABORADO
        cursor_check = conn.cursor(dictionary=True)
        cursor_check.execute("SELECT tipo, nombre FROM articulo WHERE id = %s", (payload.semi_id,))
        articulo = cursor_check.fetchone()
        cursor_check.close()

        if not articulo:
            raise HTTPException(status_code=404, detail="Articulo semi-elaborado no encontrado")
        if articulo['tipo'] != 'SEMI_ELABORADO':
            raise HTTPException(status_code=400, detail="El articulo indicado no es de tipo SEMI_ELABORADO")

        # Ejecutar el Stored Procedure
        cursor.callproc("registrar_produccion", (payload.semi_id, payload.cantidad))
        conn.commit()

        # Obtener el estado actualizado del articulo para la respuesta interactiva
        cursor_updated = conn.cursor(dictionary=True)
        cursor_updated.execute(
            "SELECT id, nombre, stock_actual, stock_minimo FROM articulo WHERE id = %s", 
            (payload.semi_id,)
        )
        updated = cursor_updated.fetchone()
        cursor_updated.close()

        alerta_insuficiente = updated['stock_actual'] < updated['stock_minimo']

        return {
            "status": "success",
            "message": f"Produccion registrada con exito para '{articulo['nombre']}'.",
            "articulo": {
                "id": updated['id'],
                "nombre": updated['nombre'],
                "stock_actual": float(updated['stock_actual']),
                "stock_minimo": float(updated['stock_minimo']),
                "sigue_bajo_minimo": alerta_insuficiente
            }
        }
    except mysql.connector.Error as err:
        conn.rollback()
        raise HTTPException(status_code=400, detail=f"Error en base de datos: {err.msg if hasattr(err, 'msg') else str(err)}")
    except HTTPException as he:
        raise he
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Error interno del servidor: {str(e)}")
    finally:
        cursor.close()


@app.get("/api/articulos/materia_prima", response_model=List[ArticuloResponse])
def get_materia_prima(conn=Depends(get_db)):
    """
    Panel de Compras:
    Retorna la lista de todos los articulos de tipo 'MATERIA_PRIMA'.
    Nota: La logica de resaltar la fila en rojo si stock_actual < stock_minimo se resuelve en el frontend.
    """
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT id, nombre, tipo, unidad_medida, stock_actual, stock_minimo, precio_venta
            FROM articulo
            WHERE tipo = 'MATERIA_PRIMA'
        """)
        return cursor.fetchall()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()


@app.get("/api/articulos/plato_final", response_model=List[ArticuloResponse])
def get_platos_finales(conn=Depends(get_db)):
    """
    Punto de Venta:
    Retorna la lista de todos los articulos de tipo 'PLATO_FINAL' para su venta comercial.
    """
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT id, nombre, tipo, unidad_medida, stock_actual, stock_minimo, precio_venta
            FROM articulo
            WHERE tipo = 'PLATO_FINAL'
        """)
        return cursor.fetchall()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()


@app.get("/platos/finales", response_model=List[ArticuloResponse])
@app.get("/api/platos/finales", response_model=List[ArticuloResponse])
def get_platos_finales_simple(conn=Depends(get_db)):
    """
    Punto de Venta Simplificado:
    Retorna la lista de todos los platos finales.
    """
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT id, nombre, tipo, unidad_medida, stock_actual, stock_minimo, precio_venta
            FROM articulo
            WHERE tipo = 'PLATO_FINAL'
        """)
        return cursor.fetchall()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()


@app.post("/ventas", status_code=status.HTTP_201_CREATED)
@app.post("/api/ventas", status_code=status.HTTP_201_CREATED)
def registrar_venta(payload: VentaRequest, conn=Depends(get_db)):
    """
    Módulo de Ventas (Punto de Venta):
    Calcula el total, inserta la cabecera en 'venta' y luego llama a 'registrar_venta_detalle'
    por cada item vendido para realizar el descargo de ingredientes correspondientes al BOM del plato.
    Todo en una sola transaccion integrada.
    """
    cursor = conn.cursor()
    try:
        conn.start_transaction()

        # 1. Calcular el total de la venta consultando precios unitarios
        total_venta = 0.0
        detalles_procesados = []

        for item in payload.detalles:
            cursor_precio = conn.cursor(dictionary=True)
            cursor_precio.execute(
                "SELECT nombre, precio_venta, tipo FROM articulo WHERE id = %s", 
                (item.plato_id,)
            )
            art = cursor_precio.fetchone()
            cursor_precio.close()

            if not art:
                raise HTTPException(status_code=404, detail=f"Plato ID {item.plato_id} no encontrado")
            if art['tipo'] != 'PLATO_FINAL':
                raise HTTPException(status_code=400, detail=f"Articulo '{art['nombre']}' no es un PLATO_FINAL")
            
            precio_u = float(art['precio_venta']) if art['precio_venta'] is not None else 0.0
            subtotal = precio_u * item.cantidad
            total_venta += subtotal
            detalles_procesados.append((item.plato_id, item.cantidad, art['nombre'], subtotal))

        # 2. Insertar cabecera de la venta
        cursor.execute("INSERT INTO venta (total) VALUES (%s)", (total_venta,))
        venta_id = cursor.lastrowid

        # 3. Registrar detalles usando el procedimiento almacenado (SP)
        # El SP 'registrar_venta_detalle' registra el detalle y descuenta ingredientes de la tabla receta (BOM)
        for plato_id, cantidad, nombre, sub in detalles_procesados:
            cursor.callproc("registrar_venta_detalle", (venta_id, plato_id, cantidad))

        conn.commit()

        return {
            "status": "success",
            "message": f"Venta registrada exitosamente con ID {venta_id}",
            "venta_id": venta_id,
            "total_venta": total_venta,
            "items_vendidos": len(detalles_procesados)
        }
    except mysql.connector.Error as err:
        conn.rollback()
        raise HTTPException(status_code=400, detail=f"Error de base de datos en venta: {err.msg if hasattr(err, 'msg') else str(err)}")
    except HTTPException as he:
        conn.rollback()
        raise he
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Error al registrar venta: {str(e)}")
    finally:
        cursor.close()


@app.get("/api/dashboard/inventario", response_model=List[ArticuloResponse])
def get_inventario_completo(conn=Depends(get_db)):
    """
    Dashboard General:
    Visualiza el inventario completo (todos los articulos del catalogo).
    """
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT id, nombre, tipo, unidad_medida, stock_actual, stock_minimo, precio_venta
            FROM articulo
            ORDER BY tipo, nombre
        """)
        return cursor.fetchall()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()


@app.get("/api/dashboard/historial-produccion", response_model=List[ProduccionLogResponse])
def get_historial_produccion(conn=Depends(get_db)):
    """
    Dashboard General:
    Historial completo de produccion de Cocina.
    """
    cursor = conn.cursor(dictionary=True)
    try:
        # Hacemos join para mostrar el nombre del articulo semi-elaborado
        cursor.execute("""
            SELECT p.id, p.semi_id, a.nombre as semi_nombre, p.cantidad, p.fecha
            FROM produccion_log p
            JOIN articulo a ON p.semi_id = a.id
            ORDER BY p.fecha DESC
        """)
        return cursor.fetchall()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()


@app.get("/api/dashboard/historial-ventas", response_model=List[VentaDetalleResponse])
def get_historial_ventas(conn=Depends(get_db)):
    """
    Dashboard General:
    Historial completo de ventas (detalles integrados por fecha).
    """
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT vd.id, vd.venta_id, vd.plato_id, a.nombre as plato_nombre, 
                   vd.cantidad, v.fecha, v.total as total_venta
            FROM venta_detalle vd
            JOIN venta v ON vd.venta_id = v.id
            JOIN articulo a ON vd.plato_id = a.id
            ORDER BY v.fecha DESC, vd.id DESC
        """)
        return cursor.fetchall()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()


# Iniciar servidor local si se ejecuta directamente
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

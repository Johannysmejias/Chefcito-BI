from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import os
import mysql.connector
from mysql.connector import pooling
import requests
import time

app = FastAPI(
    title="Pizzeria BOM API",
    description="Backend en FastAPI para gestion de Bill of Materials (BOM) e inventario de Pizzeria.",
    version="1.0.0"
)

# Configurar middleware de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
    text_un_medida: Optional[str] = Field(None, alias="unidad_medida")
    unidad_medida: str
    stock_actual: float
    stock_minimo: float
    precio_venta: Optional[float] = None

    class Config:
        from_attributes = True


class ProduccionRequest(BaseModel):
    semi_id: int = Field(..., description="ID del articulo SEMI_ELABORADO")
    cantidad: int = Field(..., gt=0, description="Cantidad a producir (debe ser mayor a 0)")


class CompraInsumoRequest(BaseModel):
    materia_prima_id: int = Field(..., description="ID del articulo de MATERIA_PRIMA a abastecer")
    cantidad: float = Field(..., gt=0, description="Cantidad comprada (debe ser mayor a 0)")


class VentaDetailItem(BaseModel):
    plato_id: int = Field(..., description="ID del PLATO_FINAL a vender")
    cantidad: int = Field(..., gt=0, description="Cantidad a vender")


class VentaRequest(BaseModel):
    detalles: List[VentaDetailItem] = Field(..., min_items=1, description="Detalle de platos a vender")


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
# CONFIGURACION Y FUNCION DE ALERTA PARA MAKE.COM
# =======================================================

# Pegá acá la nueva URL de Webhook que te dio Make para Google Sheets
MAKE_WEBHOOK_URL = "https://hook.us2.make.com/m8ba1bumwke1dssw23ds5rm9lqwwisbi"

def verificar_y_notificar_quiebre_stock(articulo_id, nombre, tipo, stock_actual, stock_minimo):
    """
    Envía cualquier quiebre de stock al Webhook de Make.com.
    Se activa cuando el stock cae por debajo o igual al MÍNIMO.
    """
    # 1. Corrección de la lógica: ahora compara contra stock_minimo
    if stock_actual <= stock_minimo:
        payload = {
            "articulo_id": articulo_id,
            "nombre_articulo": nombre,
            "tipo": tipo,
            "stock_actual": stock_actual,
            "stock_minimo": stock_minimo
        }
        try:
            response = requests.post(MAKE_WEBHOOK_URL, json=payload, timeout=5)
            if response.status_code == 200:
                print(f"--> Alerta enviada a Make para: {nombre} ({tipo})")
            else:
                print(f"--> Error al conectar con Make: {response.status_code}")
            
            # 2. MAGIA: Pausa de 1 segundo para que Make no se sature al recibir alertas múltiples
            time.sleep(1)
            
        except Exception as e:
            print(f"--> No se pudo enviar la notificación a Make: {str(e)}")
# =======================================================
# ENDPOINTS API - LOGICA DE NEGOCIO
# =======================================================

@app.get("/api/articulos/cocina", response_model=List[ArticuloResponse])
def get_articulos_cocina(conn=Depends(get_db)):
    """
    To-Do List de Produccion (Cocina):
    Obtiene solo los articulos de tipo 'SEMI_ELABORADO' donde stock_actual < stock_minimo.
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
    Registra la producción e impacta el inventario:
    Suma el semi-elaborado y descuenta explícitamente sus componentes de materia prima.
    """
    cursor = conn.cursor()
    try:
        conn.start_transaction()

        # 1. Verificar que el artículo existe y es un SEMI_ELABORADO
        cursor_check = conn.cursor(dictionary=True)
        cursor_check.execute("SELECT tipo, nombre FROM articulo WHERE id = %s", (payload.semi_id,))
        articulo = cursor_check.fetchone()
        cursor_check.close()

        if not articulo:
            raise HTTPException(status_code=404, detail="Artículo semi-elaborado no encontrado.")
        if articulo['tipo'] != 'SEMI_ELABORADO':
            raise HTTPException(status_code=400, detail="El artículo indicado no es de tipo SEMI_ELABORADO.")

        # 2. Leer la receta (BOM) desde MySQL
        cursor_receta = conn.cursor(dictionary=True)
        
        # ⚠️ CRÍTICO: Verificá si tus columnas se llaman exactamente así en MySQL
        query_receta = "SELECT ingrediente_id, cantidad FROM receta WHERE producto_id = %s"
        
        cursor_receta.execute(query_receta, (payload.semi_id,))
        ingredientes = cursor_receta.fetchall()
        cursor_receta.close()

        # 🔍 PUNTO DE CONTROL 1: Si no hay ingredientes vinculados en la BD
        if not ingredientes:
            conn.rollback()
            raise HTTPException(
                status_code=422, 
                detail=f"Error MRP: No se encontraron ingredientes para '{articulo['nombre']}' (ID: {payload.semi_id}) en la tabla 'receta'. El stock no se modificó."
            )

        print(f"--> [BOM] Procesando {len(ingredientes)} ingredientes para fabricar {payload.cantidad} unidades de {articulo['nombre']}")

        # 3. Aplicar los descuentos de Materia Prima
        for ing in ingredientes:
            descuento_total = float(ing['cantidad']) * payload.cantidad
            
            # Imprime en la consola de Uvicorn qué está intentando hacer
            print(f"    Descargando ingrediente ID {ing['ingrediente_id']}: Cantidad {descuento_total}")
            
            cursor.execute(
                "UPDATE articulo SET stock_actual = stock_actual - %s WHERE id = %s",
                (descuento_total, ing['ingrediente_id'])
            )

        # 4. Sumar el stock al artículo semi-elaborado final
        cursor.execute(
            "UPDATE articulo SET stock_actual = stock_actual + %s WHERE id = %s",
            (payload.cantidad, payload.semi_id)
        )

        # 5. Insertar el movimiento en la bitácora histórica
        cursor.execute(
            "INSERT INTO produccion_log (semi_id, cantidad, fecha) VALUES (%s, %s, NOW())",
            (payload.semi_id, payload.cantidad)
        )

        conn.commit()
        # ====================================================
        # INICIO BLOQUE AUTOMATIZACIÓN MAKE.COM (VENTAS)
        # ====================================================
        cursor_alerta = conn.cursor(dictionary=True)
        # 3. Corrección en la base de datos: validamos contra stock_minimo
        cursor_alerta.execute("""
            SELECT id, nombre, tipo, stock_actual, stock_minimo 
            FROM articulo 
            WHERE tipo IN ('SEMI_ELABORADO', 'MATERIA_PRIMA') AND stock_actual <= stock_minimo
        """)
        items_en_rojo = cursor_alerta.fetchall()
        cursor_alerta.close()

        for item in items_en_rojo:
            verificar_y_notificar_quiebre_stock(
                articulo_id=item['id'],
                nombre=item['nombre'],
                tipo=item['tipo'],
                stock_actual=float(item['stock_actual']),
                stock_minimo=float(item['stock_minimo'])
            )

        # Obtener el estado final actualizado para retornar a Angular
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
            "message": f"Producción registrada con éxito. Stock actualizado e insumos descargados correctamente.",
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
    Panel de Compras: Retorna todas las materias primas.
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


@app.post("/api/compras", status_code=status.HTTP_200_OK)
def registrar_compra_insumos(payload: CompraInsumoRequest, conn=Depends(get_db)):
    """
    Panel de Compras:
    Suma la cantidad adquirida directamente al stock_actual de la materia prima.
    """
    cursor = conn.cursor()
    try:
        conn.start_transaction()

        # Verificar que el articulo existe y es MATERIA_PRIMA
        cursor_check = conn.cursor(dictionary=True)
        cursor_check.execute(
            "SELECT tipo, nombre FROM articulo WHERE id = %s", 
            (payload.materia_prima_id,)
        )
        articulo = cursor_check.fetchone()
        cursor_check.close()

        if not articulo:
            raise HTTPException(status_code=404, detail="Materia prima no encontrada en el catalogo.")
        if articulo['tipo'] != 'MATERIA_PRIMA':
            raise HTTPException(status_code=400, detail="El articulo seleccionado no es una MATERIA_PRIMA.")

        # Consulta SQL para incrementar el stock actual
        query_update = """
            UPDATE articulo 
            SET stock_actual = stock_actual + %s 
            WHERE id = %s
        """
        cursor.execute(query_update, (payload.cantidad, payload.materia_prima_id))
        conn.commit()

        # Obtener el stock actualizado para retornar la informacion al front
        cursor_updated = conn.cursor(dictionary=True)
        cursor_updated.execute(
            "SELECT id, nombre, stock_actual, stock_minimo FROM articulo WHERE id = %s", 
            (payload.materia_prima_id,)
        )
        updated = cursor_updated.fetchone()
        cursor_updated.close()

        return {
            "status": "success",
            "message": f"Abastecimiento registrado. Se sumaron {payload.cantidad} unidades a '{articulo['nombre']}'.",
            "articulo": {
                "id": updated['id'],
                "nombre": updated['nombre'],
                "stock_actual": float(updated['stock_actual']),
                "stock_minimo": float(updated['stock_minimo'])
            }
        }
    except mysql.connector.Error as err:
        conn.rollback()
        raise HTTPException(status_code=400, detail=f"Error de MySQL al actualizar stock: {str(err)}")
    except HTTPException as he:
        raise he
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Error interno del servidor: {str(e)}")
    finally:
        cursor.close()


@app.get("/api/articulos/plato_final", response_model=List[ArticuloResponse])
def get_platos_finales(conn=Depends(get_db)):
    """
    Punto de Venta: Retorna todos los platos finales.
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
    Modulo de Ventas con SQL explícito:
    Inserta la cabecera, los detalles y descuenta el stock de ingredientes (semi o prima) 
    usados en los platos vendidos. Notifica a Make si hay quiebre.
    """
    cursor = conn.cursor()
    try:
        conn.start_transaction()

        total_venta = 0.0
        detalles_procesados = []

        # 1. Calcular el total de la venta consultando precios unitarios
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
            # Manejo preventivo si la key se llama 'type' o 'tipo'
            if art.get('tipo', art.get('type')) != 'PLATO_FINAL':
                raise HTTPException(status_code=400, detail=f"Articulo '{art['nombre']}' no es un PLATO_FINAL")
            
            precio_u = float(art['precio_venta']) if art['precio_venta'] is not None else 0.0
            subtotal = precio_u * item.cantidad
            total_venta += subtotal
            detalles_procesados.append((item.plato_id, item.cantidad, art['nombre'], subtotal))

        # 2. Insertar cabecera de la venta
        # Asumimos que tu tabla venta tiene una columna fecha, la seteamos en NOW()
        cursor.execute("INSERT INTO venta (total) VALUES (%s)", (total_venta,))
        venta_id = cursor.lastrowid

        # 3. Registrar detalles y descontar stock por cada plato
        for plato_id, cantidad, nombre, sub in detalles_procesados:
            # Guardar el detalle
            cursor.execute(
                "INSERT INTO venta_detalle (venta_id, plato_id, cantidad) VALUES (%s, %s, %s)",
                (venta_id, plato_id, cantidad)
            )

            # Buscar la receta del plato para descontar su stock asociado (Semi-elaborados o Materia Prima)
            cursor_receta = conn.cursor(dictionary=True)
            cursor_receta.execute(
                "SELECT ingrediente_id, cantidad FROM receta WHERE producto_id = %s", 
                (plato_id,)
            )
            ingredientes_plato = cursor_receta.fetchall()
            cursor_receta.close()

            # Aplicar el UPDATE descontando del inventario
            for ing in ingredientes_plato:
                descuento_total = float(ing['cantidad']) * cantidad
                cursor.execute(
                    "UPDATE articulo SET stock_actual = stock_actual - %s WHERE id = %s",
                    (descuento_total, ing['ingrediente_id'])
                )

        conn.commit()
        # ====================================================
        # INICIO BLOQUE AUTOMATIZACIÓN MAKE.COM (VENTAS)
        # ====================================================
        cursor_alerta = conn.cursor(dictionary=True)
        # 3. Corrección en la base de datos: validamos contra stock_minimo
        cursor_alerta.execute("""
            SELECT id, nombre, tipo, stock_actual, stock_minimo 
            FROM articulo 
            WHERE tipo IN ('SEMI_ELABORADO', 'MATERIA_PRIMA') AND stock_actual <= stock_minimo
        """)
        items_en_rojo = cursor_alerta.fetchall()
        cursor_alerta.close()

        for item in items_en_rojo:
            verificar_y_notificar_quiebre_stock(
                articulo_id=item['id'],
                nombre=item['nombre'],
                tipo=item['tipo'],
                stock_actual=float(item['stock_actual']),
                stock_minimo=float(item['stock_minimo'])
            )
        # ====================================================
        # FIN BLOQUE AUTOMATIZACIÓN
        # ====================================================

        return {
            "status": "success",
            "message": f"Venta registrada exitosamente con ID {venta_id}. Insumos descontados.",
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
    Visualiza el inventario completo coordinando todos los articulos.
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
    Retorna el log completo de los movimientos de produccion en cocina.
    """
    cursor = conn.cursor(dictionary=True)
    try:
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
    Retorna la bitacora historica detallada de las ventas del negocio.
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


# El bloque de ejecución de Uvicorn se mantiene estrictamente al final del archivo
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import os
import mysql.connector
from mysql.connector import pooling
import requests

app = FastAPI(
    title="Pizzeria BOM API",
    description="Backend en FastAPI para gestión de BOM, Inventario y Reportes Z integrado con n8n.",
    version="2.0.0" # Subimos la versión por la migración a n8n
)

# Configurar middleware de CORS para conectar con Angular
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =======================================================
# CONFIGURACIÓN DE BASE DE DATOS Y CONEXIONES
# =======================================================
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
    """Generador de conexiones a la base de datos."""
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
# CONFIGURACIÓN DE WEBHOOKS (n8n)
# =======================================================
# Webhook 1: Para el resumen gerencial y de cocina
N8N_WEBHOOK_CIERRE = "https://johannys.app.n8n.cloud/webhook-test/cierre-turno"



# =======================================================
# MODELOS PYDANTIC (Estructuras de Datos)
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
    email_proveedor: Optional[str] = None # <-- Nombre corregido

    class Config:
        from_attributes = True

class FaltanteCompra(BaseModel):
    nombre: str
    stock_actual: float
    stock_minimo: float
    cantidad_a_comprar: float
    email_proveedor: Optional[str] 

class ProduccionRequest(BaseModel):
    semi_id: int = Field(..., description="ID del articulo SEMI_ELABORADO")
    cantidad: int = Field(..., gt=0, description="Cantidad a producir")

class CompraInsumoRequest(BaseModel):
    materia_prima_id: int = Field(..., description="ID del articulo de MATERIA_PRIMA")
    cantidad: float = Field(..., gt=0, description="Cantidad comprada")

class VentaDetailItem(BaseModel):
    plato_id: int = Field(..., description="ID del PLATO_FINAL a vender")
    cantidad: int = Field(..., gt=0, description="Cantidad a vender")

class VentaRequest(BaseModel):
    detalles: List[VentaDetailItem] = Field(..., min_items=1, description="Platos a vender")

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

class TurnoResponse(BaseModel):
    id: int
    fecha_apertura: datetime
    estado: str

# Modelos para empaquetar las alertas a n8n
class FaltanteCocina(BaseModel):
    nombre: str
    stock_actual: float
    stock_minimo: float
    unidad_medida: str 


class CierreTurnoResponse(BaseModel):
    turno_id: int
    fecha_cierre: str
    volumen_ventas: int
    total_facturado: float
    ticket_promedio: float
    plato_estrella: str
    alertas_cocina: List[FaltanteCocina]
    alertas_compras: List[FaltanteCompra]


# =======================================================
# MÓDULO DE TURNOS Y REPORTES Z (Insights e Integración)
# =======================================================

@app.get("/api/turnos/actual")
def get_turno_actual(conn=Depends(get_db)):
    """Verifica y devuelve si existe un turno abierto actualmente en la caja."""
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id, fecha_apertura, estado FROM turno WHERE estado = 'ABIERTO' LIMIT 1")
    turno = cursor.fetchone()
    cursor.close()
    if not turno:
        return {"mensaje": "No hay turnos abiertos", "turno": None}
    return {"mensaje": "Turno activo", "turno": turno}

@app.post("/api/turnos/abrir")
def abrir_turno(conn=Depends(get_db)):
    """Inicia un nuevo turno operativo, bloqueando si ya hay uno abierto."""
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id FROM turno WHERE estado = 'ABIERTO'")
    if cursor.fetchone():
        cursor.close()
        raise HTTPException(status_code=400, detail="Ya existe un turno abierto. Ciérralo primero.")
    
    cursor.execute("INSERT INTO turno (estado) VALUES ('ABIERTO')")
    conn.commit()
    nuevo_id = cursor.lastrowid
    cursor.close()
    return {"status": "success", "mensaje": "Turno abierto correctamente", "turno_id": nuevo_id}

@app.post("/api/turnos/cerrar", response_model=CierreTurnoResponse)
def cerrar_turno(conn=Depends(get_db)):
    """
    Cierra la caja, calcula KPIs (Total, Promedio, Plato más vendido),
    genera lista de producción, lista priorizada de compras y envía todo a n8n.
    """
    cursor = conn.cursor(dictionary=True)
    try:
        conn.start_transaction()

        # 1. Validar que exista un turno para cerrar
        cursor.execute("SELECT id FROM turno WHERE estado = 'ABIERTO' LIMIT 1")
        turno = cursor.fetchone()
        if not turno:
            raise HTTPException(status_code=400, detail="No hay ningún turno abierto.")
        turno_id = turno['id']

        # 2. Calcular KPIs Financieros (Motor SQL)
        cursor.execute("SELECT COUNT(id) as volumen, SUM(total) as facturado FROM venta WHERE turno_id = %s", (turno_id,))
        metricas = cursor.fetchone()
        volumen = metricas['volumen'] or 0
        facturado = float(metricas['facturado'] or 0.0)
        ticket_promedio = facturado / volumen if volumen > 0 else 0.0

        # Calcular el Plato Estrella
        cursor.execute("""
            SELECT a.nombre, SUM(vd.cantidad) as total_vendido
            FROM venta_detalle vd
            JOIN venta v ON vd.venta_id = v.id
            JOIN articulo a ON vd.plato_id = a.id
            WHERE v.turno_id = %s
            GROUP BY a.nombre
            ORDER BY total_vendido DESC LIMIT 1
        """, (turno_id,))
        estrella = cursor.fetchone()
        plato_estrella = estrella['nombre'] if estrella else "Ninguno (Sin ventas)"

        # 3. Cerrar el turno físicamente en la BD
        cursor.execute("UPDATE turno SET estado = 'CERRADO', fecha_cierre = NOW() WHERE id = %s", (turno_id,))

        # 4. Generar Alertas de Producción (Cocina)
        cursor.execute("""
            SELECT nombre, stock_actual, stock_minimo, unidad_medida 
            FROM articulo 
            WHERE tipo = 'SEMI_ELABORADO' AND stock_actual <= stock_minimo
        """)
        cocina = cursor.fetchall()
        alertas_cocina = [
            {
                "nombre": c['nombre'], 
                "stock_actual": float(c['stock_actual']), 
                "stock_minimo": float(c['stock_minimo']),
                "unidad_medida": c['unidad_medida'] # <-- La sumamos al diccionario
            } 
            for c in cocina
        ]

       # 5. Generar Alertas de Compras (Priorizadas por el nivel de faltante)
        cursor.execute("""
            SELECT nombre, stock_actual, stock_minimo, email_proveedor, 
                   (stock_minimo - stock_actual) AS prioridad_faltante
            FROM articulo 
            WHERE tipo = 'MATERIA_PRIMA' AND stock_actual <= stock_minimo
            ORDER BY prioridad_faltante DESC
        """)
        compras = cursor.fetchall()
        alertas_compras = []
        for c in compras:
            alertas_compras.append({
                "nombre": c['nombre'],
                "stock_actual": float(c['stock_actual']),
                "stock_minimo": float(c['stock_minimo']),
                "cantidad_a_comprar": float(c['prioridad_faltante']), 
                "email_proveedor": c['email_proveedor'] 
            })
        conn.commit()

        # 6. Empaquetar TODO en un solo envío
        fecha_cierre = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        payload_consolidado = {
            "turno_id": turno_id,
            "fecha_cierre": fecha_cierre,
            "volumen_ventas": volumen,
            "total_facturado": facturado,
            "ticket_promedio": round(ticket_promedio, 2),
            "plato_estrella": plato_estrella,
            "alertas_cocina": alertas_cocina,
            "alertas_compras": alertas_compras # <-- Ahora las compras viajan acá
        }

        try:
            # Hacemos un solo disparo al flujo principal
            requests.post(N8N_WEBHOOK_CIERRE, json=payload_consolidado, timeout=5)
            print("--> Reporte Z integral enviado a n8n exitosamente.")
        except Exception as e:
            print(f"--> Aviso: Turno cerrado localmente, pero falló conexión a n8n: {e}")

        return payload_consolidado

    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()

# =======================================================
# ENDPOINTS API - LÓGICA DE INVENTARIO Y MRP
# =======================================================

@app.get("/api/articulos/cocina", response_model=List[ArticuloResponse])
def get_articulos_cocina(conn=Depends(get_db)):
    """Devuelve los semi-elaborados que están por debajo del stock mínimo."""
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT id, nombre, tipo, unidad_medida, stock_actual, stock_minimo, precio_venta, email_proveedor
            FROM articulo
            WHERE tipo = 'SEMI_ELABORADO' AND stock_actual < stock_minimo
        """)
        return cursor.fetchall()
    finally:
        cursor.close()

@app.post("/api/produccion", status_code=status.HTTP_201_CREATED)
def registrar_produccion_cocina(payload: ProduccionRequest, conn=Depends(get_db)):
    """
    Registra la fabricación de un semi-elaborado.
    Descuenta automáticamente las materias primas necesarias leyendo la receta (BOM).
    """
    cursor = conn.cursor()
    try:
        conn.start_transaction()

        # Validar tipo de artículo
        cursor_check = conn.cursor(dictionary=True)
        cursor_check.execute("SELECT tipo, nombre FROM articulo WHERE id = %s", (payload.semi_id,))
        articulo = cursor_check.fetchone()
        cursor_check.close()

        if not articulo or articulo['tipo'] != 'SEMI_ELABORADO':
            raise HTTPException(status_code=400, detail="Artículo no encontrado o no es SEMI_ELABORADO.")

        # Obtener receta
        cursor_receta = conn.cursor(dictionary=True)
        cursor_receta.execute("SELECT ingrediente_id, cantidad FROM receta WHERE producto_id = %s", (payload.semi_id,))
        ingredientes = cursor_receta.fetchall()
        cursor_receta.close()

        if not ingredientes:
            raise HTTPException(status_code=422, detail="Error MRP: El artículo no tiene receta configurada.")

        # Descontar ingredientes y sumar producción
        for ing in ingredientes:
            descuento_total = float(ing['cantidad']) * payload.cantidad
            cursor.execute("UPDATE articulo SET stock_actual = stock_actual - %s WHERE id = %s", (descuento_total, ing['ingrediente_id']))

        cursor.execute("UPDATE articulo SET stock_actual = stock_actual + %s WHERE id = %s", (payload.cantidad, payload.semi_id))
        cursor.execute("INSERT INTO produccion_log (semi_id, cantidad, fecha) VALUES (%s, %s, NOW())", (payload.semi_id, payload.cantidad))

        conn.commit()
        return {"status": "success", "message": "Producción registrada y BOM procesado."}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()

@app.get("/api/articulos/materia_prima", response_model=List[ArticuloResponse])
def get_materia_prima(conn=Depends(get_db)):
    """Lista todas las materias primas del catálogo."""
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM articulo WHERE tipo = 'MATERIA_PRIMA'")
        return cursor.fetchall()
    finally:
        cursor.close()

@app.post("/api/compras", status_code=status.HTTP_200_OK)
def registrar_compra_insumos(payload: CompraInsumoRequest, conn=Depends(get_db)):
    """Ingresa stock nuevo de proveedores al sistema."""
    cursor = conn.cursor()
    try:
        conn.start_transaction()
        cursor.execute("UPDATE articulo SET stock_actual = stock_actual + %s WHERE id = %s AND tipo = 'MATERIA_PRIMA'", (payload.cantidad, payload.materia_prima_id))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=400, detail="Materia prima inválida o no encontrada.")
        conn.commit()
        return {"status": "success", "message": "Abastecimiento registrado correctamente."}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()

@app.get("/api/articulos/plato_final", response_model=List[ArticuloResponse])
@app.get("/api/platos/finales", response_model=List[ArticuloResponse])
def get_platos_finales(conn=Depends(get_db)):
    """Lista los productos finales disponibles para la venta."""
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM articulo WHERE tipo = 'PLATO_FINAL'")
        return cursor.fetchall()
    finally:
        cursor.close()

# =======================================================
# SISTEMA DE PUNTO DE VENTA (POS)
# =======================================================

@app.post("/api/ventas", status_code=status.HTTP_201_CREATED)
def registrar_venta(payload: VentaRequest, conn=Depends(get_db)):
    """
    Registra una venta. Valida si el turno está abierto, comprueba estrictamente 
    que haya stock de todos los ingredientes (BOM) y descuenta el inventario.
    """
    cursor = conn.cursor()
    try:
        conn.start_transaction()

        # 1. Validar Turno Abierto
        cursor_turno = conn.cursor(dictionary=True)
        cursor_turno.execute("SELECT id FROM turno WHERE estado = 'ABIERTO' LIMIT 1")
        turno_activo = cursor_turno.fetchone()
        cursor_turno.close()
        
        if not turno_activo:
            raise HTTPException(status_code=400, detail="Debes abrir un turno en la caja antes de registrar ventas.")
        turno_id = turno_activo['id']

        total_venta = 0.0
        detalles_procesados = []

        # 2. Preparar el carrito
        for item in payload.detalles:
            cursor_precio = conn.cursor(dictionary=True)
            cursor_precio.execute("SELECT nombre, precio_venta, tipo FROM articulo WHERE id = %s", (item.plato_id,))
            art = cursor_precio.fetchone()
            cursor_precio.close()

            if not art or art['tipo'] != 'PLATO_FINAL':
                raise HTTPException(status_code=400, detail="Artículo inválido para la venta.")
            
            subtotal = float(art['precio_venta']) * item.cantidad
            total_venta += subtotal
            detalles_procesados.append((item.plato_id, item.cantidad, art['nombre'], subtotal))

        # 3. Candado de Seguridad (Validación estricta de stock)
        insumos_requeridos = {} 
        for plato_id, cantidad_pedida, nombre_plato, _ in detalles_procesados:
            cursor_receta = conn.cursor(dictionary=True)
            cursor_receta.execute("""
                SELECT r.ingrediente_id, r.cantidad, a.nombre, a.stock_actual 
                FROM receta r JOIN articulo a ON r.ingrediente_id = a.id 
                WHERE r.producto_id = %s
            """, (plato_id,))
            ingredientes_plato = cursor_receta.fetchall()
            cursor_receta.close()

            if not ingredientes_plato:
                raise HTTPException(status_code=400, detail=f"El plato '{nombre_plato}' no tiene receta.")

            for ing in ingredientes_plato:
                id_ing = ing['ingrediente_id']
                cant_necesaria = float(ing['cantidad']) * cantidad_pedida
                if id_ing in insumos_requeridos:
                    insumos_requeridos[id_ing]['cantidad_total'] += cant_necesaria
                else:
                    insumos_requeridos[id_ing] = {'nombre': ing['nombre'], 'cantidad_total': cant_necesaria, 'stock_actual': float(ing['stock_actual'])}

        for id_ing, datos in insumos_requeridos.items():
            if datos['stock_actual'] < datos['cantidad_total']:
                faltante = datos['cantidad_total'] - datos['stock_actual']
                raise HTTPException(status_code=400, detail=f"Stock insuficiente. Faltan {faltante:.2f} de '{datos['nombre']}'.")

        # 4. Registrar Venta y Descontar Stock (Vinculado al turno_id)
        cursor.execute("INSERT INTO venta (total, turno_id) VALUES (%s, %s)", (total_venta, turno_id))
        venta_id = cursor.lastrowid
        
        for plato_id, cantidad, _, _ in detalles_procesados:
            cursor.execute("INSERT INTO venta_detalle (venta_id, plato_id, cantidad) VALUES (%s, %s, %s)", (venta_id, plato_id, cantidad))
            cursor_receta = conn.cursor(dictionary=True)
            cursor_receta.execute("SELECT ingrediente_id, cantidad FROM receta WHERE producto_id = %s", (plato_id,))
            for ing in cursor_receta.fetchall():
                descuento = float(ing['cantidad']) * cantidad
                cursor.execute("UPDATE articulo SET stock_actual = stock_actual - %s WHERE id = %s", (descuento, ing['ingrediente_id']))
            cursor_receta.close()

        conn.commit()
        return {"status": "success", "venta_id": venta_id, "total_venta": total_venta}

    except HTTPException as he:
        conn.rollback() 
        raise he
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()

# =======================================================
# DASHBOARD Y MÉTRICAS
# =======================================================

@app.get("/api/dashboard/inventario", response_model=List[ArticuloResponse])
def get_inventario_completo(conn=Depends(get_db)):
    """Vista general del inventario para el administrador."""
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM articulo ORDER BY tipo, nombre")
        return cursor.fetchall()
    finally:
        cursor.close()

@app.get("/api/dashboard/historial-produccion", response_model=List[ProduccionLogResponse])
def get_historial_produccion(conn=Depends(get_db)):
    """Registro de todo lo fabricado en la cocina."""
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT p.id, p.semi_id, a.nombre as semi_nombre, p.cantidad, p.fecha
            FROM produccion_log p JOIN articulo a ON p.semi_id = a.id
            ORDER BY p.fecha DESC
        """)
        return cursor.fetchall()
    finally:
        cursor.close()

@app.get("/api/dashboard/historial-ventas", response_model=List[VentaDetalleResponse])
def get_historial_ventas(conn=Depends(get_db)):
    """Registro de todos los tickets emitidos."""
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
    finally:
        cursor.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
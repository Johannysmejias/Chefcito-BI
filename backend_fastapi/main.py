from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, date, timedelta
import os
import mysql.connector
from mysql.connector import pooling
import requests
from pymongo import MongoClient
import certifi

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
# 2. MongoDB (Tiempo Real - Visión YOLO)
# =======================================================
# 
# Reemplazá por la URL real que te da MongoDB Atlas (usuario y contraseña reales)
MONGO_URI = "mongodb+srv://DAguilar:Diego2012hola@cluster0.tmrqgit.mongodb.net/?appName=Cluster0" 

try:
    # certifi.where() evita el error de SSL en Windows.
    # serverSelectionTimeoutMS hace que Python no se cuelgue si no hay internet.
    mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000, tlsCAFile=certifi.where())

    # CORRECCIÓN 1: base y colección EXACTAS que usa el detector.
    db_mongo = mongo_client["RestauranteDB"]        # ← antes (en el 1º bloque) decía "RestauranteDA"
    coleccion_camara = db_mongo["EstadoMesas"]      # ← antes decía "estado_mesas" (no existía → siempre verde)

    # Test rápido de conexión
    mongo_client.admin.command('ping')
    print("¡Conectado exitosamente a MongoDB en la nube!")

except Exception as e:
    print(f"Alerta Crítica: No se pudo conectar a MongoDB en la nube: {e}")
    mongo_client = None

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
    modalidad: str = Field('take_away', pattern=r'^(salon|take_away|delivery)$', description="Solo aplica a /api/ventas (venta directa sin mesa)")

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

class MesaLayout(BaseModel):
    id_mesa: int
    etiqueta_visible: str
    pos_x: float
    pos_y: float
    activa: bool

class CuentaItemResponse(BaseModel):
    plato_id: int
    plato_nombre: str
    cantidad: int
    precio_unitario: float
    subtotal: float

class CuentaResponse(BaseModel):
    venta_id: int
    mesa_id: int
    estado: str
    total: float
    items: List[CuentaItemResponse]

class TurnoReporte(BaseModel):
    turno_id: int
    fecha_apertura: datetime
    fecha_cierre: Optional[datetime] = None
    estado: str
    mesas_ocupadas: int
    volumen_ventas: int
    cantidad_platos_vendidos: int
    total_facturado: float
    ticket_promedio: float
    plato_estrella: str

class ModalidadReporte(BaseModel):
    modalidad: str
    volumen_ventas: int
    total_facturado: float
    porcentaje_del_total: float

class ResumenActualResponse(BaseModel):
    mesas_activas: int
    mesas_ocupadas: int
    porcentaje_ocupacion: float
    ultimo_turno: Optional[TurnoReporte] = None

# 2. Ruta para ENVIAR las mesas guardadas cuando Angular carga la página
@app.get("/api/mesas")
def obtener_mesas(conn=Depends(get_db)):
    """Devuelve las mesas estáticas al cargar la página por primera vez."""
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id_mesa, etiqueta_visible, pos_x, pos_y, activa FROM mesas_layout")
    mesas = cursor.fetchall()
    cursor.close()
    return mesas

@app.get("/api/mesas/estado-vivo")
def obtener_estado_vivo_mesas(conn=Depends(get_db)):
    """
    MOTOR DE FUSIÓN:
    Cruza la distribución (MySQL: mesas_layout) con el estado en vivo (MongoDB: EstadoMesas).
    """
    cursor = conn.cursor(dictionary=True)

    # 1. Traemos el mapa de mesas desde MySQL
    cursor.execute("SELECT id_mesa, etiqueta_visible, pos_x, pos_y, activa FROM mesas_layout")
    mesas_mysql = cursor.fetchall()
    cursor.close()

    mesas_consolidadas = []

    for mesa in mesas_mysql:
        id_mysql = mesa["id_mesa"]
        esta_ocupada = False

       
        if mongo_client:
            try:
                # No hace falta ordenar: hay un único documento por mesa_id (upsert).
                registro = coleccion_camara.find_one({"mesa_id": id_mysql})
                if registro and registro.get("estado") == "OCUPADA":
                    esta_ocupada = True
            except Exception as e:
                print(f"Error consultando MongoDB para mesa {id_mysql}: {e}")

        # 4. Mapeamos al estado que espera el CSS de Angular (interfaz MesaLayout.estado_actual)
        if esta_ocupada:
            mesa["estado_actual"] = "no_atendida"  # ROJO (ocupada físicamente)
        else:
            mesa["estado_actual"] = "libre"        # VERDE (libre físicamente)

        mesas_consolidadas.append(mesa)

    return mesas_consolidadas

# 3. Ruta para RECIBIR y GUARDAR el plano completo
@app.post("/api/mesas/guardar-layout")
def guardar_distribucion(mesas: List[MesaLayout], conn=Depends(get_db)):
    """Guarda las coordenadas X/Y provenientes del frontend en Angular."""
    cursor = conn.cursor()
    try:
        conn.start_transaction()
        for mesa in mesas:
            if mesa.id_mesa < 0:
                # CASO A: Mesa Nueva creada con el botón del Front (ID temporal negativo)
                # Dejamos que MySQL le asigne su ID auto-incremental definitivo
                cursor.execute("""
                    INSERT INTO mesas_layout (etiqueta_visible, pos_x, pos_y, activa)
                    VALUES (%s, %s, %s, %s)
                """, (mesa.etiqueta_visible, mesa.pos_x, mesa.pos_y, mesa.activa))
            else:
                # CASO B: Mesa con ID positivo (Lista inicial o ya guardada previamente)
                # Si no existe en la BD se inserta; si ya existe, se actualiza (UPSERT)
                cursor.execute("""
                    INSERT INTO mesas_layout (id_mesa, etiqueta_visible, pos_x, pos_y, activa)
                    VALUES (%s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                        etiqueta_visible = VALUES(etiqueta_visible),
                        pos_x = VALUES(pos_x),
                        pos_y = VALUES(pos_y),
                        activa = VALUES(activa)
                """, (mesa.id_mesa, mesa.etiqueta_visible, mesa.pos_x, mesa.pos_y, mesa.activa))

        conn.commit()
        print(f"¡Se procesaron y guardaron {len(mesas)} mesas en MySQL exitosamente!")
        return {"mensaje": "Distribución guardada correctamente"}

    except Exception as e:
        conn.rollback()
        print(f"Error crítico guardando distribución: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
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

        # 1b. Bloquear el cierre si quedan mesas con cuenta abierta sin cobrar: si se cierran de
        # todos modos, esa plata queda huérfana (el turno cerrado ya no vuelve a sumarla en ningún reporte).
        cursor.execute("""
            SELECT m.etiqueta_visible, v.total
            FROM venta v JOIN mesas_layout m ON v.mesa_id = m.id_mesa
            WHERE v.turno_id = %s AND v.estado = 'ABIERTA'
        """, (turno_id,))
        cuentas_pendientes = cursor.fetchall()
        if cuentas_pendientes:
            mesas_pendientes = ", ".join(c['etiqueta_visible'] for c in cuentas_pendientes)
            raise HTTPException(
                status_code=400,
                detail=f"No se puede cerrar el turno: hay mesas con cuenta abierta sin cobrar ({mesas_pendientes})."
            )

        # 2. Calcular KPIs Financieros (Motor SQL)
        cursor.execute("SELECT COUNT(id) as volumen, SUM(total) as facturado FROM venta WHERE turno_id = %s AND estado = 'COBRADA'", (turno_id,))
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
            WHERE v.turno_id = %s AND v.estado = 'COBRADA'
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

        # 4. Registrar Venta y Descontar Stock (Vinculado al turno_id). Venta directa sin mesa: take away o delivery.
        cursor.execute("INSERT INTO venta (total, turno_id, modalidad) VALUES (%s, %s, %s)", (total_venta, turno_id, payload.modalidad))
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
# CUENTAS ABIERTAS POR MESA (ventas en curso, salón)
# =======================================================

def _armar_cuenta(cursor, venta_id: int) -> dict:
    """Reconstruye el estado completo de una cuenta (cabecera + items) para devolver al frontend."""
    cursor.execute("SELECT id, mesa_id, estado, total FROM venta WHERE id = %s", (venta_id,))
    venta = cursor.fetchone()
    if not venta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada.")

    cursor.execute("""
        SELECT vd.plato_id, a.nombre as plato_nombre, vd.cantidad, a.precio_venta
        FROM venta_detalle vd JOIN articulo a ON vd.plato_id = a.id
        WHERE vd.venta_id = %s
        ORDER BY vd.id
    """, (venta_id,))
    items = []
    for row in cursor.fetchall():
        precio_unitario = float(row['precio_venta'] or 0)
        items.append({
            "plato_id": row['plato_id'],
            "plato_nombre": row['plato_nombre'],
            "cantidad": row['cantidad'],
            "precio_unitario": precio_unitario,
            "subtotal": round(precio_unitario * row['cantidad'], 2)
        })

    return {
        "venta_id": venta['id'],
        "mesa_id": venta['mesa_id'],
        "estado": venta['estado'],
        "total": float(venta['total']),
        "items": items
    }

@app.get("/api/cuentas/abiertas")
def listar_cuentas_abiertas(conn=Depends(get_db)):
    """Lista las mesas que en este momento tienen una cuenta abierta (pedido en curso)."""
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT v.id as venta_id, v.mesa_id, m.etiqueta_visible, v.total
            FROM venta v JOIN mesas_layout m ON v.mesa_id = m.id_mesa
            WHERE v.estado = 'ABIERTA'
        """)
        return cursor.fetchall()
    finally:
        cursor.close()

@app.get("/api/cuentas/{venta_id}", response_model=CuentaResponse)
def obtener_cuenta(venta_id: int, conn=Depends(get_db)):
    """Devuelve el detalle completo (items + total) de una cuenta."""
    cursor = conn.cursor(dictionary=True)
    try:
        return _armar_cuenta(cursor, venta_id)
    finally:
        cursor.close()

@app.post("/api/mesas/{mesa_id}/cuenta", response_model=CuentaResponse)
def abrir_o_recuperar_cuenta(mesa_id: int, conn=Depends(get_db)):
    """Abre una cuenta nueva para la mesa, o devuelve la que ya estaba abierta (idempotente)."""
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id FROM turno WHERE estado = 'ABIERTO' LIMIT 1")
        turno = cursor.fetchone()
        if not turno:
            raise HTTPException(status_code=400, detail="Debes abrir un turno en la caja antes de tomar pedidos.")

        cursor.execute("SELECT id_mesa FROM mesas_layout WHERE id_mesa = %s", (mesa_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="La mesa indicada no existe.")

        cursor.execute("SELECT id FROM venta WHERE mesa_id = %s AND estado = 'ABIERTA' LIMIT 1", (mesa_id,))
        existente = cursor.fetchone()
        if existente:
            venta_id = existente['id']
        else:
            cursor.execute(
                "INSERT INTO venta (turno_id, mesa_id, estado, total) VALUES (%s, %s, 'ABIERTA', 0)",
                (turno['id'], mesa_id)
            )
            conn.commit()
            venta_id = cursor.lastrowid

        return _armar_cuenta(cursor, venta_id)
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()

@app.post("/api/cuentas/{venta_id}/items", response_model=CuentaResponse)
def agregar_items_cuenta(venta_id: int, payload: VentaRequest, conn=Depends(get_db)):
    """
    Agrega una nueva ronda de platos a una cuenta abierta: valida stock (BOM) y lo
    descuenta de inmediato, igual que una venta normal, pero sin cerrar la cuenta.
    """
    cursor = conn.cursor(dictionary=True)
    try:
        conn.start_transaction()

        cursor.execute("SELECT id, estado FROM venta WHERE id = %s", (venta_id,))
        venta = cursor.fetchone()
        if not venta:
            raise HTTPException(status_code=404, detail="Cuenta no encontrada.")
        if venta['estado'] != 'ABIERTA':
            raise HTTPException(status_code=400, detail="Esta cuenta ya fue cobrada y no admite más pedidos.")

        total_agregado = 0.0
        detalles_procesados = []

        for item in payload.detalles:
            cursor.execute("SELECT nombre, precio_venta, tipo FROM articulo WHERE id = %s", (item.plato_id,))
            art = cursor.fetchone()
            if not art or art['tipo'] != 'PLATO_FINAL':
                raise HTTPException(status_code=400, detail="Artículo inválido para la venta.")

            subtotal = float(art['precio_venta']) * item.cantidad
            total_agregado += subtotal
            detalles_procesados.append((item.plato_id, item.cantidad, art['nombre']))

        # Candado de seguridad: validar stock de ingredientes de toda la ronda antes de descontar nada
        insumos_requeridos = {}
        for plato_id, cantidad_pedida, nombre_plato in detalles_procesados:
            cursor.execute("""
                SELECT r.ingrediente_id, r.cantidad, a.nombre, a.stock_actual
                FROM receta r JOIN articulo a ON r.ingrediente_id = a.id
                WHERE r.producto_id = %s
            """, (plato_id,))
            ingredientes_plato = cursor.fetchall()
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

        for plato_id, cantidad, _ in detalles_procesados:
            cursor.execute("INSERT INTO venta_detalle (venta_id, plato_id, cantidad) VALUES (%s, %s, %s)", (venta_id, plato_id, cantidad))
            cursor.execute("SELECT ingrediente_id, cantidad FROM receta WHERE producto_id = %s", (plato_id,))
            for ing in cursor.fetchall():
                descuento = float(ing['cantidad']) * cantidad
                cursor.execute("UPDATE articulo SET stock_actual = stock_actual - %s WHERE id = %s", (descuento, ing['ingrediente_id']))

        cursor.execute("UPDATE venta SET total = total + %s WHERE id = %s", (total_agregado, venta_id))

        conn.commit()
        return _armar_cuenta(cursor, venta_id)

    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()

@app.post("/api/cuentas/{venta_id}/cerrar", response_model=CuentaResponse)
def cerrar_cuenta(venta_id: int, conn=Depends(get_db)):
    """Cobra y cierra la cuenta de una mesa, dejándola libre para una nueva visita."""
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id, estado FROM venta WHERE id = %s", (venta_id,))
        venta = cursor.fetchone()
        if not venta:
            raise HTTPException(status_code=404, detail="Cuenta no encontrada.")
        if venta['estado'] != 'ABIERTA':
            raise HTTPException(status_code=400, detail="Esta cuenta ya estaba cobrada.")

        cursor.execute("SELECT COUNT(*) as n FROM venta_detalle WHERE venta_id = %s", (venta_id,))
        if cursor.fetchone()['n'] == 0:
            raise HTTPException(status_code=400, detail="No se puede cobrar una cuenta sin pedidos.")

        cursor.execute("UPDATE venta SET estado = 'COBRADA' WHERE id = %s", (venta_id,))
        conn.commit()
        return _armar_cuenta(cursor, venta_id)

    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()

# =======================================================
# REPORTES GERENCIALES (ocupación, KPIs por turno, modalidad)
# =======================================================

def _calcular_metricas_turno(cursor, turno_row: dict) -> dict:
    """Calcula los KPIs de negocio de un turno a partir de sus ventas COBRADAS."""
    turno_id = turno_row['id']

    cursor.execute("""
        SELECT COUNT(DISTINCT mesa_id) as mesas_ocupadas, COUNT(*) as volumen_ventas,
               COALESCE(SUM(total), 0) as total_facturado
        FROM venta WHERE turno_id = %s AND estado = 'COBRADA'
    """, (turno_id,))
    metricas = cursor.fetchone()
    volumen = metricas['volumen_ventas'] or 0
    facturado = float(metricas['total_facturado'] or 0)
    ticket_promedio = round(facturado / volumen, 2) if volumen > 0 else 0.0

    cursor.execute("""
        SELECT a.nombre, SUM(vd.cantidad) as cantidad
        FROM venta_detalle vd
        JOIN venta v ON vd.venta_id = v.id
        JOIN articulo a ON vd.plato_id = a.id
        WHERE v.turno_id = %s AND v.estado = 'COBRADA'
        GROUP BY a.nombre
        ORDER BY cantidad DESC
    """, (turno_id,))
    platos = cursor.fetchall()
    cantidad_platos_vendidos = sum(p['cantidad'] for p in platos) if platos else 0
    plato_estrella = platos[0]['nombre'] if platos else "Ninguno (Sin ventas)"

    return {
        "turno_id": turno_id,
        "fecha_apertura": turno_row['fecha_apertura'],
        "fecha_cierre": turno_row['fecha_cierre'],
        "estado": turno_row['estado'],
        "mesas_ocupadas": metricas['mesas_ocupadas'] or 0,
        "volumen_ventas": volumen,
        "cantidad_platos_vendidos": cantidad_platos_vendidos,
        "total_facturado": facturado,
        "ticket_promedio": ticket_promedio,
        "plato_estrella": plato_estrella
    }

def _contar_mesas_ocupadas(cursor) -> int:
    """
    Cuenta mesas activas ocupadas en este momento, combinando dos señales (una mesa
    cuenta una sola vez aunque coincidan ambas):
    - Cámara (MongoDB): mismo criterio que pinta de rojo una mesa en el Plano de Mesas.
    - Cuenta abierta: la mesa ya tiene un pedido cargado, aunque la cámara no la detecte (o esté caída).
    """
    cursor.execute("SELECT id_mesa FROM mesas_layout WHERE activa = 1")
    mesas_activas = {m['id_mesa'] for m in cursor.fetchall()}

    ocupadas = set()

    if mongo_client:
        for id_mesa in mesas_activas:
            try:
                registro = coleccion_camara.find_one({"mesa_id": id_mesa})
                if registro and registro.get("estado") == "OCUPADA":
                    ocupadas.add(id_mesa)
            except Exception as e:
                print(f"Error consultando MongoDB para mesa {id_mesa}: {e}")

    cursor.execute("SELECT DISTINCT mesa_id FROM venta WHERE estado = 'ABIERTA' AND mesa_id IS NOT NULL")
    for row in cursor.fetchall():
        if row['mesa_id'] in mesas_activas:
            ocupadas.add(row['mesa_id'])

    return len(ocupadas)

@app.get("/api/reportes/resumen-actual", response_model=ResumenActualResponse)
def resumen_actual(conn=Depends(get_db)):
    """Snapshot en vivo: ocupación actual de mesas (cámara + cuenta abierta) + KPIs del último turno."""
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT COUNT(*) as n FROM mesas_layout WHERE activa = 1")
        mesas_activas = cursor.fetchone()['n']

        mesas_ocupadas = _contar_mesas_ocupadas(cursor)

        porcentaje = round((mesas_ocupadas / mesas_activas * 100), 1) if mesas_activas > 0 else 0.0

        cursor.execute("SELECT id, fecha_apertura, fecha_cierre, estado FROM turno ORDER BY fecha_apertura DESC LIMIT 1")
        ultimo = cursor.fetchone()
        ultimo_turno = _calcular_metricas_turno(cursor, ultimo) if ultimo else None

        return {
            "mesas_activas": mesas_activas,
            "mesas_ocupadas": mesas_ocupadas,
            "porcentaje_ocupacion": porcentaje,
            "ultimo_turno": ultimo_turno
        }
    finally:
        cursor.close()

@app.get("/api/reportes/turnos", response_model=List[TurnoReporte])
def reporte_turnos(desde: Optional[str] = None, hasta: Optional[str] = None, conn=Depends(get_db)):
    """Historial de turnos con sus KPIs, filtrable por rango de fechas (sobre fecha_apertura)."""
    cursor = conn.cursor(dictionary=True)
    try:
        fecha_desde = desde or (date.today() - timedelta(days=30)).isoformat()
        fecha_hasta = hasta or date.today().isoformat()

        cursor.execute("""
            SELECT id, fecha_apertura, fecha_cierre, estado
            FROM turno
            WHERE DATE(fecha_apertura) BETWEEN %s AND %s
            ORDER BY fecha_apertura DESC
        """, (fecha_desde, fecha_hasta))
        turnos = cursor.fetchall()

        return [_calcular_metricas_turno(cursor, t) for t in turnos]
    finally:
        cursor.close()

@app.get("/api/reportes/modalidades", response_model=List[ModalidadReporte])
def reporte_modalidades(desde: Optional[str] = None, hasta: Optional[str] = None, conn=Depends(get_db)):
    """
    Desglose de ventas COBRADAS por modalidad (salón / take away / delivery) en el rango de fechas.
    Sirve para decidir dónde conviene invertir (ej. delivery propio vs. mostrador).
    """
    cursor = conn.cursor(dictionary=True)
    try:
        fecha_desde = desde or (date.today() - timedelta(days=30)).isoformat()
        fecha_hasta = hasta or date.today().isoformat()

        cursor.execute("""
            SELECT modalidad, COUNT(*) as volumen_ventas, COALESCE(SUM(total), 0) as total_facturado
            FROM venta
            WHERE estado = 'COBRADA' AND DATE(fecha) BETWEEN %s AND %s
            GROUP BY modalidad
        """, (fecha_desde, fecha_hasta))
        filas = cursor.fetchall()

        total_global = sum(float(f['total_facturado']) for f in filas)
        resultado = []
        for f in filas:
            facturado = float(f['total_facturado'])
            resultado.append({
                "modalidad": f['modalidad'],
                "volumen_ventas": f['volumen_ventas'],
                "total_facturado": facturado,
                "porcentaje_del_total": round((facturado / total_global * 100), 1) if total_global > 0 else 0.0
            })
        return resultado
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
            WHERE v.estado = 'COBRADA'
            ORDER BY v.fecha DESC, vd.id DESC
        """)
        return cursor.fetchall()
    finally:
        cursor.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
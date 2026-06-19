import os
import csv
import time
from datetime import datetime, timedelta
import cv2
import numpy as np
import torch
from ultralytics import YOLO
from pymongo import MongoClient

# ========================= CONEXIÓN MONGODB ATLAS =========================

MONGO_URI = "mongodb+srv://DAguilar:Diego2012hola@cluster0.tmrqgit.mongodb.net/?appName=Cluster0"
cliente_mongo = MongoClient(MONGO_URI)
db = cliente_mongo["RestauranteDB"]
coleccion_historial = db["HistorialMesas"]      # Snapshots globales (para gráfica de ocupación en el tiempo)
coleccion_eventos   = db["EventosOcupacion"]    # Un documento por sesión de mesa (para gráficas de frecuencia/duración)
coleccion_estado    = db["EstadoMesas"]         # Estado actual por mesa (para plano web en tiempo real)
print("Conectado a MongoDB Atlas.")

# PARÁMETROS DEL SISTEMA
# Identificador del turno. Cambiarlo antes de procesar cada video nuevo.
# Aparece en todos los documentos de MongoDB → permite comparar turnos en Power BI.
# 2026-06-01_Manana" / "2026-06-01_Tarde
TURNO = "2026-06-01_Manana"

RUTA_VIDEO    = "C:/Users/Clementine/Desktop/Proyecto/maintestTN.mp4" #"C:/Users/Clementine/Desktop/Proyecto/maintest.mp4"
NOMBRE_MODELO = 'yolov8s.pt'
CONF_UMBRAL   = 0.2     # Confianza minima Yolo
IMGSZ         = 1536    # 1280 #960 #640 == Resolución de inferencia

# =========== SAHI: inferencia por tiles para personas lejanas/pequeñas =========== / No sé usarla bien
# Divide el frame en tiles solapados → más píxeles por persona lejana.
# Activar si con imgsz=1280 todavía hay mesas del fondo sin detectar.
# Requiere: pip install sahi
USAR_SAHI       = False   # Cambiar a True si es necesario activarlo // Ahora lo dejo en false porque parece detectar mejor. 
SAHI_TILE_SIZE  = 640     # Tamaño de cada tile (px). 512–640 es lo habitual.
SAHI_OVERLAP    = 0.2     # Solapamiento entre tiles (0.0–0.5). Más solapamiento = más lento pero sin bordes perdidos.

ARCHIVO_LOG     = "C:/Users/Clementine/Desktop/Proyecto/registro_ocupacion.csv"
INTERVALO_CSV   = 15   # seg: cada cuánto escribir permanencia en CSV mientras la mesa sigue ocupada
INTERVALO_MONGO = 5    # seg: cada cuánto insertar un snapshot en MongoDB

# ============================= PARÁMETROS CRÍTICOS ANTI-FALSOS POSITIVOS =============================
# TIEMPO_CONFIRMACION: Esto es para evitar los falsos positivios cuando entre una persona en el poligono de la mesa
TIEMPO_CONFIRMACION = 4.0   # 3–6s

# TIEMPO_TOLERANCIA: Evitamos que la mesa se vacie al momento en que no detecta una persona.
TIEMPO_TOLERANCIA = 8.0     # recomendado: 6–12 s

# COLORES PARA LAS MESAS
COLOR_LIBRE     = (0, 255,   0)   # Verde
COLOR_OCUPADA   = (0,   0, 255)   # Rojo
COLOR_CONFIRMAR = (0, 165, 255)   # Naranja: Confirmacion
COLOR_PERSONA   = (255, 200,  0)  # Amarillo


# ============================= DEFINICIÓN DE MESAS =============================
def _mesa(id_, nombre, pts):
    return {
        'id': id_,
        'nombre': nombre,
        # reshape(-1,1,2) es el formato requerido por cv2.polylines y pointPolygonTest
        'poligono': np.array(pts, np.int32).reshape(-1, 1, 2),

        # --- Variables de la máquina de estados ---
        'estado': 'LIBRE',               # Estado confirmado actual: 'LIBRE' | 'OCUPADA'
        'tiempo_candidatura': None,      # Momento en que inició la detección actual (para timer de confirmación)
        'tiempo_ocupacion_inicio': None, # Momento en que se confirmó la ocupación
        'tiempo_ultima_deteccion': 0.0,  # Último instante donde se detectó a alguien (para timer de tolerancia)

        # Control de escritura CSV
        'ultimo_reporte_csv': 0.0,
    }

MESAS_DEFINIDAS = [
    _mesa( 1, 'Mesa 1',  [[580,487],[865,505],[846,686],[514,654]]),
    _mesa( 2, 'Mesa 2',  [[646,326],[874,331],[874,455],[631,440]]),
    _mesa( 3, 'Mesa 3',  [[697,224],[871,228],[871,302],[675,294]]),
    _mesa( 4, 'Mesa 4',  [[728,169],[867,171],[867,208],[715,202]]),
    _mesa( 5, 'Mesa 5',  [[744,118],[843,118],[842,157],[732,154]]),
    _mesa( 6, 'Mesa 6',  [[390,629],[466,486],[253,449],[170,564]]),
    _mesa( 7, 'Mesa 7',  [[509,446],[554,335],[374,324],[310,418]]),
    _mesa( 8, 'Mesa 8',  [[452,230],[611,229],[582,293],[413,282]]),
    _mesa( 9, 'Mesa 9',  [[514,169],[649,168],[628,213],[485,211]]),
    _mesa(10, 'Mesa 10', [[110,353],[212,371],[104,507],  [6,458]]),
    _mesa(11, 'Mesa 11', [[276,226],[371,231],[312,304],[206,296]]),
    _mesa(12, 'Mesa 12', [[367,156],[468,157],[409,213],[302,207]]),
    _mesa(13, 'Mesa 13', [[428, 89],[482, 87],[484,135],[429,135]]),
    _mesa(14, 'Mesa 14', [[532,113],[642,106],[647, 69],[547, 74]]),
    _mesa(15, 'Mesa 15', [[676, 86],[735, 84],[733,132],[685,132]]),
    _mesa(16, 'Mesa 16', [[548,154],[659,157],[669,134],[563,128]]),
]


# ============================= INICIALIZACIÓN =============================
if not os.path.exists(ARCHIVO_LOG):
    with open(ARCHIVO_LOG, 'w', newline='', encoding='utf-8') as f:
        csv.writer(f).writerow(["Fecha", "Hora_Real", "Mesa", "Estado", "Permanencia_Segundos"])

print("Cargando modelo YOLO...")
modelo = YOLO(NOMBRE_MODELO)
device = 'cuda' if torch.cuda.is_available() else 'cpu'
print(f"Inferencia en: {device.upper()}")

# 
# Inicialización de SAHI // Solo si activamos SAHI Arriba en los parámetros.
#

sahi_predictor = None
if USAR_SAHI:
    from sahi import AutoDetectionModel
    from sahi.predict import get_sliced_prediction
    sahi_predictor = AutoDetectionModel.from_pretrained(
        model_type='yolov8',
        model_path=NOMBRE_MODELO,
        confidence_threshold=CONF_UMBRAL,
        device=device,
    )
    print("SAHI activado.")

cap = cv2.VideoCapture(RUTA_VIDEO)
if not cap.isOpened():
    raise RuntimeError("No se pudo abrir el video.")

ultimo_mongo = time.time()


def log_csv(nombre, estado, permanencia, fecha, hora):
    with open(ARCHIVO_LOG, 'a', newline='', encoding='utf-8') as f:
        csv.writer(f).writerow([fecha, hora, nombre, estado, f"{permanencia:.1f}"])


# ============================= BUCLE PRINCIPAL =============================

while cap.isOpened():
    ok, frame = cap.read()
    if not ok:
        break

    # t: posición actual del video en segundos. Se usa para medir duraciones,
    # NO time.time(), para que funcione correctamente con videos grabados.
    t     = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0
    ahora = datetime.now()
    fecha = ahora.strftime("%Y-%m-%d")
    hora  = ahora.strftime("%H:%M:%S")
 
    # =========== Inferencia YOLO: solo clase 0 (personas) ===========
    resultados = modelo(frame, classes=[0], conf=CONF_UMBRAL, imgsz=IMGSZ,
                        device=device, verbose=False)

    # Punto de referencia por persona: centroide del bounding box
    puntos_personas = []
    if resultados[0].boxes:
        for box in resultados[0].boxes.xyxy.cpu().numpy():
            x1, y1, x2, y2 = box.astype(int)
            cx = (x1 + x2) // 2
            cy = (y1 + y2) // 2   # ← cambiar a y2 para detectar los pies 
            puntos_personas.append((cx, cy))
            cv2.rectangle(frame, (x1, y1), (x2, y2), COLOR_PERSONA, 2)
            cv2.circle(frame, (cx, cy), 5, COLOR_PERSONA, -1)

    conteos = {'Libres': 0, 'Ocupadas': 0}

    for mesa in MESAS_DEFINIDAS:

        # ---- Detección: ¿hay algún centroide dentro del polígono este frame? ----
        hay_persona = any(
            cv2.pointPolygonTest(mesa['poligono'], (float(cx), float(cy)), False) >= 0
            for cx, cy in puntos_personas
        )
        if hay_persona:
            mesa['tiempo_ultima_deteccion'] = t

        # ================================================================
        # MÁQUINA DE ESTADOS
        #
        #  LIBRE ──(detección continua ≥ TIEMPO_CONFIRMACION s)──► OCUPADA
        #         ◄──(ausencia ≥ TIEMPO_TOLERANCIA s)─────────────
        #
        # La clave está en el estado LIBRE: no se pasa a OCUPADA en el primer
        # frame positivo. Se requiere que la detección sea sostenida durante
        # TIEMPO_CONFIRMACION segundos. Un transeúnte activa el polígono por
        # menos de 1 s, así que nunca llega a confirmar la ocupación.
        # ================================================================
        if mesa['estado'] == 'LIBRE':

            if hay_persona:
                if mesa['tiempo_candidatura'] is None:
                    # Primera detección: arrancar el temporizador de confirmación
                    mesa['tiempo_candidatura'] = t
                elif (t - mesa['tiempo_candidatura']) >= TIEMPO_CONFIRMACION:
                    # Detección sostenida suficiente : OCUPADA
                    mesa['estado'] = 'OCUPADA'
                    mesa['tiempo_ocupacion_inicio'] = mesa['tiempo_candidatura']
                    mesa['ultimo_reporte_csv'] = mesa['tiempo_candidatura']
                    log_csv(mesa['nombre'], "OCUPADA", 0.0, fecha, hora)
                    try:
                        coleccion_estado.update_one(
                            {"mesa_id": mesa['id']},
                            {"$set": {"mesa_id": mesa['id'], "mesa_nombre": mesa['nombre'],
                                      "estado": "OCUPADA", "actualizado": datetime.now()}},
                            upsert=True
                        )
                    except Exception as e:
                        print(f"Error EstadoMesas (ocupada): {e}")
            else:
                
                mesa['tiempo_candidatura'] = None

        elif mesa['estado'] == 'OCUPADA':

            if hay_persona:
                # Mesa sigue ocupada; escribir permanencia al CSV según el intervalo configurado
                permanencia = t - mesa['tiempo_ocupacion_inicio']
                if (t - mesa['ultimo_reporte_csv']) >= INTERVALO_CSV:
                    log_csv(mesa['nombre'], "SIGUE OCUPADA", permanencia, fecha, hora)
                    mesa['ultimo_reporte_csv'] = t
            else:
                # Sin persona: esperar TIEMPO_TOLERANCIA antes de liberar
                # (cubre oclusiones momentáneas y pérdidas de detección de YOLO)
                if (t - mesa['tiempo_ultima_deteccion']) >= TIEMPO_TOLERANCIA:
                    permanencia = t - mesa['tiempo_ocupacion_inicio']
                    log_csv(mesa['nombre'], "LIBERADA", permanencia, fecha, hora)

                    # Insertar evento de sesión completa en MongoDB.
                    # Este es el documento más valioso para Power BI:
                    # permite contar veces ocupada, sumar duración, comparar turnos.
                    ts_inicio = datetime.now() - timedelta(seconds=permanencia)
                    try:
                        coleccion_eventos.insert_one({
                            "turno":             TURNO,
                            "fecha":             fecha,
                            "mesa_id":           mesa['id'],
                            "mesa_nombre":       mesa['nombre'],
                            "inicio":            ts_inicio,
                            "fin":               datetime.now(),
                            "duracion_segundos": round(permanencia),
                            "duracion_minutos":  round(permanencia / 60, 2),
                        })
                    except Exception as e:
                        print(f"Error evento MongoDB: {e}")

                    mesa['estado']               = 'LIBRE'
                    mesa['tiempo_candidatura']   = None
                    mesa['tiempo_ocupacion_inicio'] = None
                    mesa['ultimo_reporte_csv']   = 0.0
                    try:
                        coleccion_estado.update_one(
                            {"mesa_id": mesa['id']},
                            {"$set": {"mesa_id": mesa['id'], "mesa_nombre": mesa['nombre'],
                                      "estado": "LIBRE", "actualizado": datetime.now()}},
                            upsert=True
                        )
                    except Exception as e:
                        print(f"Error EstadoMesas (libre): {e}")

        # ---- Visualización del polígono y etiqueta ----
        if mesa['estado'] == 'OCUPADA':
            color   = COLOR_OCUPADA
            etiqueta = "OCUPADA"
            conteos['Ocupadas'] += 1
        elif mesa['tiempo_candidatura'] is not None:
            # Estado intermedio: muestra el progreso del timer de confirmación
            prog    = t - mesa['tiempo_candidatura']
            color   = COLOR_CONFIRMAR
            etiqueta = f"CONF {prog:.1f}s/{TIEMPO_CONFIRMACION:.0f}s"
            conteos['Libres'] += 1
        else:
            color   = COLOR_LIBRE
            etiqueta = "LIBRE"
            conteos['Libres'] += 1

        cv2.polylines(frame, [mesa['poligono']], True, color, 1)
        y_txt = max(15, int(np.min(mesa['poligono'][:, :, 1])) - 8)
        x_txt = int(np.min(mesa['poligono'][:, :, 0]))
        cv2.putText(frame, f"{mesa['nombre']}: {etiqueta}",
                    (x_txt, y_txt), cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1)

    # ==========================================
    # SNAPSHOT A MONGODB (cada INTERVALO_MONGO segundos)
    # Registra el estado global del restaurante para histórico y dashboard web.
    # ==========================================
    t_real = time.time()
    if (t_real - ultimo_mongo) >= INTERVALO_MONGO:
        total = len(MESAS_DEFINIDAS)
        registro = {
            "turno":                TURNO,
            "fecha_hora":           datetime.now(),
            "mesas_libres":         conteos['Libres'],
            "mesas_ocupadas":       conteos['Ocupadas'],
            "porcentaje_ocupacion": round(conteos['Ocupadas'] / total * 100, 1),
        }
        try:
            coleccion_historial.insert_one(registro)
            print(f"MongoDB — ocupadas: {conteos['Ocupadas']}/{len(MESAS_DEFINIDAS)}")
        except Exception as e:
            print(f"Error MongoDB: {e}")
        ultimo_mongo = t_real

    # HUD
    cv2.rectangle(frame, (0, 0), (310, 85), (0, 0, 0), -1)
    cv2.putText(frame, f"LIBRES:   {conteos['Libres']}",
                (10, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.5, COLOR_LIBRE,   1)
    cv2.putText(frame, f"OCUPADAS: {conteos['Ocupadas']}",
                (10, 68), cv2.FONT_HERSHEY_SIMPLEX, 0.5, COLOR_OCUPADA, 1)

    cv2.imshow("Auditoria de Mesas", cv2.resize(frame, (1280, 720)))
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()

# Al terminar el video, liberar forzosamente todas las mesas que quedaron OCUPADA. Sin esto, esas sesiones nunca se insertarían en EventosOcupacion.
ahora_cierre = datetime.now()
fecha_cierre = ahora_cierre.strftime("%Y-%m-%d")
hora_cierre  = ahora_cierre.strftime("%H:%M:%S")

for mesa in MESAS_DEFINIDAS:
    if mesa['estado'] == 'OCUPADA' and mesa['tiempo_ocupacion_inicio'] is not None:
        permanencia = t - mesa['tiempo_ocupacion_inicio']
        log_csv(mesa['nombre'], "LIBERADA (fin video)", permanencia, fecha_cierre, hora_cierre)
        try:
            coleccion_eventos.insert_one({
                "turno":             TURNO,
                "fecha":             fecha_cierre,
                "mesa_id":           mesa['id'],
                "mesa_nombre":       mesa['nombre'],
                "inicio":            ahora_cierre - timedelta(seconds=permanencia),
                "fin":               ahora_cierre,
                "duracion_segundos": round(permanencia),
                "duracion_minutos":  round(permanencia / 60, 2),
            })
            print(f"Evento final: {mesa['nombre']} — {round(permanencia)}s")
            try:
                coleccion_estado.update_one(
                    {"mesa_id": mesa['id']},
                    {"$set": {"mesa_id": mesa['id'], "mesa_nombre": mesa['nombre'],
                              "estado": "LIBRE", "actualizado": ahora_cierre}},
                    upsert=True
                )
            except Exception as e2:
                print(f"Error EstadoMesas (cierre): {e2}")
        except Exception as e:
            print(f"Error evento final {mesa['nombre']}: {e}")

print(f"Procesamiento completo. Log: {ARCHIVO_LOG}")

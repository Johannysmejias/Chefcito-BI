import time
from datetime import datetime
import cv2
import numpy as np
import torch
from ultralytics import YOLO
from pymongo import MongoClient

# --- CONEXIÓN A MONGODB ---
MONGO_URI = "mongodb+srv://DAguilar:Diego2012hola@cluster0.tmrqgit.mongodb.net/?appName=Cluster0"

print("Conectando a MongoDB...")
cliente_mongo = MongoClient(MONGO_URI)
db = cliente_mongo["RestauranteDB"]           
# CAMBIAMOS EL NOMBRE DE LA COLECCIÓN PARA QUE NO SE MEZCLE CON LA BASURA ANTERIOR
coleccion_sesiones = db["SesionesMesas"]    
print("¡Conectado a la nube con éxito!")

# ==========================================
# CONFIGURACIÓN DEL SISTEMA
# ==========================================
RUTA_VIDEO = "C:/Users/Clementine/Desktop/Proyecto/maintest.mp4"
NOMBRE_MODELO = 'yolov8m.pt'
UMBRAL_CONFIANZA = 0.25
UMBRAL_IMGSZ = 960      
TIEMPO_TOLERANCIA_VACIO = 5    # Segundos sin detecciones para liberar mesa

# Definición de Mesas (Limpiamos las variables que no servían)
MESAS_DEFINIDAS = [
    {'nombre': 'Mesa 1', 'poligono': np.array([[[580, 487]], [[865, 505]], [[846, 686]], [[514, 654]]], np.int32), 'estado_anterior': 'LIBRE', 'inicio_video_seg': None, 'inicio_reloj': None, 'ultima_deteccion_seg': 0.0},
    {'nombre': 'Mesa 2', 'poligono': np.array([[[646, 326]], [[874, 331]], [[874, 455]], [[631, 440]]], np.int32), 'estado_anterior': 'LIBRE', 'inicio_video_seg': None, 'inicio_reloj': None, 'ultima_deteccion_seg': 0.0},
    {'nombre': 'Mesa 3', 'poligono': np.array([[[697, 224]], [[871, 228]], [[871, 302]], [[675, 294]]], np.int32), 'estado_anterior': 'LIBRE', 'inicio_video_seg': None, 'inicio_reloj': None, 'ultima_deteccion_seg': 0.0},
    {'nombre': 'Mesa 4', 'poligono': np.array([[[728, 169]], [[867, 171]], [[867, 208]], [[715, 202]]], np.int32), 'estado_anterior': 'LIBRE', 'inicio_video_seg': None, 'inicio_reloj': None, 'ultima_deteccion_seg': 0.0},
    {'nombre': 'Mesa 5', 'poligono': np.array([[[744, 118]], [[843, 118]], [[842, 157]], [[732, 154]]], np.int32), 'estado_anterior': 'LIBRE', 'inicio_video_seg': None, 'inicio_reloj': None, 'ultima_deteccion_seg': 0.0},
    {'nombre': 'Mesa 6', 'poligono': np.array([[[390, 629]], [[466, 486]], [[253, 449]], [[170, 564]]], np.int32), 'estado_anterior': 'LIBRE', 'inicio_video_seg': None, 'inicio_reloj': None, 'ultima_deteccion_seg': 0.0},
    {'nombre': 'Mesa 7', 'poligono': np.array([[[509, 446]], [[554, 335]], [[374, 324]], [[310, 418]]], np.int32), 'estado_anterior': 'LIBRE', 'inicio_video_seg': None, 'inicio_reloj': None, 'ultima_deteccion_seg': 0.0},
    {'nombre': 'Mesa 8', 'poligono': np.array([[[452, 230]], [[611, 229]], [[582, 293]], [[413, 282]]], np.int32), 'estado_anterior': 'LIBRE', 'inicio_video_seg': None, 'inicio_reloj': None, 'ultima_deteccion_seg': 0.0},
    {'nombre': 'Mesa 9', 'poligono': np.array([[[514, 169]], [[649, 168]], [[628, 213]], [[485, 211]]], np.int32), 'estado_anterior': 'LIBRE', 'inicio_video_seg': None, 'inicio_reloj': None, 'ultima_deteccion_seg': 0.0},
    {'nombre': 'Mesa 10', 'poligono': np.array([[[110, 353]], [[212, 371]], [[104, 507]], [[6, 458]]], np.int32), 'estado_anterior': 'LIBRE', 'inicio_video_seg': None, 'inicio_reloj': None, 'ultima_deteccion_seg': 0.0},
    {'nombre': 'Mesa 11', 'poligono': np.array([[[276, 226]], [[371, 231]], [[312, 304]], [[206, 296]]], np.int32), 'estado_anterior': 'LIBRE', 'inicio_video_seg': None, 'inicio_reloj': None, 'ultima_deteccion_seg': 0.0},
    {'nombre': 'Mesa 12', 'poligono': np.array([[[367, 156]], [[468, 157]], [[409, 213]], [[302, 207]]], np.int32), 'estado_anterior': 'LIBRE', 'inicio_video_seg': None, 'inicio_reloj': None, 'ultima_deteccion_seg': 0.0},
    {'nombre': 'Mesa 13', 'poligono': np.array([[[428, 89]], [[482, 87]], [[484, 135]], [[429, 135]]], np.int32), 'estado_anterior': 'LIBRE', 'inicio_video_seg': None, 'inicio_reloj': None, 'ultima_deteccion_seg': 0.0},
    {'nombre': 'Mesa 14', 'poligono': np.array([[[532, 113]], [[642, 106]], [[647, 69]], [[547, 74]]], np.int32), 'estado_anterior': 'LIBRE', 'inicio_video_seg': None, 'inicio_reloj': None, 'ultima_deteccion_seg': 0.0},
    {'nombre': 'Mesa 15', 'poligono': np.array([[[676, 86]], [[735, 84]], [[733, 132]], [[685, 132]]], np.int32), 'estado_anterior': 'LIBRE', 'inicio_video_seg': None, 'inicio_reloj': None, 'ultima_deteccion_seg': 0.0},
    {'nombre': 'Mesa 16', 'poligono': np.array([[[548, 154]], [[659, 157]], [[669, 134]], [[563, 128]]], np.int32), 'estado_anterior': 'LIBRE', 'inicio_video_seg': None, 'inicio_reloj': None, 'ultima_deteccion_seg': 0.0},
]

COLOR_LIBRE = (0, 255, 0)     
COLOR_OCUPADA = (0, 0, 255)   
COLOR_PERSONA = (255, 200, 0) 

print("Cargando modelo...")
modelo = YOLO(NOMBRE_MODELO)
device = 'cuda' if torch.cuda.is_available() else 'cpu'

cap = cv2.VideoCapture(RUTA_VIDEO)
if not cap.isOpened():
    print("Error al abrir el video.")
    exit()

# BUCLE PRINCIPAL
while cap.isOpened():
    exito, frame = cap.read()
    if not exito:
        break

    tiempo_video_segundos = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0

    resultados = modelo(frame, classes=[0], conf=UMBRAL_CONFIANZA, imgsz=UMBRAL_IMGSZ, device=device, verbose=False)
    centroides_personas = []

    if resultados[0].boxes:
        boxes = resultados[0].boxes.xyxy.cpu().numpy()
        for box in boxes:
            x1, y1, x2, y2 = box.astype(int)
            cx = int((x1 + x2) / 2)
            cy = int((y1 + y2) / 2)
            centroides_personas.append((cx, cy))
            cv2.rectangle(frame, (x1, y1), (x2, y2), COLOR_PERSONA, 2)
            cv2.circle(frame, (cx, cy), 5, COLOR_PERSONA, -1)

    conteos = {'Libres': 0, 'Ocupadas': 0}

    # Analizar cada mesa
    for mesa in MESAS_DEFINIDAS:
        deteccion_positiva = False
        
        for cx, cy in centroides_personas:
            if cv2.pointPolygonTest(mesa['poligono'], (cx, cy), False) >= 0:
                deteccion_positiva = True
                break

        # Lógica de tolerancia (Debounce)
        if deteccion_positiva:
            mesa['ultima_deteccion_seg'] = tiempo_video_segundos
            estado_actual = "OCUPADA"
        else:
            if mesa['estado_anterior'] == "OCUPADA":
                tiempo_sin_ver = tiempo_video_segundos - mesa['ultima_deteccion_seg']
                if tiempo_sin_ver >= TIEMPO_TOLERANCIA_VACIO:
                    estado_actual = "LIBRE"
                else:
                    estado_actual = "OCUPADA" 
            else:
                estado_actual = "LIBRE"

        # ==========================================================
        # EL NUEVO MOTOR DE EVENTOS PARA MONGODB / POWER BI
        # ==========================================================
        
        # CASO A: Alguien se acaba de sentar
        if estado_actual == "OCUPADA" and mesa['estado_anterior'] == "LIBRE":
            mesa['inicio_video_seg'] = tiempo_video_segundos
            mesa['inicio_reloj'] = datetime.now()
        
        # CASO B: Alguien se acaba de levantar (LA MESA SE LIBERÓ)
        elif estado_actual == "LIBRE" and mesa['estado_anterior'] == "OCUPADA":
            if mesa['inicio_video_seg'] is not None:
                duracion_segundos = tiempo_video_segundos - mesa['inicio_video_seg']
                hora_fin_reloj = datetime.now()

                # Solo guardamos si estuvieron más de 5 segundos (filtra errores de IA pasando caminando)
                if duracion_segundos > 5:
                    documento_sesion = {
                        "mesa": mesa['nombre'],
                        "fecha": mesa['inicio_reloj'].strftime("%Y-%m-%d"),
                        "hora_inicio": mesa['inicio_reloj'].strftime("%H:%M:%S"),
                        "hora_fin": hora_fin_reloj.strftime("%H:%M:%S"),
                        "duracion_segundos": round(duracion_segundos, 2),
                        "duracion_minutos": round(duracion_segundos / 60, 2)
                    }
                    
                    try:
                        coleccion_sesiones.insert_one(documento_sesion)
                        print(f"📊 SESIÓN GUARDADA: {mesa['nombre']} - Duración: {round(duracion_segundos/60, 2)} min")
                    except Exception as e:
                        print(f"❌ Error MongoDB: {e}")

            # Reseteamos los relojes de la mesa
            mesa['inicio_video_seg'] = None
            mesa['inicio_reloj'] = None

        mesa['estado_anterior'] = estado_actual

        # Visualización
        color_zona = COLOR_OCUPADA if estado_actual == "OCUPADA" else COLOR_LIBRE
        if estado_actual == "OCUPADA": conteos['Ocupadas'] += 1
        else: conteos['Libres'] += 1

        cv2.polylines(frame, [mesa['poligono']], True, color_zona, 1)
        cv2.putText(frame, f"{mesa['nombre']}: {estado_actual}", (np.min(mesa['poligono'][:, :, 0]), max(10, np.min(mesa['poligono'][:, :, 1]) - 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color_zona, 1)

    # Dashboard
    cv2.rectangle(frame, (0,0), (300, 80), (0,0,0), -1)
    cv2.putText(frame, f"MESAS LIBRES: {conteos['Libres']}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.5, COLOR_LIBRE, 1)
    cv2.putText(frame, f"MESAS OCUPADAS: {conteos['Ocupadas']}", (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.5, COLOR_OCUPADA, 1)

    cv2.imshow("Auditoria de Mesas - Analisis Operativo", cv2.resize(frame, (1280, 720)))

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

# --- GUARDADO DE SEGURIDAD AL CERRAR ---
# Si cortas el video y había gente sentada, guardamos esos datos antes de salir.
print("Cerrando sistema... Guardando mesas que seguían ocupadas...")
for mesa in MESAS_DEFINIDAS:
    if mesa['estado_anterior'] == "OCUPADA" and mesa['inicio_video_seg'] is not None:
        duracion_segundos = tiempo_video_segundos - mesa['inicio_video_seg']
        if duracion_segundos > 5:
            doc = {
                "mesa": mesa['nombre'],
                "fecha": mesa['inicio_reloj'].strftime("%Y-%m-%d"),
                "hora_inicio": mesa['inicio_reloj'].strftime("%H:%M:%S"),
                "hora_fin": datetime.now().strftime("%H:%M:%S"),
                "duracion_segundos": round(duracion_segundos, 2),
                "duracion_minutos": round(duracion_segundos / 60, 2),
                "nota": "Corte de video"
            }
            coleccion_sesiones.insert_one(doc)

cap.release()
cv2.destroyAllWindows()
print("Procesamiento completo y limpio.")
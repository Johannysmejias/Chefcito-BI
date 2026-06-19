import cv2

# --- CONFIGURACIÓN ---
# Pon aquí la ruta de TU video local
RUTA_VIDEO = "C:/Users/Clementine/Desktop/Proyecto/maintestTN.mp4" 
# ---------------------

# Lista para guardar los puntos cliqueados
puntos = []

# Función que se ejecuta al hacer clic
def clic_evento(event, x, y, flags, params):
    if event == cv2.EVENT_LBUTTONDOWN: # Clic izquierdo
        print(f"Punto registrado: [{x}, {y}]")
        puntos.append([x, y])
        # Dibujar un pequeño círculo donde se hizo clic para referencia visual
        cv2.circle(imagen_mostrar, (x, y), 5, (0, 0, 255), -1)
        cv2.imshow("Obtener Coordenadas - Haz clic en los esquinas de las mesas", imagen_mostrar)

# Cargar el video y capturar el primer frame
cap = cv2.VideoCapture(RUTA_VIDEO)
exito, frame = cap.read()
cap.release() # Ya no necesitamos el video abierto

if not exito:
    print("Error: No se pudo leer el video. Verifica la ruta.")
    exit()
# Creamos una copia para dibujar los puntos sin dañar la original
imagen_mostrar = frame.copy()

# Crear ventana y setear el callback del mouse
cv2.namedWindow("Obtener Coordenadas - Haz clic en los esquinas de las mesas")
cv2.setMouseCallback("Obtener Coordenadas - Haz clic en los esquinas de las mesas", clic_evento)

print("--- INSTRUCCIONES ---")
print("1. Haz clic en las esquinas de una mesa (formando un polígono).")
print("2. Mira la terminal: ahí aparecerán las coordenadas.")
print("3. Cuando termines una mesa, copia esos puntos y reinicia para la siguiente.")
print("4. Presiona cualquier tecla para cerrar esta ventana.")

# Mostrar imagen y esperar
cv2.imshow("Obtener Coordenadas - Haz clic en los esquinas de las mesas", imagen_mostrar)
cv2.waitKey(0)
cv2.destroyAllWindows()
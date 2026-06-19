"""
API REST que expone el estado en vivo de las mesas para el plano web (Angular)
y permite DISPARAR la detección de forma remota desde un botón en la web.

- Lee la colección EstadoMesas de MongoDB —que Main_Mongodb.py mantiene
  actualizada por cada mesa (mesa_id, estado: LIBRE|OCUPADA)— y la sirve por HTTP.
- Lanza Main_Mongodb.py EN ESTA MISMA MÁQUINA (la que tiene GPU, video y modelo).
  El botón de la web de tu compañera, en otra computadora, llama a este backend.

Ejecutar:   python api.py      (o)   uvicorn api:app --reload

IMPORTANTE para que otra computadora pueda llegar a este backend:
  - Abajo, en uvicorn.run, host="0.0.0.0" hace que escuche en TODA la red local
    (no solo en esta PC). Tu compañera usará http://TU_IP:8000 (ver ipconfig).
"""
import subprocess
import sys
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient

MONGO_URI = "mongodb+srv://DAguilar:Diego2012hola@cluster0.tmrqgit.mongodb.net/?appName=Cluster0"

cliente = MongoClient(MONGO_URI)
db = cliente["RestauranteDB"]
coleccion_estado = db["EstadoMesas"]

# Ruta a Main_Mongodb.py (está en la misma carpeta que api.py).
DETECTOR = Path(__file__).with_name("Main_Mongodb.py")

# Guardamos el proceso de detección en marcha para no lanzar dos a la vez.
proceso_deteccion: Optional[subprocess.Popen] = None

app = FastAPI(title="Auditoría de Mesas — API")

# CORS: qué páginas web pueden llamar a esta API desde el navegador.
# Usamos "*" porque la web de tu compañera vive en OTRA computadora (otro origen).
# Mantén este backend en una red de confianza (LAN u oficina), ver nota de seguridad.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/api/estado")
def estado_mesas():
    """Devuelve el estado actual de todas las mesas: [{mesa_id, estado, actualizado}, ...]."""
    # Proyección sin _id (ObjectId no es serializable a JSON).
    # FastAPI convierte los datetime de 'actualizado' a ISO automáticamente.
    return list(
        coleccion_estado.find(
            {},
            {"_id": 0, "mesa_id": 1, "mesa_nombre": 1, "estado": 1, "actualizado": 1},
        ).sort("mesa_id", 1)
    )


@app.post("/api/iniciar-deteccion")
def iniciar_deteccion():
    """Lanza Main_Mongodb.py EN ESTA MÁQUINA. Lo llama el botón de la web.

    Devuelve enseguida (no espera a que termine el video); la detección corre
    en segundo plano y va escribiendo el estado en MongoDB como siempre.
    """
    global proceso_deteccion

    # Si ya hay una detección corriendo, no lanzamos otra (poll()=None → sigue viva).
    if proceso_deteccion is not None and proceso_deteccion.poll() is None:
        raise HTTPException(status_code=409, detail="La detección ya está en ejecución.")

    # sys.executable = el mismo Python con el que corre este backend (mismas librerías).
    proceso_deteccion = subprocess.Popen(
        [sys.executable, str(DETECTOR)],
        cwd=str(DETECTOR.parent),
    )
    return {"ok": True, "pid": proceso_deteccion.pid, "mensaje": "Detección iniciada."}


@app.get("/api/estado-deteccion")
def estado_deteccion():
    """Indica si la detección está corriendo ahora mismo (para el botón de la web)."""
    corriendo = proceso_deteccion is not None and proceso_deteccion.poll() is None
    return {"corriendo": corriendo}


if __name__ == "__main__":
    import uvicorn
    # host="0.0.0.0" → accesible desde otras computadoras de la red local.
    # (Para solo esta PC sería "127.0.0.1".)
    uvicorn.run(app, host="0.0.0.0", port=8000)

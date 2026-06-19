from pymongo import MongoClient
from datetime import datetime

MONGO_URI = "mongodb+srv://DAguilar:Diego2012hola@cluster0.tmrqgit.mongodb.net/?appName=Cluster0"

cliente = MongoClient(MONGO_URI)
db = cliente["RestauranteDB"]

# Borra todos los documentos de HistorialMesas que NO tengan campo "turno" (son los datos viejos anteriores a que se agregó el identificador de turno)
resultado = db["HistorialMesas"].delete_many({"turno": {"$exists": False}})
print(f"HistorialMesas — documentos borrados: {resultado.deleted_count}")

# ESTO PARA ARRANCAR DE 0 
db["HistorialMesas"].drop()
db["EventosOcupacion"].drop()
db["SesionesMesas"].drop()
db["EstadoMesas"].drop()
print("Colecciones eliminadas completamente.")

cliente.close()

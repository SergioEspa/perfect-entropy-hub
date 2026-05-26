from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .dependencies import get_current_member
from .database import engine, Base
# 🚨 IMPORTANTE: Importamos models para que SQLAlchemy registre las tablas en Base.metadata
from . import models 

# Lifespan: Código que se ejecuta al arrancar y apagar el servidor
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Al haber importado 'models' arriba, Base.metadata ya tiene las tablas listas para crearse
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(
    title="Perfect Entropy API",
    description="Backend hub para la gestión interna de la banda",
    version="1.0.0",
    lifespan=lifespan
)

# Configuración estricta de CORS
origins = [
    "http://localhost",
    "http://localhost:5500",  # Live Server de VSCode
    "http://127.0.0.1:5500",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # Permite GET, POST, PUT, DELETE...
    allow_headers=["*"],
)

# Rutas de estado y autenticación originales
@app.get("/api/health")
async def health_check():
    return {"status": "online", "message": "El laboratorio está abierto."}

@app.get("/api/auth/verify")
async def verify_auth(current_member: dict = Depends(get_current_member)):
    return {"authenticated": True, "member": current_member}
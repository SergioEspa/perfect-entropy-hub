from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import AsyncSession

# Importaciones locales
from .dependencies import get_current_member
from .database import engine, Base, get_db # Asegúrate de tener get_db en database.py
from . import models, schemas

# Lifespan: Código que se ejecuta al arrancar
@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(title="Perfect Entropy API", version="1.0.0", lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Para desarrollo es más cómodo
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Endpoint Health
@app.get("/api/health")
async def health_check():
    return {"status": "online"}

# Endpoint Auth
@app.get("/api/auth/verify")
async def verify_auth(current_member_id: int = Depends(get_current_member)):
    return {"authenticated": True, "member_id": current_member_id}

@app.post("/api/events/create", response_model=schemas.EventOut)
async def create_event(
    event_data: schemas.EventCreate,
    current_member_id: int = Depends(get_current_member),
    db: AsyncSession = Depends(get_db)
):
    new_event = models.Event(
        **event_data.model_dump(), 
        owner_id=current_member_id
    )
    new_event.create(db, current_member_id, new_event)
    return new_event
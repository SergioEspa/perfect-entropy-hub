from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from ..database import get_db
from .. import models, schemas

router = APIRouter()

@router.get("/oficial", response_model=List[schemas.EventOut])
async def get_oficial_events(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Event).where(models.Event.type == models.EventType.OFICIAL))
    return result.scalars().all()

@router.post("/", response_model=schemas.EventOut)
async def create_event(event: schemas.EventCreate, db: AsyncSession = Depends(get_db)):
    # Aquí iría el user_id del usuario autenticado (hardcoded provisionalmente)
    db_event = models.Event(**event.dict(), owner_id=1) 
    db.add(db_event)
    await db.commit()
    await db.refresh(db_event)
    return db_event
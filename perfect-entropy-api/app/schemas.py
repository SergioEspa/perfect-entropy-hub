from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from enum import Enum

class EventType(str, Enum):
    OFICIAL = "oficial"
    PROPUESTA = "propuesta"
    BLOQUEO = "bloqueo"

class EventStatus(str, Enum):
    PENDIENTE = "pendiente"
    CONFIRMADO = "confirmado"
    CANCELADO = "cancelado"

class EventBase(BaseModel):
    title: str
    start_time: datetime
    end_time: datetime
    type: EventType
    status: Optional[EventStatus] = EventStatus.CONFIRMADO

class EventCreate(EventBase):
    pass

class EventOut(EventBase):
    id: int
    owner_id: str

    class Config:
        from_attributes = True  # Permite mapear directamente desde SQLAlchemy
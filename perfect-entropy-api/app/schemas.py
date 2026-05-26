from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from enum import Enum

# ==========================================
# ENUMERACIONES (La lógica de negocio)
# ==========================================

class EventType(str, Enum):
    OFICIAL = "oficial"
    PROPUESTA = "propuesta"
    BLOQUEO = "bloqueo"

class EventStatus(str, Enum):
    PENDIENTE = "pendiente"
    CONFIRMADO = "confirmado"
    CANCELADO = "cancelado"

class SongStatus(str, Enum):
    IDEA = "Idea"
    COMPOSICION = "Composición"
    GRABACION = "Grabación"
    MASTERIZADO = "Masterizado"

class SectionType(str, Enum):
    INTRO = "Intro"
    VERSO = "Verso"
    ESTRIBILLO = "Estribillo"
    SOLO = "Solo"
    PUENTE = "Puente"
    OUTRO = "Outro"

class ConceptStatus(str, Enum):
    BORRADOR = "Borrador"
    EN_DESARROLLO = "En Desarrollo"
    APROBADO = "Aprobado"

class PostStatus(str, Enum):
    PENDIENTE = "Pendiente"
    PROGRAMADO = "Programado"
    PUBLICADO = "Publicado"

class Periodicity(str, Enum):
    SINGLE = "SINGLE"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"

# ==========================================
# SCHEMAS DE USUARIO
# ==========================================
class UserOut(BaseModel):
    id: int
    name: str
    role: str
    date_creation: datetime

    class Config:
        from_attributes = True

# ==========================================
# SCHEMAS DE MÚSICA
# ==========================================
class AlbumBase(BaseModel):
    title: str
    description: Optional[str] = None

class AlbumOut(AlbumBase):
    id: int
    date_creation: datetime
    
    class Config:
        from_attributes = True

class SongBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: SongStatus = SongStatus.IDEA
    id_album: Optional[int] = None

class SongOut(SongBase):
    id: int
    date_creation: datetime

    class Config:
        from_attributes = True

class SectionBase(BaseModel):
    type: SectionType
    lyrics: Optional[str] = None
    chords: Optional[str] = None
    time_signature: Optional[str] = None
    bpm: Optional[int] = None
    id_song: int

class SectionOut(SectionBase):
    id: int

    class Config:
        from_attributes = True

# ==========================================
# SCHEMAS DE CONCEPTO Y SOCIAL
# ==========================================
class ConceptIdeaOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    status: ConceptStatus
    id_album: Optional[int] = None
    id_song: Optional[int] = None
    created_by: int

    class Config:
        from_attributes = True

class PostIdeaOut(BaseModel):
    id: int
    title: str
    template_url: Optional[str] = None
    status: PostStatus
    created_by: int

    class Config:
        from_attributes = True

# ==========================================
# SCHEMAS DE CALENDARIO
# ==========================================
class EventBase(BaseModel):
    title: str
    start_time: datetime
    end_time: datetime
    type: EventType
    status: Optional[EventStatus] = EventStatus.CONFIRMADO
    periodicity: Periodicity = Periodicity.SINGLE
    color: Optional[str] = "#3788d8"
    description: Optional[str] = None

class EventCreate(EventBase):
    pass

class EventOut(EventBase):
    id: int
    owner_id: int # Cambiado a int porque ahora tenemos tabla User

    class Config:
        from_attributes = True
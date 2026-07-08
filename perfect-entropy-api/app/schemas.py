from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from enum import Enum

# ==========================================
# ENUMERACIONES (La lógica de negocio)
# ==========================================

class EventType(str, Enum):
    ENSAYO = "ENSAYO"
    GRABACION = "GRABACION"
    CONCIERTO = "CONCIERTO"
    LLAMADA = "LLAMADA"
    REUNION = "REUNION"

class EventStatus(str, Enum):
    PENDIENTE = "PENDIENTE"
    CONFIRMADO = "CONFIRMADO"
    CANCELADO = "CANCELADO"
    PASADO = "PASADO"

class SongStatus(str, Enum):
    IDEA = "IDEA"
    COMPOSICION = "COMPOSICION"
    GRABACION = "GRABACION"
    MASTERIZADO = "MASTERIZADO"

class SectionType(str, Enum):
    INTRO = "INTRO"
    VERSO = "VERSO"
    ESTRIBILLO = "ESTRIBILLO"
    SOLO = "SOLO"
    PUENTE = "PUENTE"
    OUTRO = "OUTRO"

class ConceptStatus(str, Enum):
    BORRADOR = "BORRADOR"
    EN_DESARROLLO = "EN_DESARROLLO"
    APROBADO = "APROBADO"

class PostStatus(str, Enum):
    PENDIENTE = "PENDIENTE"
    PROGRAMADO = "PROGRAMADO"
    PUBLICADO = "PUBLICADO"

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

class SongCreate(SongBase):
    pass

class SongUpdate(SongBase):
    pass

class SongOut(SongBase):
    id: int
    date_creation: datetime

    class Config:
        from_attributes = True

class SectionBase(BaseModel):
    type: SectionType
    lyrics: Optional[str] = None
    chords: Optional[str] = None
    key: Optional[str] = None
    time_signature: Optional[str] = None
    bpm: Optional[int] = None
    id_song: int


class SectionUpdate(BaseModel):
    type: Optional[SectionType] = None
    lyrics: Optional[str] = None
    chords: Optional[str] = None
    key: Optional[str] = None
    time_signature: Optional[str] = None
    bpm: Optional[int] = None

class EventBase(BaseModel):
    title: str
    start_time: datetime
    end_time: datetime
    type: EventType
    status: Optional[EventStatus] = EventStatus.CONFIRMADO
    periodicity: Periodicity = Periodicity.SINGLE
    color: Optional[str] = "#3788d8"
    description: Optional[str] = None

class LoginRequest(BaseModel):
    member_id: int
    password: str

class EventCreate(EventBase):
    pass

class EventUpdate(BaseModel):
    id: int
    title: Optional[str]
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    type: Optional[EventType]
    status: Optional[EventStatus] = EventStatus.CONFIRMADO
    periodicity: Optional[Periodicity] = Periodicity.SINGLE
    color: Optional[str] = "#3788d8"
    description: Optional[str] = None

class EventVoteDetailOut(BaseModel):
    can_attend: Optional[bool]
    user_id: int

class EventOut(EventBase):
    id: int
    owner_id: int # Cambiado a int porque ahora tenemos tabla User
    votes: list[EventVoteDetailOut] = []
    class Config:
        from_attributes = True
        
class VoteCreate(BaseModel):
    can_attend: Optional[bool] = None
    
class SectionOut(BaseModel):
    id: int
    type: str
    lyrics: Optional[str]
    key: Optional[str]
    chords: Optional[str]
    time_signature: Optional[str]
    bpm: Optional[int]
    # Omitimos id_song por redundancia en el arbol

    class Config:
        from_attributes = True

class RecordingBase(BaseModel):
    title: str
    url: str
    id_song: Optional[int] = None
    id_section: Optional[int] = None

class RecordingCreate(RecordingBase):
    pass

class RecordingOut(RecordingBase):
    id: int
    date_creation: datetime

    class Config:
        from_attributes = True

class SongDetailOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    status: str
    id_album: int
    sections: List[SectionOut] = []
    recordings: List[RecordingOut] = []

    class Config:
        from_attributes = True
        
# ==========================================
# SCHEMAS DE REDES SOCIALES
# ==========================================
class PostIdeaBase(BaseModel):
    title: str
    description: Optional[str] = None
    template_url: Optional[str] = None
    status: PostStatus = PostStatus.PENDIENTE
    id_album: Optional[int] = None
    id_song: Optional[int] = None

class PostIdeaCreate(PostIdeaBase):
    pass

class PostIdeaUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    template_url: Optional[str] = None
    status: Optional[PostStatus] = None

class PostIdeaOut(PostIdeaBase):
    id: int
    date_creation: datetime
    created_by: int

    class Config:
        from_attributes = True
        
# ==========================================
# SCHEMAS DE CONCEPTO Y LORE
# ==========================================
class ConceptIdeaBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: ConceptStatus = ConceptStatus.BORRADOR
    id_album: Optional[int] = None
    id_song: Optional[int] = None

class ConceptIdeaCreate(ConceptIdeaBase):
    pass

class ConceptIdeaUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ConceptStatus] = None

class ConceptIdeaOut(ConceptIdeaBase):
    id: int
    date_creation: datetime
    created_by: int

    class Config:
        from_attributes = True
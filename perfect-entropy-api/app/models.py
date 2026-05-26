import enum
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Boolean, Text
from sqlalchemy.orm import relationship, declarative_mixin
from sqlalchemy.sql import func
from .schemas import EventStatus, EventType
from .database import Base

# ==========================================
# 0. USUARIOS (La Banda)
# ==========================================
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False) # Ej: Voz, Guitarra, Teclado...
    
    # Podrías añadir campos futuros como 'avatar_url' o 'phone' aquí
    date_creation = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

# ==========================================
# MIXINS (Auditoría Global)
# ==========================================
@declarative_mixin
class AuditMixin:
    """Añade campos de auditoría y autoría automáticamente"""
    date_creation = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_modified = Column(DateTime(timezone=True), onupdate=func.now())
    flag_disabled = Column(Boolean, default=False, nullable=False)
    
    # 🚨 NUEVO: Ahora toda tabla que herede esto, exigirá saber quién lo creó
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)


# ==========================================
# 1. AGENDA / CALENDARIO
# ==========================================
class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    color = Column(String, default="#3788d8")
    description = Column(Text)
    periodicity = Column(String)
    type = Column(String, nullable=False)
    status = Column(String, default=EventStatus.CONFIRMADO)
    
    # 🚨 Restaurada la clave foránea
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False) 
    
    votes = relationship("EventVote", back_populates="event", cascade="all, delete-orphan")

class EventVote(Base):
    __tablename__ = "event_votes"

    id = Column(Integer, primary_key=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    
    # 🚨 Restaurada la clave foránea
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    can_attend = Column(Boolean, nullable=True) 
    
    event = relationship("Event", back_populates="votes")


# ==========================================
# 2. MÚSICA (Estructura jerárquica)
# ==========================================
class Album(AuditMixin, Base):
    __tablename__ = "albums"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text) 
    
    songs = relationship("Song", back_populates="album", cascade="all, delete-orphan")

class Song(AuditMixin, Base):
    __tablename__ = "songs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text) 
    status = Column(String, default="Idea") 
    
    id_album = Column(Integer, ForeignKey("albums.id"), nullable=True)
    
    album = relationship("Album", back_populates="songs")
    sections = relationship("Section", back_populates="song", cascade="all, delete-orphan")
    recordings = relationship("Recording", back_populates="song", cascade="all, delete-orphan")

class Section(AuditMixin, Base):
    __tablename__ = "sections"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String, nullable=False) 
    lyrics = Column(Text)
    chords = Column(Text) 
    time_signature = Column(String) 
    bpm = Column(Integer)
    
    id_song = Column(Integer, ForeignKey("songs.id"), nullable=False)
    
    song = relationship("Song", back_populates="sections")
    recordings = relationship("Recording", back_populates="section")

class Recording(AuditMixin, Base):
    __tablename__ = "recordings"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String, nullable=False) 
    title = Column(String) 
    
    id_song = Column(Integer, ForeignKey("songs.id"), nullable=True)
    id_section = Column(Integer, ForeignKey("sections.id"), nullable=True) 
    
    song = relationship("Song", back_populates="recordings")
    section = relationship("Section", back_populates="recordings")

# ==========================================
# 3. CONCEPTO Y LORE
# ==========================================
class ConceptIdea(AuditMixin, Base):
    __tablename__ = "concept_ideas"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text) 
    status = Column(String, default="Borrador")
    
    id_album = Column(Integer, ForeignKey("albums.id"), nullable=True)
    id_song = Column(Integer, ForeignKey("songs.id"), nullable=True)

# ==========================================
# 4. REDES SOCIALES / MARKETING
# ==========================================
class PostIdea(AuditMixin, Base):
    __tablename__ = "post_ideas"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text) 
    template_url = Column(String) 
    status = Column(String, default="Pendiente")
    
    id_album = Column(Integer, ForeignKey("albums.id"), nullable=True)
    id_song = Column(Integer, ForeignKey("songs.id"), nullable=True)

# ==========================================
# 5. GENERAL (Comentarios y feedback)
# ==========================================
class Comment(AuditMixin, Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False) 
    
    # 🚨 Restaurada la clave foránea
    id_user = Column(Integer, ForeignKey("users.id"), nullable=False) 
    
    reply_to = Column(Integer, ForeignKey("comments.id"), nullable=True)
    
    id_post_idea = Column(Integer, ForeignKey("post_ideas.id"), nullable=True)
    id_concept_idea = Column(Integer, ForeignKey("concept_ideas.id"), nullable=True)
    id_song = Column(Integer, ForeignKey("songs.id"), nullable=True)
    id_recording = Column(Integer, ForeignKey("recordings.id"), nullable=True)
    
    replies = relationship("Comment", backref="parent", remote_side=[id])
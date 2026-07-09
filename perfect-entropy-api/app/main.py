import os
import jwt
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from sqlalchemy.future import select
from sqlalchemy import update, func
from sqlalchemy.orm import selectinload
from .dependencies import get_current_member
from .database import engine, Base, get_db
from . import models, schemas
import calendar
import os
import shutil
from fastapi import UploadFile, File, Form
from fastapi.staticfiles import StaticFiles

GLOBAL_PASS = os.getenv("BAND_PASSWORD")
# Le ponemos un fallback por si tu archivo .env no tiene la variable escrita exactamente igual
JWT_SECRET = os.getenv("JWT_SECRET", "super_secreto_desarrollo_perfect_entropy") 
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DAYS = 7


# Lifespan: Código que se ejecuta al arrancar
@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(title="Perfect Entropy API", version="1.0.0", lifespan=lifespan)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://perfectentropy.duckdns.org",
        "http://localhost:5500",             
        "://127.0.0.1:5500"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Endpoint Health
@app.get("/api/health")
async def health_check():
    return {"status": "online"}

@app.post("/api/auth/login")
async def login(credentials: schemas.LoginRequest, db: AsyncSession = Depends(get_db)):
    if credentials.password != GLOBAL_PASS:
        raise HTTPException(status_code=401, detail="Contraseña maestra incorrecta.")
    
    result = await db.execute(select(models.User).where(models.User.id == credentials.member_id))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Miembro no encontrado en la base de datos.")

    # Generar el Token
    expiration = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS)
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "exp": expiration
    }
    
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
    return {"access_token": token, "token_type": "bearer", "member_name": user.name}

@app.patch("/api/songs/reorder")
async def reorder_songs(
    payload: schemas.ReorderPayload,
    current_member_id: int = Depends(get_current_member),
    db: AsyncSession = Depends(get_db)
):
    for position, song_id in enumerate(payload.ordered_ids, start=1):
        await db.execute(
            update(models.Song)
            .where(models.Song.id == song_id)
            .values(position=position)
        )
    await db.commit()
    return {"status": "success"}

@app.patch("/api/sections/reorder")
async def reorder_sections(
    payload: schemas.ReorderPayload,
    current_member_id: int = Depends(get_current_member),
    db: AsyncSession = Depends(get_db)
):
    for position, section_id in enumerate(payload.ordered_ids, start=1):
        await db.execute(
            update(models.Section)
            .where(models.Section.id == section_id)
            .values(position=position)
        )
    await db.commit()
    return {"status": "success"}

def get_next_monthly_same_weekday(sourcedate):
    target_weekday = sourcedate.weekday()
    
    nth_occurrence = (sourcedate.day - 1) // 7 + 1
    
    target_month = sourcedate.month % 12 + 1
    target_year = sourcedate.year + (sourcedate.month // 12)
    
    first_day_of_month, days_in_month = calendar.monthrange(target_year, target_month)
    
    first_occurrence_day = 1 + (target_weekday - first_day_of_month) % 7
    
    target_day = first_occurrence_day + (nth_occurrence - 1) * 7
    
    if target_day > days_in_month:
        target_day -= 7
        
    return sourcedate.replace(year=target_year, month=target_month, day=target_day)

@app.post("/api/events/create", response_model=schemas.EventOut)
async def create_event(
    event_data: schemas.EventCreate,
    current_member_id: int = Depends(get_current_member),
    db: AsyncSession = Depends(get_db)
):
    # Caso Base: Evento Único
    if event_data.periodicity == schemas.Periodicity.SINGLE:
        new_event = models.Event(
            **event_data.model_dump(), 
            owner_id=current_member_id
        )
        await new_event.create(db, current_member_id)
        
        result = await db.execute(
            select(models.Event)
            .options(selectinload(models.Event.votes).selectinload(models.EventVote.user))
            .where(models.Event.id == new_event.id)
        )
        return result.scalars().first()
    
    # Caso Recurrente: Materialización a 1 año vista
    else:
        current_start = event_data.start_time
        current_end = event_data.end_time
        limit_date = current_start + timedelta(days=365)
        
        first_event = None
        
        while current_start <= limit_date:
            # Sobrescribimos el volcado de datos con las fechas iteradas
            event_copy_data = event_data.model_dump()
            event_copy_data['start_time'] = current_start
            event_copy_data['end_time'] = current_end
            
            new_event = models.Event(
                **event_copy_data,
                owner_id=current_member_id
            )
            
            # Instanciamos el evento individualmente
            await new_event.create(db, current_member_id)
            
            # Guardamos la primera instancia para cumplir con el esquema de retorno
            if not first_event:
                first_event = new_event
                
            # Avanzamos el iterador temporal según la periodicidad
            if event_data.periodicity == schemas.Periodicity.WEEKLY:
                current_start += timedelta(days=7)
                current_end += timedelta(days=7)
            elif event_data.periodicity == schemas.Periodicity.MONTHLY:
                current_start = get_next_monthly_same_weekday(current_start)
                current_end = get_next_monthly_same_weekday(current_end)
            else:
                break
                
        # Cargamos las relaciones de la primera instancia generada
        result = await db.execute(
            select(models.Event)
            .options(selectinload(models.Event.votes).selectinload(models.EventVote.user))
            .where(models.Event.id == first_event.id)
        )
        return result.scalars().first()
      
@app.delete("/api/events/delete/{event_id}")
async def delete_event(
    event_id: int,
    current_member_id: int = Depends(get_current_member),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(models.Event).where(models.Event.id == event_id))
    db_event = result.scalars().first()
    await db_event.disable(session=db)
    return {"status": "success", "detail": "Evento eliminado correctamente"}

@app.delete("/api/events/delete-all/{event_id}")
async def delete_all_events(
    event_id: int,
    current_member_id: int = Depends(get_current_member),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(models.Event).where(models.Event.id == event_id))
    db_event = result.scalars().first()
    
    if not db_event:
        raise HTTPException(status_code=404, detail="Evento no encontrado.")
    
    tolerance = timedelta(seconds=5)
    lower_bound = db_event.date_creation - tolerance
    upper_bound = db_event.date_creation + tolerance
    
    periodic_events = await db.execute(
        select(models.Event)
        .where(
            models.Event.owner_id == db_event.owner_id,
            models.Event.date_creation >= lower_bound,
            models.Event.date_creation <= upper_bound,
            models.Event.periodicity == db_event.periodicity
        )
    )

    db_events = periodic_events.scalars().all()
    
    for ev in db_events:
        await ev.disable(session=db)

    return {"status": "success", "detail": "Eventos eliminados correctamente"}

@app.get("/api/events", response_model=list[schemas.EventOut])
async def get_events(
    fromdate: str,
    untildate: str,
    current_member_id: int = Depends(get_current_member),
    db: AsyncSession = Depends(get_db)
):
    try:
        fromdate = "2026-01-01" if fromdate == "all" else fromdate
        untildate = "2100-12-31" if untildate == "all" else untildate
        start_datetime = datetime.fromisoformat(fromdate)
        end_datetime = datetime.fromisoformat(untildate)
    except ValueError:
        raise HTTPException(status_code=422, detail="Fechas inválidas. Usa el formato YYYY-MM-DD.")

    result = await db.execute(
        select(models.Event)
        .options(
            selectinload(models.Event.votes).selectinload(models.EventVote.user) # 🚨 MAGIA: Carga encadenada de Votos + Usuario
        )
        .where(
            models.Event.start_time >= start_datetime,
            models.Event.end_time <= end_datetime,
            models.Event.flag_disabled == False
        )
    )
    events = result.scalars().unique().all()
    return events

@app.delete


@app.post("/api/events/{event_id}/vote", response_model=bool)
async def vote(
    vote_data: schemas.VoteCreate,
    event_id: int,
    current_member_id: int = Depends(get_current_member),
    db: AsyncSession = Depends(get_db)
):
    existingVote = await db.execute(
        select(models.EventVote).where(
            models.EventVote.user_id == current_member_id, 
            models.EventVote.event_id == event_id
        )
    )
    vote = existingVote.scalars().first()
    
    if (vote):
        vote.can_attend = vote_data.can_attend
        await db.commit()
        await db.refresh(vote)
    else:
        newVote = models.EventVote(
            event_id=event_id,
            user_id=current_member_id,
            can_attend=vote_data.can_attend
        )
        await newVote.create(db, current_member_id) 
        
    return True
        
@app.patch("/api/events/update/{event_id}", response_model=schemas.EventOut)
async def update_event(
    event_id: int, 
    event_data: schemas.EventUpdate, 
    current_member_id: int = Depends(get_current_member), 
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(models.Event).where(models.Event.id == event_id))
    db_event = result.scalars().first()
    
    if not db_event:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
        
    update_data = event_data.model_dump(exclude_unset=True, exclude={"id"})
    for key, value in update_data.items():
        setattr(db_event, key, value)
        
    await db.commit()
    
    # Recargamos relaciones
    fresh_result = await db.execute(
        select(models.Event)
        .options(selectinload(models.Event.votes).selectinload(models.EventVote.user))
        .where(models.Event.id == event_id)
    )
    return fresh_result.scalars().first()


@app.patch("/api/events/update-all/{event_id}")
async def update_all_events(
    event_id: int, 
    event_data: schemas.EventUpdate, 
    current_member_id: int = Depends(get_current_member), 
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(models.Event).where(models.Event.id == event_id))
    db_event = result.scalars().first()
    
    if not db_event:
        raise HTTPException(status_code=404)
        
    # Misma heurística de la ventana de 5 segundos que usaste para el borrado
    tolerance = timedelta(seconds=5)
    periodic_events = await db.execute(
        select(models.Event).where(
            models.Event.owner_id == db_event.owner_id,
            models.Event.date_creation >= db_event.date_creation - tolerance,
            models.Event.date_creation <= db_event.date_creation + tolerance,
            models.Event.periodicity == db_event.periodicity
        )
    )
    
    
    update_data = event_data.model_dump(exclude_unset=True, exclude={"id"})
    
    actual_changes = {}
    for key, new_value in update_data.items():
        current_value = getattr(db_event, key)
        
        if current_value != new_value:
            actual_changes[key] = new_value

    for ev in periodic_events.scalars().all():
        for key, value in actual_changes.items():
            if key in ['start_time', 'end_time'] and value is not None:
                old_date = getattr(ev, key)
                setattr(ev, key, old_date.replace(hour=value.hour, minute=value.minute))
            else:
                setattr(ev, key, value)
                
    await db.commit()
    return {"status": "success"}

@app.get("/api/albums/{album_id}/songs", response_model=list[schemas.SongDetailOut])
async def get_album_songs(
    album_id: int, 
    current_member_id: int = Depends(get_current_member), 
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(models.Song)
        .where(models.Song.id_album == album_id, models.Song.flag_disabled == False)
        .order_by(models.Song.position.asc().nulls_last(), models.Song.id.asc())
        .options(
            selectinload(models.Song.sections),
            selectinload(models.Song.recordings)
        )
    )
    result = await db.execute(query)
    return result.scalars().all()

@app.post("/api/albums/create", response_model=schemas.AlbumOut)
async def create_album(
    album_data: schemas.AlbumBase,
    current_member_id: int = Depends(get_current_member),
    db: AsyncSession = Depends(get_db)
):
    new_album = models.Album(**album_data.model_dump(), created_by=current_member_id)
    # Usamos el mixin de auditoría heredado
    await new_album.create(db, current_member_id)
    return new_album

@app.patch("/api/albums/update/{album_id}", response_model=schemas.AlbumOut)
async def update_album(
    album_id: int,
    album_data: schemas.AlbumBase,
    current_member_id: int = Depends(get_current_member),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(models.Album).where(models.Album.id == album_id, models.Album.flag_disabled == False))
    db_album = result.scalars().first()
    
    if not db_album:
        raise HTTPException(status_code=404, detail="Álbum no encontrado.")
        
    update_data = album_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_album, key, value)
        
    await db.commit()
    await db.refresh(db_album)
    return db_album

@app.delete("/api/albums/delete/{album_id}")
async def delete_album(
    album_id: int,
    current_member_id: int = Depends(get_current_member),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(models.Album).where(models.Album.id == album_id, models.Album.flag_disabled == False))
    db_album = result.scalars().first()
    
    if not db_album:
        raise HTTPException(status_code=404, detail="Álbum no encontrado.")
        
    # El borrado lógico de AuditMixin inhabilita en cascada gracias a la configuración del modelo
    await db_album.disable(session=db)
    return {"status": "success", "detail": "Álbum y elementos vinculados deshabilitados correctamente"}

@app.get("/api/albums", response_model=list[schemas.AlbumOut])
async def get_albums(
    current_member_id: int = Depends(get_current_member),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(models.Album).where(models.Album.flag_disabled == False))
    db_albums = result.scalars().all()
    
    return db_albums


# Añadir a main.py

@app.post("/api/songs", response_model=schemas.SongOut)
async def create_song(
    song_data: schemas.SongCreate,
    current_member_id: int = Depends(get_current_member),
    db: AsyncSession = Depends(get_db)
):
    # Calcular la siguiente posición dentro del álbum
    max_pos_result = await db.execute(
        select(func.max(models.Song.position)).where(
            models.Song.id_album == song_data.id_album,
            models.Song.flag_disabled == False
        )
    )
    max_pos = max_pos_result.scalar() or 0
    
    new_song = models.Song(**song_data.model_dump(), position=max_pos + 1)
    await new_song.create(session=db, creator_id=current_member_id)
    return new_song

@app.get("/api/songs/album/{album_id}", response_model=list[schemas.SongOut])
async def get_songs_by_album(album_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.Song).where(
            models.Song.id_album == album_id, 
            models.Song.flag_disabled == False
        )
    )
    return result.scalars().all()

@app.patch("/api/songs/{song_id}", response_model=schemas.SongOut)
async def update_song(
    song_id: int, 
    song_data: schemas.SongUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(models.Song).where(models.Song.id == song_id))
    song = result.scalars().first()
    if not song:
        raise HTTPException(status_code=404, detail="Canción no encontrada")
        
    for key, value in song_data.model_dump(exclude_unset=True).items():
        setattr(song, key, value)
    
    await db.commit()
    await db.refresh(song)
    return song

@app.delete("/api/songs/{song_id}")
async def delete_song(song_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Song).where(models.Song.id == song_id))
    song = result.scalars().first()
    if not song:
        raise HTTPException(status_code=404, detail="Canción no encontrada")
    
    await song.disable(session=db)
    return {"status": "success"}

@app.post("/api/sections", response_model=schemas.SectionOut)
async def create_section(
    section_data: schemas.SectionBase,
    current_member_id: int = Depends(get_current_member),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(models.Song).where(models.Song.id == section_data.id_song))
    song = result.scalars().first()
    if not song:
        raise HTTPException(status_code=404, detail="Canción no encontrada")

    max_pos_result = await db.execute(
        select(func.max(models.Section.position)).where(
            models.Section.id_song == section_data.id_song,
            models.Section.flag_disabled == False
        )
    )
    max_pos = max_pos_result.scalar() or 0

    new_section = models.Section(**section_data.model_dump(), position=max_pos + 1)
    await new_section.create(session=db, creator_id=current_member_id)
    return new_section

@app.patch("/api/sections/{section_id}", response_model=schemas.SectionOut)
async def update_section(
    section_id: int,
    section_data: schemas.SectionUpdate,
    current_member_id: int = Depends(get_current_member),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(models.Section).where(models.Section.id == section_id))
    section = result.scalars().first()
    if not section:
        raise HTTPException(status_code=404, detail="Sección no encontrada")

    for key, value in section_data.model_dump(exclude_unset=True).items():
        setattr(section, key, value)

    await db.commit()
    await db.refresh(section)
    return section

@app.delete("/api/sections/{section_id}")
async def delete_section(
    section_id: int,
    current_member_id: int = Depends(get_current_member),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(models.Section).where(models.Section.id == section_id))
    section = result.scalars().first()
    if not section:
        raise HTTPException(status_code=404, detail="Sección no encontrada")

    await section.disable(session=db)
    return {"status": "success"}

@app.get("/api/sections/song/{song_id}", response_model=list[schemas.SectionOut])
async def get_sections_for_song(
    song_id: int,
    current_member_id: int = Depends(get_current_member),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(models.Song).where(models.Song.id == song_id))
    song = result.scalars().first()
    if not song:
        raise HTTPException(status_code=404, detail="Canción no encontrada")

    sections_result = await db.execute(
        select(models.Section)
        .where(
            models.Section.id_song == song_id,
            models.Section.flag_disabled == False
        )
        .order_by(models.Section.position.asc().nulls_last(), models.Section.id.asc())
    )
    return sections_result.scalars().all()

@app.post("/api/recordings/upload")
async def upload_recording_file(
    file: UploadFile = File(...),
    current_member_id: int = Depends(get_current_member)
):
    # Generar un nombre único para evitar colisiones entre vosotros
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    safe_filename = f"{timestamp}_{file.filename.replace(' ', '_')}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    
    # Guardar en disco duro
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"url": f"/uploads/{safe_filename}"}

@app.post("/api/recordings", response_model=schemas.RecordingOut)
async def create_recording(
    recording_data: schemas.RecordingBase, # Necesitarás añadir este schema en schemas.py
    current_member_id: int = Depends(get_current_member),
    db: AsyncSession = Depends(get_db)
):
    new_recording = models.Recording(**recording_data.model_dump())
    await new_recording.create(session=db, creator_id=current_member_id)
    return new_recording

# --- ENDPOINTS REDES SOCIALES ---

@app.get("/api/posts/album/{album_id}", response_model=list[schemas.PostIdeaOut])
async def get_posts_by_album(album_id: int, current_member_id: int = Depends(get_current_member), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.PostIdea).where(
            models.PostIdea.id_album == album_id,
            models.PostIdea.id_song.is_(None), # Solo ideas del álbum genérico, no de sus canciones
            models.PostIdea.flag_disabled == False
        )
    )
    return result.scalars().all()

@app.get("/api/posts/song/{song_id}", response_model=list[schemas.PostIdeaOut])
async def get_posts_by_song(song_id: int, current_member_id: int = Depends(get_current_member), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.PostIdea).where(
            models.PostIdea.id_song == song_id,
            models.PostIdea.flag_disabled == False
        )
    )
    return result.scalars().all()

@app.post("/api/posts", response_model=schemas.PostIdeaOut)
async def create_post(
    post_data: schemas.PostIdeaCreate,
    current_member_id: int = Depends(get_current_member),
    db: AsyncSession = Depends(get_db)
):
    new_post = models.PostIdea(**post_data.model_dump())
    await new_post.create(session=db, creator_id=current_member_id)
    return new_post

@app.patch("/api/posts/{post_id}", response_model=schemas.PostIdeaOut)
async def update_post(
    post_id: int,
    post_data: schemas.PostIdeaUpdate,
    current_member_id: int = Depends(get_current_member),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(models.PostIdea).where(models.PostIdea.id == post_id))
    post = result.scalars().first()
    if not post:
        raise HTTPException(status_code=404, detail="Idea no encontrada")

    for key, value in post_data.model_dump(exclude_unset=True).items():
        setattr(post, key, value)

    await db.commit()
    await db.refresh(post)
    return post

@app.delete("/api/posts/{post_id}")
async def delete_post(post_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.PostIdea).where(models.PostIdea.id == post_id))
    post = result.scalars().first()
    if not post:
        raise HTTPException(status_code=404, detail="Idea no encontrada")
    
    await post.disable(session=db)
    return {"status": "success"}

# --- ENDPOINTS CONCEPTOS / LORE ---

@app.get("/api/concepts/album/{album_id}", response_model=list[schemas.ConceptIdeaOut])
async def get_concepts_by_album(album_id: int, current_member_id: int = Depends(get_current_member), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.ConceptIdea).where(
            models.ConceptIdea.id_album == album_id,
            models.ConceptIdea.id_song.is_(None), # Solo conceptos a nivel de álbum
            models.ConceptIdea.flag_disabled == False
        )
    )
    return result.scalars().all()

@app.get("/api/concepts/song/{song_id}", response_model=list[schemas.ConceptIdeaOut])
async def get_concepts_by_song(song_id: int, current_member_id: int = Depends(get_current_member), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.ConceptIdea).where(
            models.ConceptIdea.id_song == song_id,
            models.ConceptIdea.flag_disabled == False
        )
    )
    return result.scalars().all()

@app.post("/api/concepts", response_model=schemas.ConceptIdeaOut)
async def create_concept(
    concept_data: schemas.ConceptIdeaCreate,
    current_member_id: int = Depends(get_current_member),
    db: AsyncSession = Depends(get_db)
):
    new_concept = models.ConceptIdea(**concept_data.model_dump())
    await new_concept.create(session=db, creator_id=current_member_id)
    return new_concept

@app.patch("/api/concepts/{concept_id}", response_model=schemas.ConceptIdeaOut)
async def update_concept(
    concept_id: int,
    concept_data: schemas.ConceptIdeaUpdate,
    current_member_id: int = Depends(get_current_member),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(models.ConceptIdea).where(models.ConceptIdea.id == concept_id))
    concept = result.scalars().first()
    if not concept:
        raise HTTPException(status_code=404, detail="Concepto no encontrado")

    for key, value in concept_data.model_dump(exclude_unset=True).items():
        setattr(concept, key, value)

    await db.commit()
    await db.refresh(concept)
    return concept

@app.delete("/api/concepts/{concept_id}")
async def delete_concept(concept_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.ConceptIdea).where(models.ConceptIdea.id == concept_id))
    concept = result.scalars().first()
    if not concept:
        raise HTTPException(status_code=404, detail="Concepto no encontrado")
    
    await concept.disable(session=db)
    return {"status": "success"}

@app.get("/api/concepts/global", response_model=list[schemas.ConceptIdeaOut])
async def get_global_concepts(current_member_id: int = Depends(get_current_member), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.ConceptIdea).where(
            models.ConceptIdea.id_album.is_(None),
            models.ConceptIdea.id_song.is_(None),
            models.ConceptIdea.flag_disabled == False
        )
    )
    return result.scalars().all()

@app.get("/api/posts/global", response_model=list[schemas.PostIdeaOut])
async def get_global_posts(current_member_id: int = Depends(get_current_member), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.PostIdea).where(
            models.PostIdea.id_album.is_(None),
            models.PostIdea.id_song.is_(None),
            models.PostIdea.flag_disabled == False
        )
    )
    return result.scalars().all()
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
from sqlalchemy import update
from sqlalchemy.orm import selectinload
from .dependencies import get_current_member
from .database import engine, Base, get_db
from . import models, schemas
import calendar

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
    # 🚨 MAGIA: Una sola consulta SQL masiva, trayendo el árbol completo
    query = (
        select(models.Song)
        .where(models.Song.id_album == album_id, models.Song.flag_disabled == False)
        .options(
            selectinload(models.Song.sections),
            selectinload(models.Song.recordings)
        )
    )
    result = await db.execute(query)
    songs = result.scalars().all()
    
    return songs

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
    new_song = models.Song(**song_data.model_dump())
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
import os
from fastapi import Header, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from .database import get_db # Asegúrate de tener esta función en tu database.py
from .models import User

GLOBAL_PASS = os.getenv("BAND_PASSWORD")

async def get_current_member(
    x_member_id: str = Header(None),
    x_band_pass: str = Header(None),
    db: AsyncSession = Depends(get_db)  # Inyectamos la conexión a la base de datos
):
    """
    Exige la contraseña global. Si es correcta, busca al usuario en la BBDD.
    """
    if not x_band_pass or x_band_pass != GLOBAL_PASS:
        raise HTTPException(status_code=401, detail="Contraseña maestra incorrecta.")
    
    if not x_member_id:
        raise HTTPException(status_code=401, detail="Identidad no proporcionada en la puerta.")
    
    # Buscamos al usuario en la tabla 'users'
    result = await db.execute(select(User).where(User.id == int(x_member_id)))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=403, detail="Identidad no reconocida en la banda.")
    
    # Devolvemos el ID del usuario (o el objeto entero 'user' si prefieres tener todos sus datos)
    return user.id
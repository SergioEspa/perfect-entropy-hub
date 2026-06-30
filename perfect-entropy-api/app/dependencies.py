import os
import jwt
from fastapi import Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

# La clave con la que firmaremos. En producción debe ser un secreto real.
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"

async def get_current_member(
    authorization: str = Header(None)
):
    """
    Intercepta el header 'Authorization: Bearer <token>', lo descifra
    y devuelve el ID del miembro. Cero consultas a la base de datos.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Falta el token de acceso en la cabecera.")
    
    # Extraemos solo la parte del token
    token = authorization.split(" ")[1] 
    
    try:
        # Si la firma no coincide o el token caducó, esto lanzará una excepción
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        member_id = int(payload.get("sub"))
        return member_id
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="El token ha caducado. Vuelve a iniciar sesión.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido o manipulado.")
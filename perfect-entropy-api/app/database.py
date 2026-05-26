import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

# Cargamos las variables del .env
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("La variable DATABASE_URL no está configurada en el .env")

# Creamos el motor asíncrono (echo=True imprime las queries en consola, útil en desarrollo)
engine = create_async_engine(DATABASE_URL, echo=True)

# Fábrica de sesiones asíncronas
AsyncSessionLocal = async_sessionmaker(
    bind=engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)

# Clase base para nuestros modelos ORM
Base = declarative_base()

# Dependencia para inyectar la sesión de base de datos en los endpoints de FastAPI
async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api_router import api_router
from src.core.config import get_settings
from src.core.lifespan import lifespan

settings = get_settings()
app = FastAPI(title="Egong API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

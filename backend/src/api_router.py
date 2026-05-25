from fastapi import APIRouter

from src.academies.router import router as academies_router
from src.health.router import router as health_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(academies_router)

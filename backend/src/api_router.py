from fastapi import APIRouter

from src.academies.router import router as academies_router
from src.health.router import router as health_router
from src.impersonation.router import router as impersonation_router
from src.imports.router import router as imports_router
from src.provisioning.router import router as provisioning_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(academies_router)
api_router.include_router(impersonation_router)
api_router.include_router(provisioning_router)
api_router.include_router(imports_router)

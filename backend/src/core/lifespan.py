from contextlib import asynccontextmanager

from fastapi import FastAPI


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Startup hooks (e.g., warm caches) go here.
    yield
    # Shutdown hooks (e.g., close pooled clients) go here.

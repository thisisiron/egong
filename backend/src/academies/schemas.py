"""Request/response models for admin academy CRUD."""

from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field


class AcademyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    owner_email: EmailStr
    owner_display_name: str = Field(min_length=1, max_length=100)
    owner_temp_password: str = Field(min_length=8)
    contract_started_at: date | None = None


class AcademyOut(BaseModel):
    id: str
    name: str
    status: str
    contract_started_at: date | None
    created_at: datetime
    owner_email: EmailStr | None = None


class AcademyUpdate(BaseModel):
    name: str | None = None
    status: str | None = None
    settings: dict | None = None

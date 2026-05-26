"""Pydantic schemas for academy_applications domain."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

BusinessType = Literal["individual", "corporate", "tutoring", "planned"]
StudentCount = Literal["under_50", "50_to_200", "over_200"]
ApplicationStatus = Literal["pending", "approved", "rejected"]


class ApplicationSubmit(BaseModel):
    """Public submission payload — no auth required."""

    # applicant
    applicant_name: str = Field(min_length=1, max_length=100)
    applicant_email: EmailStr
    applicant_phone: str = Field(min_length=10, max_length=20)

    # academy
    academy_name: str = Field(min_length=1, max_length=200)
    academy_region: str | None = Field(default=None, max_length=200)
    academy_student_count: StudentCount | None = None
    inquiry_message: str | None = Field(default=None, max_length=2000)

    # business
    business_type: BusinessType
    business_name: str = Field(min_length=1, max_length=200)
    business_owner_name: str = Field(min_length=1, max_length=100)
    business_number: str | None = Field(default=None, max_length=20)
    registration_file_path: str | None = Field(default=None, max_length=500)


class ApplicationOut(BaseModel):
    """Admin-facing read model."""

    id: str
    status: ApplicationStatus
    applicant_name: str
    applicant_email: str
    applicant_phone: str
    academy_name: str
    academy_region: str | None
    academy_student_count: StudentCount | None
    inquiry_message: str | None
    business_type: BusinessType
    business_name: str
    business_owner_name: str
    business_number: str | None
    registration_file_path: str | None
    created_at: datetime


class ApplicationSubmitResult(BaseModel):
    """Returned after public submission. Minimal — no leak of internal IDs."""

    ok: bool = True


class SignedDownloadUrl(BaseModel):
    """For admin to download a registration file."""

    url: str
    expires_in: int  # seconds

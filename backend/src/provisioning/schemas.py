"""Request/response models for owner-level provisioning (teachers, parents,
student auth attach, parent lookup)."""

from pydantic import BaseModel, EmailStr, Field


class TeacherCreate(BaseModel):
    email: EmailStr
    display_name: str = Field(min_length=1, max_length=100)
    temp_password: str = Field(min_length=8)
    phone: str | None = None


class TeacherOut(BaseModel):
    id: str
    user_id: str
    display_name: str
    email: EmailStr


class ParentCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=100)
    phone: str | None = None
    temp_password: str = Field(min_length=8)


class ParentOut(BaseModel):
    id: str
    user_id: str
    name: str
    phone: str | None = None
    email: EmailStr


class ParentLookupOut(BaseModel):
    """Returned by GET /owner/parents/by-email — the bare parent.id is what
    the frontend needs to insert into student_parent."""

    id: str


class StudentAuthCreate(BaseModel):
    """Issue a login for an existing student row (no own auth user yet)."""

    email: EmailStr
    temp_password: str = Field(min_length=8)


class StudentAuthOut(BaseModel):
    user_id: str

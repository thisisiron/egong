from pydantic import BaseModel


class ImpersonateRequest(BaseModel):
    academy_id: str


class ImpersonateResponse(BaseModel):
    owner_email: str
    magic_link: str

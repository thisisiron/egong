from pydantic import BaseModel


class ImportResult(BaseModel):
    kind: str
    inserted: int
    errors: list[str] = []

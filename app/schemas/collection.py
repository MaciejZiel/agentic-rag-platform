from pydantic import BaseModel


class CollectionCreate(BaseModel):
    name: str
    description: str | None = None
    color: str = "#3b82f6"


class CollectionUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    color: str | None = None


class CollectionOut(BaseModel):
    id: str
    name: str
    description: str | None
    color: str
    document_count: int
    created_at: str
    updated_at: str


class CollectionListOut(BaseModel):
    collections: list[CollectionOut]
    total: int

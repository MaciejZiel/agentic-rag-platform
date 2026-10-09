import re

from pydantic import BaseModel, Field, field_validator

_HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


class CollectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=256)
    description: str | None = Field(default=None, max_length=2000)
    color: str = Field(default="#3b82f6", max_length=7)

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: str) -> str:
        if not _HEX_COLOR_RE.match(v):
            raise ValueError("Color must be a valid hex color (e.g. #3b82f6)")
        return v


class CollectionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=256)
    description: str | None = Field(default=None, max_length=2000)
    color: str | None = Field(default=None, max_length=7)

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: str | None) -> str | None:
        if v is not None and not _HEX_COLOR_RE.match(v):
            raise ValueError("Color must be a valid hex color (e.g. #3b82f6)")
        return v


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

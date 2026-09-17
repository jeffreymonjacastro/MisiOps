from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

CategoryType = Literal["income", "expense"]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
Budget = Annotated[Decimal, Field(ge=0, decimal_places=2)]


class CategoryCreate(BaseModel):
    name: Name
    type: CategoryType
    budget: Budget | None = None


class CategoryUpdate(BaseModel):
    """All fields optional. Omitted = unchanged; budget null = clear."""

    model_config = ConfigDict(extra="ignore")

    name: Name | None = None
    type: CategoryType | None = None
    budget: Budget | None = None


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: CategoryType
    budget: float | None  # float so JSON emits a number

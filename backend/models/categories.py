"""
Pydantic models for Categories API
"""
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class SubCategory(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    name: str
    description: Optional[str] = None

class Category(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    name: str
    description: Optional[str] = None
    subCategories: List[SubCategory] = []
    createdAt: datetime
    updatedAt: datetime

class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None

class CategoryUpdate(BaseModel):
    name: str
    description: Optional[str] = None

class CategoriesResponse(BaseModel):
    categories: List[Category]

class CategoryResponse(BaseModel):
    category: Category


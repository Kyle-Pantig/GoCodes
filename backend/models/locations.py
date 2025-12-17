"""
Pydantic models for Locations API
"""
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class Location(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    name: str
    description: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime

class LocationCreate(BaseModel):
    name: str
    description: Optional[str] = None

class LocationUpdate(BaseModel):
    name: str
    description: Optional[str] = None

class LocationsResponse(BaseModel):
    locations: List[Location]

class LocationResponse(BaseModel):
    location: Location


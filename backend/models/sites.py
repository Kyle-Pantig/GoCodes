"""
Pydantic models for Sites API
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class Site(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime

class SiteCreate(BaseModel):
    name: str
    description: Optional[str] = None

class SiteUpdate(BaseModel):
    name: str
    description: Optional[str] = None

class SitesResponse(BaseModel):
    sites: List[Site]

class SiteResponse(BaseModel):
    site: Site


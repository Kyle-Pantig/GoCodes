"""
Pydantic models for Company Info API
"""
from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class CompanyInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    companyName: str
    contactEmail: Optional[str] = None
    contactPhone: Optional[str] = None
    address: Optional[str] = None
    zipCode: Optional[str] = None
    country: Optional[str] = None
    website: Optional[str] = None
    primaryLogoUrl: Optional[str] = None
    secondaryLogoUrl: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime

class CompanyInfoCreate(BaseModel):
    companyName: str
    contactEmail: Optional[str] = None
    contactPhone: Optional[str] = None
    address: Optional[str] = None
    zipCode: Optional[str] = None
    country: Optional[str] = None
    website: Optional[str] = None
    primaryLogoUrl: Optional[str] = None
    secondaryLogoUrl: Optional[str] = None

class CompanyInfoUpdate(BaseModel):
    companyName: str
    contactEmail: Optional[str] = None
    contactPhone: Optional[str] = None
    address: Optional[str] = None
    zipCode: Optional[str] = None
    country: Optional[str] = None
    website: Optional[str] = None
    primaryLogoUrl: Optional[str] = None
    secondaryLogoUrl: Optional[str] = None

class CompanyInfoResponse(BaseModel):
    companyInfo: Optional[CompanyInfo] = None


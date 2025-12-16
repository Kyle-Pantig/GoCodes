# FastAPI Backend Structure

This document explains the modular structure of the FastAPI backend.

## Directory Structure

```
backend/
├── main.py              # Application entry point - app setup and router registration
├── auth.py              # Authentication utilities (verify_auth, token extraction)
├── database.py          # Database connection and Prisma client setup
├── models/              # Pydantic models for API requests/responses
│   ├── __init__.py
│   ├── locations.py     # Location models
│   └── sites.py         # Site models
├── routers/             # API route handlers (one file per resource)
│   ├── __init__.py
│   ├── locations.py     # Locations API endpoints
│   └── sites.py         # Sites API endpoints
└── prisma_client/       # Generated Prisma Python client
```

## Adding New Resources

To add a new resource (e.g., `departments`):

### 1. Create Model File
Create `models/departments.py`:
```python
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class Department(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime

class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = None

class DepartmentUpdate(BaseModel):
    name: str
    description: Optional[str] = None

class DepartmentsResponse(BaseModel):
    departments: List[Department]

class DepartmentResponse(BaseModel):
    department: Department
```

### 2. Update Models __init__.py
Add to `models/__init__.py`:
```python
from .departments import (
    Department,
    DepartmentCreate,
    DepartmentUpdate,
    DepartmentsResponse,
    DepartmentResponse
)
```

### 3. Create Router File
Create `routers/departments.py`:
```python
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional
from models.departments import (
    Department,
    DepartmentCreate,
    DepartmentUpdate,
    DepartmentsResponse,
    DepartmentResponse
)
from auth import verify_auth
from database import prisma

router = APIRouter(prefix="/api/departments", tags=["departments"])

@router.get("", response_model=DepartmentsResponse)
async def get_departments(
    search: Optional[str] = Query(None),
    auth: dict = Depends(verify_auth)
):
    # Implementation here
    pass

# Add POST, PUT, DELETE endpoints...
```

### 4. Register Router in main.py
Add to `main.py`:
```python
from routers import locations, sites, departments

# ...

app.include_router(departments.router)
```

## Benefits

- **Separation of Concerns**: Each resource has its own file
- **Maintainability**: Easy to find and modify code for specific resources
- **Scalability**: Easy to add new resources without cluttering main.py
- **Reusability**: Models and auth utilities are shared across resources
- **Clean Code**: main.py stays focused on app configuration

## Running the Application

```bash
# From backend directory
python run.py

# Or directly
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```


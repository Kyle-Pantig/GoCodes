"""
Assets API router
"""
from fastapi import APIRouter, HTTPException, Query, Depends, UploadFile, File, Form, Request, Path
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from decimal import Decimal
import logging
import asyncio
import os
import re
import random
from supabase import create_client, Client
import httpx
from urllib.parse import urlparse

from models.assets import (
    Asset,
    AssetCreate,
    AssetUpdate,
    AssetsResponse,
    AssetResponse,
    StatusesResponse,
    SummaryResponse,
    DeleteResponse,
    BulkDeleteRequest,
    BulkDeleteResponse,
    BulkRestoreRequest,
    BulkRestoreResponse,
    PaginationInfo,
    SummaryInfo,
    CategoryInfo,
    SubCategoryInfo,
    EmployeeInfo,
    CheckinInfo,
    CheckoutInfo,
    LeaseInfo,
    ReservationInfo,
    AuditHistoryInfo,
    GenerateAssetTagRequest,
    GenerateAssetTagResponse
)
from auth import verify_auth, SUPABASE_URL, SUPABASE_ANON_KEY
from database import prisma

logger = logging.getLogger(__name__)

def is_uuid(value: str) -> bool:
    """Check if a string is a UUID"""
    uuid_pattern = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)
    return bool(uuid_pattern.match(value))

def get_company_initials(company_name: Optional[str]) -> str:
    """
    Extract company initials from company name
    Handles:
    - Multiple words: "Go Codes" -> "GC"
    - CamelCase/combined words: "GoCodes" -> "GC", "ABCCompany" -> "AC"
    - Single word: "XYZ" -> "XY"
    """
    if not company_name or not company_name.strip():
        return 'GC'  # Default fallback (GoCodes)
    
    trimmed = company_name.strip()
    
    # First, try splitting by spaces (multiple words)
    words = [w for w in trimmed.split() if w]
    
    if len(words) >= 2:
        # Multiple words: take first letter of first two words
        first = words[0][0].upper()
        second = words[1][0].upper()
        return f"{first}{second}"
    elif len(words) == 1:
        word = words[0]
        
        # Check for camelCase pattern - handles both "GoCodes" and "goCodes"
        # Pattern 1: Uppercase letter followed by lowercase, then uppercase (e.g., "GoCodes")
        match1 = re.match(r'^([A-Z][a-z]+)([A-Z][a-z]*)', word)
        if match1:
            first_part = match1.group(1)
            second_part = match1.group(2)
            return f"{first_part[0].upper()}{second_part[0].upper()}"
        
        # Pattern 2: Lowercase followed by uppercase (e.g., "goCodes")
        match2 = re.match(r'^([a-z]+)([A-Z][a-z]*)', word)
        if match2:
            first_part = match2.group(1)
            second_part = match2.group(2)
            return f"{first_part[0].upper()}{second_part[0].upper()}"
        
        # Check for all caps with word boundaries (e.g., "ABCCOMPANY" -> "AC")
        if word == word.upper() and len(word) > 2:
            first = word[0]
            for i in range(1, len(word)):
                if word[i].isalpha():
                    return f"{first}{word[i]}"
        
        # No camelCase detected: take first 2 letters
        return trimmed[:2].upper().ljust(2, 'X')
    
    return 'AD'  # Default fallback (Asset Dog)

router = APIRouter(prefix="/api/assets", tags=["assets"])

def parse_date(date_str: Optional[str]) -> Optional[datetime]:
    """Parse date string to datetime"""
    if not date_str:
        return None
    try:
        # Try ISO format first
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except:
        try:
            # Try common formats
            for fmt in ['%Y-%m-%d', '%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%dT%H:%M:%S.%f']:
                try:
                    return datetime.strptime(date_str, fmt)
                except:
                    continue
        except:
            pass
    return None

def build_search_conditions(search: str, search_fields: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    """Build search conditions for assets"""
    conditions = []
    
    # Default fields to search if not specified
    fields_to_search = search_fields or [
        'assetTagId', 'description', 'brand', 'model', 'serialNo', 'owner',
        'issuedTo', 'department', 'site', 'location'
    ]
    
    for field in fields_to_search:
        if field == 'assetTagId':
            conditions.append({"assetTagId": {"contains": search, "mode": "insensitive"}})
        elif field == 'description':
            conditions.append({"description": {"contains": search, "mode": "insensitive"}})
        elif field == 'brand':
            conditions.append({"brand": {"contains": search, "mode": "insensitive"}})
        elif field == 'model':
            conditions.append({"model": {"contains": search, "mode": "insensitive"}})
        elif field == 'serialNo':
            conditions.append({"serialNo": {"contains": search, "mode": "insensitive"}})
        elif field == 'owner':
            conditions.append({"owner": {"contains": search, "mode": "insensitive"}})
        elif field == 'issuedTo':
            conditions.append({"issuedTo": {"contains": search, "mode": "insensitive"}})
        elif field == 'department':
            conditions.append({"department": {"contains": search, "mode": "insensitive"}})
        elif field == 'site':
            conditions.append({"site": {"contains": search, "mode": "insensitive"}})
        elif field == 'location':
            conditions.append({"location": {"contains": search, "mode": "insensitive"}})
        elif field == 'category.name':
            conditions.append({"category": {"name": {"contains": search, "mode": "insensitive"}}})
        elif field == 'subCategory.name':
            conditions.append({"subCategory": {"name": {"contains": search, "mode": "insensitive"}}})
        elif field == 'status':
            conditions.append({"status": {"contains": search, "mode": "insensitive"}})
        elif field == 'purchasedFrom':
            conditions.append({"purchasedFrom": {"contains": search, "mode": "insensitive"}})
        elif field == 'additionalInformation':
            conditions.append({"additionalInformation": {"contains": search, "mode": "insensitive"}})
        elif field == 'xeroAssetNo':
            conditions.append({"xeroAssetNo": {"contains": search, "mode": "insensitive"}})
        elif field == 'pbiNumber':
            conditions.append({"pbiNumber": {"contains": search, "mode": "insensitive"}})
        elif field == 'poNumber':
            conditions.append({"poNumber": {"contains": search, "mode": "insensitive"}})
        elif field == 'paymentVoucherNumber':
            conditions.append({"paymentVoucherNumber": {"contains": search, "mode": "insensitive"}})
        elif field == 'assetType':
            conditions.append({"assetType": {"contains": search, "mode": "insensitive"}})
        elif field == 'remarks':
            conditions.append({"remarks": {"contains": search, "mode": "insensitive"}})
        elif field == 'qr':
            conditions.append({"qr": {"contains": search, "mode": "insensitive"}})
        elif field == 'oldAssetTag':
            conditions.append({"oldAssetTag": {"contains": search, "mode": "insensitive"}})
        elif field == 'depreciationMethod':
            conditions.append({"depreciationMethod": {"contains": search, "mode": "insensitive"}})
        elif field == 'checkouts.checkoutDate':
            search_date = parse_date(search)
            if search_date:
                start_of_day = search_date.replace(hour=0, minute=0, second=0, microsecond=0)
                end_of_day = search_date.replace(hour=23, minute=59, second=59, microsecond=999999)
                conditions.append({
                    "checkouts": {
                        "some": {
                            "checkoutDate": {
                                "gte": start_of_day,
                                "lte": end_of_day
                            }
                        }
                    }
                })
        elif field == 'checkouts.expectedReturnDate':
            search_date = parse_date(search)
            if search_date:
                start_of_day = search_date.replace(hour=0, minute=0, second=0, microsecond=0)
                end_of_day = search_date.replace(hour=23, minute=59, second=59, microsecond=999999)
                conditions.append({
                    "checkouts": {
                        "some": {
                            "expectedReturnDate": {
                                "gte": start_of_day,
                                "lte": end_of_day
                            }
                        }
                    }
                })
        elif field == 'auditHistory.auditDate':
            search_date = parse_date(search)
            if search_date:
                start_of_day = search_date.replace(hour=0, minute=0, second=0, microsecond=0)
                end_of_day = search_date.replace(hour=23, minute=59, second=59, microsecond=999999)
                conditions.append({
                    "auditHistory": {
                        "some": {
                            "auditDate": {
                                "gte": start_of_day,
                                "lte": end_of_day
                            }
                        }
                    }
                })
        elif field == 'auditHistory.auditType':
            conditions.append({"auditHistory": {"some": {"auditType": {"contains": search, "mode": "insensitive"}}}})
        elif field == 'auditHistory.auditor':
            conditions.append({"auditHistory": {"some": {"auditor": {"contains": search, "mode": "insensitive"}}}})
    
    # Add employee search if not filtering by specific fields or if employee fields are included
    if not search_fields or any(f for f in search_fields if 'employee' in f):
        conditions.extend([
            {"checkouts": {"some": {"employeeUser": {"name": {"contains": search, "mode": "insensitive"}}}}},
            {"checkouts": {"some": {"employeeUser": {"email": {"contains": search, "mode": "insensitive"}}}}}
        ])
    
    return conditions

def build_where_clause(
    search: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    include_deleted: bool = False,
    search_fields: Optional[str] = None
) -> Dict[str, Any]:
    """Build Prisma where clause for assets query"""
    where_clause: Dict[str, Any] = {}
    
    # Exclude soft-deleted assets by default
    if not include_deleted:
        where_clause["isDeleted"] = False
    
    # Search filter
    if search:
        search_field_list = search_fields.split(',') if search_fields else None
        search_conditions = build_search_conditions(search, search_field_list)
        if search_conditions:
            where_clause["OR"] = search_conditions
    
    # Category filter
    if category and category != 'all':
        where_clause["category"] = {
            "name": {"equals": category, "mode": "insensitive"}
        }
    
    # Status filter
    if status and status != 'all':
        where_clause["status"] = {"equals": status, "mode": "insensitive"}
    
    return where_clause


@router.post("/generate-tag", response_model=GenerateAssetTagResponse)
async def generate_asset_tag(
    request: GenerateAssetTagRequest,
    auth: dict = Depends(verify_auth)
):
    """Generate a unique asset tag with dynamic company suffix"""
    try:
        user_id = auth.get("user", {}).get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Get company info to extract initials
        company_info = await prisma.companyinfo.find_first(
            order={"createdAt": "desc"}
        )
        
        # Get company initials (e.g., "Go Codes" -> "GC")
        company_suffix = get_company_initials(company_info.companyName if company_info else None)
        
        # Get year (from purchase date or current year)
        if request.purchaseYear:
            year = str(request.purchaseYear)[-2:]  # Last 2 digits
        else:
            year = str(datetime.now().year)[-2:]
        
        # Generate unique tag (retry up to 100 times)
        attempts = 0
        generated_tag = ''
        is_unique = False
        
        while not is_unique and attempts < 100:
            # Generate 6-digit random number (000000-999999)
            random_num = str(random.randint(0, 999999)).zfill(6)
            
            # Build tag: YY-XXXXXX[S]-[COMPANY_INITIALS]
            generated_tag = f"{year}-{random_num}{request.subCategoryLetter}-{company_suffix}"
            
            # Check if tag exists
            exists = await prisma.assets.find_unique(
                where={"assetTagId": generated_tag}
            )
            
            if not exists:
                is_unique = True
            attempts += 1
        
        if not is_unique:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate unique asset tag after 100 attempts"
            )
        
        return GenerateAssetTagResponse(
            assetTagId=generated_tag,
            companySuffix=company_suffix
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating asset tag: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate asset tag")


@router.get("", response_model=Union[AssetsResponse, StatusesResponse, SummaryResponse])
async def get_assets(
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    withMaintenance: bool = Query(False),
    includeDeleted: bool = Query(False),
    page: int = Query(1, ge=1),
    pageSize: int = Query(50, ge=1, le=10000),
    searchFields: Optional[str] = Query(None),
    statuses: bool = Query(False, description="Return only unique statuses"),
    summary: bool = Query(False, description="Return only summary statistics"),
    auth: dict = Depends(verify_auth)
):
    """Get all assets with optional search filter and pagination"""
    try:
        user_id = auth.get("user", {}).get("id") or auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check permission
        has_permission = await check_permission(user_id, "canViewAssets")
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to view assets"
            )
        where_clause = build_where_clause(
            search=search,
            category=category,
            status=status,
            include_deleted=includeDeleted,
            search_fields=searchFields
        )
        
        skip = (page - 1) * pageSize
        
        # Check if unique statuses are requested
        if statuses:
            # Fetch all matching assets and extract unique statuses
            # Prisma Python doesn't support select, so we fetch all fields
            assets_with_status = await prisma.assets.find_many(
                where=where_clause
            )
            unique_statuses = sorted(list(set(
                asset.status for asset in assets_with_status if asset.status
            )))
            return StatusesResponse(statuses=unique_statuses)
        
        # Check if summary is requested
        if summary:
            total_assets = await prisma.assets.count(where=where_clause)
            # Fetch all matching assets to calculate sum (Prisma Python doesn't support select)
            assets_for_sum = await prisma.assets.find_many(
                where=where_clause
            )
            total_value = sum(
                float(asset.cost) if asset.cost is not None else 0.0
                for asset in assets_for_sum
            )
            available_assets = await prisma.assets.count(
                where={
                    **where_clause,
                    "status": {"equals": "Available", "mode": "insensitive"}
                }
            )
            checked_out_assets = await prisma.assets.count(
                where={
                    **where_clause,
                    "status": {"equals": "Checked out", "mode": "insensitive"}
                }
            )
            
            # Calculate value of checked out assets only
            checked_out_where = {
                **where_clause,
                "status": {"equals": "Checked out", "mode": "insensitive"}
            }
            checked_out_assets_for_value = await prisma.assets.find_many(
                where=checked_out_where
            )
            checked_out_value = sum(
                float(asset.cost) if asset.cost is not None else 0.0
                for asset in checked_out_assets_for_value
            )
            
            return SummaryResponse(
                summary=SummaryInfo(
                    totalAssets=total_assets,
                    totalValue=total_value,
                    availableAssets=available_assets,
                    checkedOutAssets=checked_out_assets,
                    checkedOutAssetsValue=checked_out_value
                )
            )
        
        # Optimize includes for deleted assets - they don't need heavy relations
        # For deleted assets, we only need basic info (category, subCategory)
        # For active assets, include all relations
        include_dict: Dict[str, Any] = {
            "category": True,
            "subCategory": True,
        }
        
        # Only include heavy relations for non-deleted assets or when specifically requested
        if not includeDeleted or withMaintenance:
            include_dict.update({
                "checkouts": {
                    "include": {
                        "employeeUser": True
                    }
                },
                "leases": {
                    "where": {
                        "OR": [
                            {"leaseEndDate": None},
                            {"leaseEndDate": {"gte": datetime.now()}}
                        ]
                    },
                    "include": {
                        "returns": True
                    }
                },
                "auditHistory": True,
            })
            if withMaintenance:
                include_dict["maintenances"] = {
                    "include": {
                        "inventoryItems": {
                            "include": {
                                "inventoryItem": True
                            }
                        }
                    }
                }
        
        # Get total count and assets in parallel
        total_count, assets_data = await asyncio.gather(
            prisma.assets.count(where=where_clause),
            prisma.assets.find_many(
                where=where_clause,
                include=include_dict,
                order=[{"createdAt": "desc"}, {"id": "desc"}],
                skip=skip,
                take=pageSize
            )
        )
        
        # Get image counts for all assets - optimized batch query
        assets_with_image_count = []
        image_counts = {}
        if assets_data:
            asset_tag_ids = [asset.assetTagId for asset in assets_data]
            # Batch fetch all image counts at once instead of individual queries
            if asset_tag_ids:
                all_images = await prisma.assetsimage.find_many(
                    where={"assetTagId": {"in": asset_tag_ids}}
                )
                # Count images per asset tag ID
                for asset_tag_id in asset_tag_ids:
                    image_counts[asset_tag_id] = sum(1 for img in all_images if img.assetTagId == asset_tag_id)
        
        # Convert to Asset models
        assets = []
        for asset_data in assets_data:
            try:
                # Convert related data
                category_info = None
                if asset_data.category:
                    category_info = CategoryInfo(
                        id=str(asset_data.category.id),
                        name=str(asset_data.category.name)
                    )
                
                sub_category_info = None
                if asset_data.subCategory:
                    sub_category_info = SubCategoryInfo(
                        id=str(asset_data.subCategory.id),
                        name=str(asset_data.subCategory.name)
                    )
                
                checkouts_list = []
                if hasattr(asset_data, 'checkouts') and asset_data.checkouts:
                    # Sort by checkoutDate descending and take only the first one
                    sorted_checkouts = sorted(
                        asset_data.checkouts,
                        key=lambda x: x.checkoutDate if x.checkoutDate else datetime.min,
                        reverse=True
                    )[:1]
                    for checkout in sorted_checkouts:
                        employee_info = None
                        if checkout.employeeUser:
                            employee_info = EmployeeInfo(
                                id=str(checkout.employeeUser.id),
                                name=str(checkout.employeeUser.name),
                                email=str(checkout.employeeUser.email)
                            )
                        checkouts_list.append(CheckoutInfo(
                            id=str(checkout.id),
                            checkoutDate=checkout.checkoutDate,
                            expectedReturnDate=checkout.expectedReturnDate,
                            employeeUser=employee_info
                        ))
                
                leases_list = []
                if hasattr(asset_data, 'leases') and asset_data.leases:
                    # Sort by leaseStartDate descending and take only the first one
                    sorted_leases = sorted(
                        asset_data.leases,
                        key=lambda x: x.leaseStartDate if x.leaseStartDate else datetime.min,
                        reverse=True
                    )[:1]
                    for lease in sorted_leases:
                        # Get first return if exists
                        first_return = None
                        if lease.returns and len(lease.returns) > 0:
                            first_return = lease.returns[0]
                        
                        leases_list.append(LeaseInfo(
                            id=str(lease.id),
                            leaseStartDate=lease.leaseStartDate,
                            leaseEndDate=lease.leaseEndDate,
                            lessee=lease.lessee
                        ))
                
                audit_history_list = []
                if hasattr(asset_data, 'auditHistory') and asset_data.auditHistory:
                    # Sort by auditDate descending and take only the first 5
                    sorted_audits = sorted(
                        asset_data.auditHistory,
                        key=lambda x: x.auditDate if x.auditDate else datetime.min,
                        reverse=True
                    )[:5]
                    for audit in sorted_audits:
                        audit_history_list.append(AuditHistoryInfo(
                            id=str(audit.id),
                            auditDate=audit.auditDate,
                            auditType=audit.auditType,
                            auditor=audit.auditor
                        ))
                
                asset = Asset(
                    id=str(asset_data.id),
                    assetTagId=str(asset_data.assetTagId),
                    description=str(asset_data.description),
                    purchasedFrom=asset_data.purchasedFrom,
                    purchaseDate=asset_data.purchaseDate,
                    brand=asset_data.brand,
                    cost=asset_data.cost,
                    model=asset_data.model,
                    serialNo=asset_data.serialNo,
                    additionalInformation=asset_data.additionalInformation,
                    xeroAssetNo=asset_data.xeroAssetNo,
                    owner=asset_data.owner,
                    pbiNumber=asset_data.pbiNumber,
                    status=asset_data.status,
                    issuedTo=asset_data.issuedTo,
                    poNumber=asset_data.poNumber,
                    paymentVoucherNumber=asset_data.paymentVoucherNumber,
                    assetType=asset_data.assetType,
                    deliveryDate=asset_data.deliveryDate,
                    unaccountedInventory=asset_data.unaccountedInventory,
                    remarks=asset_data.remarks,
                    qr=asset_data.qr,
                    oldAssetTag=asset_data.oldAssetTag,
                    depreciableAsset=asset_data.depreciableAsset,
                    depreciableCost=asset_data.depreciableCost,
                    salvageValue=asset_data.salvageValue,
                    assetLifeMonths=asset_data.assetLifeMonths,
                    depreciationMethod=asset_data.depreciationMethod,
                    dateAcquired=asset_data.dateAcquired,
                    categoryId=asset_data.categoryId,
                    category=category_info,
                    subCategoryId=asset_data.subCategoryId,
                    subCategory=sub_category_info,
                    department=asset_data.department,
                    site=asset_data.site,
                    location=asset_data.location,
                    createdAt=asset_data.createdAt,
                    updatedAt=asset_data.updatedAt,
                    deletedAt=asset_data.deletedAt,
                    isDeleted=asset_data.isDeleted,
                    checkouts=checkouts_list if checkouts_list else None,
                    leases=leases_list if leases_list else None,
                    auditHistory=audit_history_list if audit_history_list else None,
                    imagesCount=image_counts.get(asset_data.assetTagId, 0)
                )
                assets.append(asset)
            except Exception as e:
                logger.error(f"Error creating Asset model: {type(e).__name__}: {str(e)}", exc_info=True)
                continue
        
        # Calculate summary statistics in parallel
        # Fetch all matching assets to calculate sum (Prisma Python doesn't support select)
        assets_for_sum, available_assets, checked_out_assets = await asyncio.gather(
            prisma.assets.find_many(
                where=where_clause
            ),
            prisma.assets.count(
                where={
                    **where_clause,
                    "status": {"equals": "Available", "mode": "insensitive"}
                }
            ),
            prisma.assets.count(
                where={
                    **where_clause,
                    "status": {"equals": "Checked out", "mode": "insensitive"}
                }
            )
        )
        
        total_value = sum(
            float(asset.cost) if asset.cost is not None else 0.0
            for asset in assets_for_sum
        )
        total_pages = (total_count + pageSize - 1) // pageSize if total_count > 0 else 0
        
        return AssetsResponse(
            assets=assets,
            pagination=PaginationInfo(
                page=page,
                pageSize=pageSize,
                total=total_count,
                totalPages=total_pages
            ),
            summary=SummaryInfo(
                totalAssets=total_count,
                totalValue=total_value,
                availableAssets=available_assets,
                checkedOutAssets=checked_out_assets
            )
        )
    
    except Exception as e:
        logger.error(f"Error fetching assets: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch assets")


# Form PDF generation request model
from pydantic import BaseModel

class FormPDFRequest(BaseModel):
    html: Optional[str] = None
    url: Optional[str] = None
    elementId: Optional[str] = None
    elementIds: Optional[List[str]] = None


@router.post("/return-form/pdf")
async def generate_return_form_pdf(
    request: FormPDFRequest,
    auth: dict = Depends(verify_auth)
):
    """Generate PDF from return form HTML or URL using Playwright"""
    try:
        user_id = auth.get("user", {}).get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        if not request.html and not request.url:
            raise HTTPException(status_code=400, detail="HTML content or URL is required")
        
        # Support both single elementId and multiple elementIds
        target_ids = request.elementIds or ([request.elementId] if request.elementId else [])
        if len(target_ids) == 0:
            raise HTTPException(status_code=400, detail="Element ID(s) required")
        
        try:
            from utils.form_pdf_generator import generate_form_pdf
            
            pdf_data = await generate_form_pdf(
                html=request.html,
                url=request.url,
                element_ids=target_ids,
            )
            
            filename = "return-of-assets-combined.pdf" if len(target_ids) > 1 else "return-of-assets-it-copy.pdf"
            
            return Response(
                content=pdf_data,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"',
                    "Content-Length": str(len(pdf_data)),
                }
            )
        
        except ImportError as ie:
            logger.error(f"Playwright not available: {ie}")
            raise HTTPException(
                status_code=500, 
                detail="PDF generation not available. Please install playwright: pip install playwright && playwright install chromium"
            )
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating return form PDF: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to generate PDF: {str(e)}"
        )


@router.post("/accountability-form/pdf")
async def generate_accountability_form_pdf(
    request: FormPDFRequest,
    auth: dict = Depends(verify_auth)
):
    """Generate PDF from accountability form HTML or URL using Playwright"""
    try:
        user_id = auth.get("user", {}).get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        if not request.html and not request.url:
            raise HTTPException(status_code=400, detail="HTML content or URL is required")
        
        # Support both single elementId and multiple elementIds
        target_ids = request.elementIds or ([request.elementId] if request.elementId else [])
        if len(target_ids) == 0:
            raise HTTPException(status_code=400, detail="Element ID(s) required")
        
        try:
            from utils.form_pdf_generator import generate_form_pdf
            
            pdf_data = await generate_form_pdf(
                html=request.html,
                url=request.url,
                element_ids=target_ids,
            )
            
            filename = "accountability-form-combined.pdf" if len(target_ids) > 1 else "accountability-form.pdf"
            
            return Response(
                content=pdf_data,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"',
                    "Content-Length": str(len(pdf_data)),
                }
            )
        
        except ImportError as ie:
            logger.error(f"Playwright not available: {ie}")
            raise HTTPException(
                status_code=500, 
                detail="PDF generation not available. Please install playwright: pip install playwright && playwright install chromium"
            )
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating accountability form PDF: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to generate PDF: {str(e)}"
        )


@router.get("/{asset_id}/checkout")
async def get_asset_checkouts(
    asset_id: str = Path(..., description="Asset ID (UUID) or assetTagId"),
    auth: dict = Depends(verify_auth)
):
    """Get all checkout records for a specific asset"""
    try:
        # Check if it's a UUID or assetTagId
        is_id_uuid = is_uuid(asset_id)
        
        # Verify asset exists
        if is_id_uuid:
            asset = await prisma.assets.find_unique(where={"id": asset_id})
        else:
            asset = await prisma.assets.find_first(where={"assetTagId": asset_id, "isDeleted": False})
        
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        
        # Get all checkouts for this asset (use the actual asset.id)
        checkouts_data = await prisma.assetscheckout.find_many(
            where={"assetId": asset.id},
            include={
                "employeeUser": True,
                "checkins": True
            },
            order={"checkoutDate": "desc"}
        )
        
        # Format checkouts for response
        checkouts = []
        for checkout in checkouts_data:
            # Sort checkins by date descending and take the first one
            sorted_checkins = sorted(
                checkout.checkins or [],
                key=lambda x: x.checkinDate if hasattr(x, 'checkinDate') else datetime.min,
                reverse=True
            )[:1]
            
            checkout_dict = {
                "id": str(checkout.id),
                "assetId": str(checkout.assetId),
                "employeeUserId": str(checkout.employeeUserId) if checkout.employeeUserId else None,
                "checkoutDate": checkout.checkoutDate.isoformat() if hasattr(checkout.checkoutDate, 'isoformat') else str(checkout.checkoutDate),
                "expectedReturnDate": checkout.expectedReturnDate.isoformat() if checkout.expectedReturnDate and hasattr(checkout.expectedReturnDate, 'isoformat') else (str(checkout.expectedReturnDate) if checkout.expectedReturnDate else None),
                "createdAt": checkout.createdAt.isoformat() if hasattr(checkout.createdAt, 'isoformat') else str(checkout.createdAt),
                "updatedAt": checkout.updatedAt.isoformat() if hasattr(checkout.updatedAt, 'isoformat') else str(checkout.updatedAt),
                "employeeUser": {
                    "id": str(checkout.employeeUser.id),
                    "name": str(checkout.employeeUser.name),
                    "email": str(checkout.employeeUser.email)
                } if checkout.employeeUser else None,
                "checkins": [
                    {
                        "id": str(c.id),
                        "checkinDate": c.checkinDate.isoformat() if hasattr(c.checkinDate, 'isoformat') else str(c.checkinDate),
                    }
                    for c in sorted_checkins
                ]
            }
            checkouts.append(checkout_dict)
        
        return {"checkouts": checkouts}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching checkout records: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch checkout records")

@router.get("/{asset_id}/history")
async def get_asset_history(
    asset_id: str = Path(..., description="Asset ID (UUID) or assetTagId"),
    auth: dict = Depends(verify_auth)
):
    """Get all history logs for a specific asset"""
    try:
        # Check if it's a UUID or assetTagId
        is_id_uuid = is_uuid(asset_id)
        
        # Verify asset exists
        if is_id_uuid:
            asset = await prisma.assets.find_unique(where={"id": asset_id})
        else:
            asset = await prisma.assets.find_first(where={"assetTagId": asset_id, "isDeleted": False})
        
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        
        # Get all history logs for this asset (use the actual asset.id)
        logs_data = await prisma.assetshistorylogs.find_many(
            where={"assetId": asset.id},
            order={"eventDate": "desc"}
        )
        
        # Format logs for response
        logs = []
        for log in logs_data:
            log_dict = {
                "id": str(log.id),
                "assetId": str(log.assetId),
                "eventType": log.eventType,
                "field": log.field,
                "changeFrom": log.changeFrom,
                "changeTo": log.changeTo,
                "actionBy": log.actionBy,
                "eventDate": log.eventDate.isoformat() if hasattr(log.eventDate, 'isoformat') else str(log.eventDate),
                "createdAt": log.createdAt.isoformat() if hasattr(log.createdAt, 'isoformat') else str(log.createdAt),
                "notes": log.notes if hasattr(log, 'notes') else None,
                "status": log.status if hasattr(log, 'status') else None,
            }
            logs.append(log_dict)
        
        return {"logs": logs}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching history logs: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch history logs")

@router.post("/import")
async def import_assets(
    request: Request,
    auth: dict = Depends(verify_auth)
):
    """Import assets from Excel file"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check permission
        has_permission = await check_permission(user_id, "canManageImport")
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to import assets"
            )
        
        # Parse JSON body manually to ensure all fields are received
        body = await request.json()
        assets = body.get("assets", [])
        
        # Get user info for history logging
        user_metadata = auth.get("user_metadata", {})
        user_name = (
            user_metadata.get("name") or
            user_metadata.get("full_name") or
            auth.get("email", "").split("@")[0] if auth.get("email") else
            auth.get("user_id", "system")
        )
        
        if not assets or not isinstance(assets, list):
            raise HTTPException(status_code=400, detail="Invalid request body. Expected an array of assets.")
        
        # Validate that assets have required fields
        invalid_assets = [asset for asset in assets if not asset or not isinstance(asset, dict) or not asset.get("assetTagId") or (isinstance(asset.get("assetTagId"), str) and asset.get("assetTagId", "").strip() == "")]
        
        if invalid_assets:
            invalid_indices = [assets.index(asset) + 2 for asset in invalid_assets]  # +2 because row 1 is header
            raise HTTPException(
                status_code=400,
                detail=f"Invalid data format: {len(invalid_assets)} row(s) are missing required 'Asset Tag ID' field. Please ensure your Excel file has the correct column headers.",
                headers={"X-Invalid-Rows": ",".join(map(str, invalid_indices))}
            )
        
        # Pre-process: collect all unique categories, subcategories, locations, departments, and sites
        unique_categories = set()
        unique_subcategories = set()
        unique_locations = set()
        unique_departments = set()
        unique_sites = set()
        subcategory_to_category_map = {}
        
        for asset in assets:
            category_name = asset.get("category", "").strip() if asset.get("category") else None
            subcategory_name = asset.get("subCategory", "").strip() if asset.get("subCategory") else None
            
            if category_name:
                unique_categories.add(category_name)
            if subcategory_name:
                unique_subcategories.add(subcategory_name)
                if category_name and subcategory_name not in subcategory_to_category_map:
                    subcategory_to_category_map[subcategory_name] = category_name
            
            if asset.get("location"):
                unique_locations.add(asset.get("location", "").strip())
            if asset.get("department"):
                unique_departments.add(asset.get("department", "").strip())
            if asset.get("site"):
                unique_sites.add(asset.get("site", "").strip())
        
        # Batch create categories
        category_map = {}
        if unique_categories:
            category_names_list = list(unique_categories)
            existing_categories = await prisma.category.find_many(
                where={"name": {"in": category_names_list}}
            )
            for cat in existing_categories:
                category_map[cat.name] = str(cat.id)
            
            missing_categories = [name for name in category_names_list if name not in category_map]
            if missing_categories:
                # Batch create missing categories
                try:
                    categories_to_create = [
                        {"name": name, "description": "Auto-created during import"}
                        for name in missing_categories
                    ]
                    await prisma.category.create_many(
                        data=categories_to_create,
                        skip_duplicates=True
                    )
                    # Fetch all created categories (including ones that might have existed)
                    created_categories = await prisma.category.find_many(
                        where={"name": {"in": missing_categories}}
                    )
                    for cat in created_categories:
                        category_map[cat.name] = str(cat.id)
                except Exception as e:
                    logger.warning(f"Error batch creating categories: {e}, falling back to individual creates")
                    # Fallback: create one by one
                    for name in missing_categories:
                        try:
                            new_cat = await prisma.category.create(
                                data={"name": name, "description": "Auto-created during import"}
                            )
                            category_map[name] = str(new_cat.id)
                        except Exception:
                            existing = await prisma.category.find_first(where={"name": name})
                            if existing:
                                category_map[name] = str(existing.id)
        
        # Batch create subcategories
        subcategory_map = {}
        if unique_subcategories:
            subcategory_names_list = list(unique_subcategories)
            existing_subcategories = await prisma.subcategory.find_many(
                where={"name": {"in": subcategory_names_list}},
                include={"category": True}
            )
            
            for subcat in existing_subcategories:
                expected_parent = subcategory_to_category_map.get(subcat.name)
                if not expected_parent or subcat.category.name == expected_parent:
                    subcategory_map[subcat.name] = str(subcat.id)
            
            missing_subcategories = [name for name in subcategory_names_list if name not in subcategory_map]
            if missing_subcategories:
                # Group by parent category
                subcategories_by_category = {}
                for subcat_name in missing_subcategories:
                    parent_category_name = subcategory_to_category_map.get(subcat_name)
                    if parent_category_name and parent_category_name in category_map:
                        category_id = category_map[parent_category_name]
                        if category_id not in subcategories_by_category:
                            subcategories_by_category[category_id] = []
                        subcategories_by_category[category_id].append(subcat_name)
                    else:
                        # Use default category
                        default_key = "default"
                        if default_key not in subcategories_by_category:
                            subcategories_by_category[default_key] = []
                        subcategories_by_category[default_key].append(subcat_name)
                
                # Get or create default category
                default_category_id = None
                if "default" in subcategories_by_category:
                    default_category = await prisma.category.find_first()
                    if not default_category:
                        default_category = await prisma.category.create(
                            data={"name": "Default", "description": "Default category for subcategories without parent"}
                        )
                    default_category_id = str(default_category.id)
                
                # Batch create subcategories by category
                for category_id_or_default, subcat_names in subcategories_by_category.items():
                    parent_id = default_category_id if category_id_or_default == "default" else category_id_or_default
                    if parent_id and subcat_names:
                        try:
                            subcategories_to_create = [
                                {
                                    "name": subcat_name,
                                    "description": "Auto-created during import",
                                    "categoryId": parent_id
                                }
                                for subcat_name in subcat_names
                            ]
                            await prisma.subcategory.create_many(
                                data=subcategories_to_create,
                                skip_duplicates=True
                            )
                            # Fetch all created subcategories
                            created_subcats = await prisma.subcategory.find_many(
                                where={"name": {"in": subcat_names}}
                            )
                            for subcat in created_subcats:
                                subcategory_map[subcat.name] = str(subcat.id)
                        except Exception as e:
                            logger.warning(f"Error batch creating subcategories: {e}, falling back to individual creates")
                            # Fallback: create one by one
                            for subcat_name in subcat_names:
                                try:
                                    new_subcat = await prisma.subcategory.create(
                                        data={
                                            "name": subcat_name,
                                            "description": "Auto-created during import",
                                            "categoryId": parent_id
                                        }
                                    )
                                    subcategory_map[subcat_name] = str(new_subcat.id)
                                except Exception:
                                    existing = await prisma.subcategory.find_first(where={"name": subcat_name})
                                    if existing:
                                        subcategory_map[subcat_name] = str(existing.id)
        
        # Batch create locations
        location_map = {}
        if unique_locations:
            location_names_list = list(unique_locations)
            existing_locations = await prisma.assetslocation.find_many(
                where={"name": {"in": location_names_list}}
            )
            for loc in existing_locations:
                location_map[loc.name] = str(loc.id)
            
            missing_locations = [name for name in location_names_list if name not in location_map]
            if missing_locations:
                try:
                    locations_to_create = [
                        {"name": name, "description": "Auto-created during import"}
                        for name in missing_locations
                    ]
                    await prisma.assetslocation.create_many(
                        data=locations_to_create,
                        skip_duplicates=True
                    )
                    created_locations = await prisma.assetslocation.find_many(
                        where={"name": {"in": missing_locations}}
                    )
                    for loc in created_locations:
                        location_map[loc.name] = str(loc.id)
                except Exception as e:
                    logger.warning(f"Error batch creating locations: {e}, falling back to individual creates")
                    for name in missing_locations:
                        try:
                            new_loc = await prisma.assetslocation.create(
                                data={"name": name, "description": "Auto-created during import"}
                            )
                            location_map[name] = str(new_loc.id)
                        except Exception:
                            existing = await prisma.assetslocation.find_first(where={"name": name})
                            if existing:
                                location_map[name] = str(existing.id)
        
        # Batch create departments
        department_map = {}
        if unique_departments:
            department_names_list = list(unique_departments)
            existing_departments = await prisma.assetsdepartment.find_many(
                where={"name": {"in": department_names_list}}
            )
            for dept in existing_departments:
                department_map[dept.name] = str(dept.id)
            
            missing_departments = [name for name in department_names_list if name not in department_map]
            if missing_departments:
                try:
                    departments_to_create = [
                        {"name": name, "description": "Auto-created during import"}
                        for name in missing_departments
                    ]
                    await prisma.assetsdepartment.create_many(
                        data=departments_to_create,
                        skip_duplicates=True
                    )
                    created_departments = await prisma.assetsdepartment.find_many(
                        where={"name": {"in": missing_departments}}
                    )
                    for dept in created_departments:
                        department_map[dept.name] = str(dept.id)
                except Exception as e:
                    logger.warning(f"Error batch creating departments: {e}, falling back to individual creates")
                    for name in missing_departments:
                        try:
                            new_dept = await prisma.assetsdepartment.create(
                                data={"name": name, "description": "Auto-created during import"}
                            )
                            department_map[name] = str(new_dept.id)
                        except Exception:
                            existing = await prisma.assetsdepartment.find_first(where={"name": name})
                            if existing:
                                department_map[name] = str(existing.id)
        
        # Batch create sites
        site_map = {}
        if unique_sites:
            site_names_list = list(unique_sites)
            existing_sites = await prisma.assetssite.find_many(
                where={"name": {"in": site_names_list}}
            )
            for site in existing_sites:
                site_map[site.name] = str(site.id)
            
            missing_sites = [name for name in site_names_list if name not in site_map]
            if missing_sites:
                try:
                    sites_to_create = [
                        {"name": name, "description": "Auto-created during import"}
                        for name in missing_sites
                    ]
                    await prisma.assetssite.create_many(
                        data=sites_to_create,
                        skip_duplicates=True
                    )
                    created_sites = await prisma.assetssite.find_many(
                        where={"name": {"in": missing_sites}}
                    )
                    for site in created_sites:
                        site_map[site.name] = str(site.id)
                except Exception as e:
                    logger.warning(f"Error batch creating sites: {e}, falling back to individual creates")
                    for name in missing_sites:
                        try:
                            new_site = await prisma.assetssite.create(
                                data={"name": name, "description": "Auto-created during import"}
                            )
                            site_map[name] = str(new_site.id)
                        except Exception:
                            existing = await prisma.assetssite.find_first(where={"name": name})
                            if existing:
                                site_map[name] = str(existing.id)
        
        # Check for existing assets
        asset_tag_ids = [asset.get("assetTagId") for asset in assets if asset.get("assetTagId") and isinstance(asset.get("assetTagId"), str)]
        
        if not asset_tag_ids:
            raise HTTPException(status_code=400, detail="No valid Asset Tag IDs found in the import file. Please check your Excel file format.")
        
        existing_assets = await prisma.assets.find_many(
            where={"assetTagId": {"in": asset_tag_ids}}
        )
        
        existing_asset_tags = {asset.assetTagId for asset in existing_assets}
        deleted_asset_tags = {asset.assetTagId for asset in existing_assets if asset.isDeleted}
        
        # Helper functions
        def parse_number(value: Any) -> Optional[float]:
            if value is None or value == "":
                return None
            try:
                if isinstance(value, str):
                    value = value.replace(",", "")
                num = float(value)
                return num if not (num != num) else None  # Check for NaN
            except (ValueError, TypeError):
                return None
        
        def parse_boolean(value: Any) -> Optional[bool]:
            if value is None or value == "":
                return None
            if isinstance(value, bool):
                return value
            if isinstance(value, str):
                lower = value.lower().strip()
                if lower in ["true", "yes", "1"]:
                    return True
                if lower in ["false", "no", "0"]:
                    return False
            return bool(value) if value else None
        
        # Prepare data for batch insert
        assets_to_create = []
        for asset in assets:
            asset_tag_id = asset.get("assetTagId")
            if not asset_tag_id or asset_tag_id in existing_asset_tags:
                continue
            
            category_id = None
            if asset.get("category"):
                category_id = category_map.get(asset.get("category"))
            elif asset.get("categoryId"):
                category_id = asset.get("categoryId")
            
            subcategory_id = None
            if asset.get("subCategory"):
                subcategory_id = subcategory_map.get(asset.get("subCategory"))
            elif asset.get("subCategoryId"):
                subcategory_id = asset.get("subCategoryId")
            
            asset_data = {
                "assetTagId": asset_tag_id,
                "description": asset.get("description") or "",
                "purchasedFrom": asset.get("purchasedFrom"),
                "purchaseDate": parse_date(asset.get("purchaseDate")),
                "brand": asset.get("brand"),
                "cost": parse_number(asset.get("cost")),
                "model": asset.get("model"),
                "serialNo": asset.get("serialNo"),
                "additionalInformation": asset.get("additionalInformation"),
                "xeroAssetNo": asset.get("xeroAssetNo"),
                "owner": asset.get("owner"),
                "pbiNumber": asset.get("pbiNumber"),
                "status": asset.get("status"),
                "issuedTo": asset.get("issuedTo"),
                "poNumber": asset.get("poNumber"),
                "paymentVoucherNumber": asset.get("paymentVoucherNumber"),
                "assetType": asset.get("assetType"),
                "deliveryDate": parse_date(asset.get("deliveryDate")),
                "unaccountedInventory": parse_boolean(asset.get("unaccountedInventory") or asset.get("unaccounted2021Inventory")),
                "remarks": asset.get("remarks"),
                "qr": asset.get("qr"),
                "oldAssetTag": asset.get("oldAssetTag"),
                "depreciableAsset": parse_boolean(asset.get("depreciableAsset")) or False,
                "depreciableCost": parse_number(asset.get("depreciableCost")),
                "salvageValue": parse_number(asset.get("salvageValue")),
                "assetLifeMonths": int(asset.get("assetLifeMonths")) if asset.get("assetLifeMonths") else None,
                "depreciationMethod": asset.get("depreciationMethod"),
                "dateAcquired": parse_date(asset.get("dateAcquired")),
                "categoryId": category_id,
                "subCategoryId": subcategory_id,
                "department": asset.get("department"),
                "site": asset.get("site"),
                "location": asset.get("location"),
            }
            assets_to_create.append(asset_data)
        
        # Prepare all related data before transaction
        # Map asset tag IDs to their data for quick lookup
        asset_data_map = {a["assetTagId"]: a for a in assets_to_create}
        
        # Pre-process audit and checkout data
        assets_with_audit = [
            asset for asset in assets
            if asset.get("assetTagId") and asset.get("assetTagId") not in existing_asset_tags
            and (asset.get("lastAuditDate") or asset.get("lastAuditType") or asset.get("lastAuditor"))
        ]
        audit_data_map = {a.get("assetTagId"): a for a in assets_with_audit}
        
        checkout_statuses = ["checked out", "checked-out", "checkedout", "in use"]
        checkout_asset_tag_ids = {
            a["assetTagId"] for a in assets_to_create
            if a.get("status") and a.get("status", "").lower().strip() in checkout_statuses
        }
        
        # Batch insert assets and all related records in a single transaction
        created_count = 0
        if assets_to_create:
            try:
                # Use transaction to batch everything together
                async with prisma.tx() as transaction:
                    # 1. Batch create assets
                    created_count = await transaction.assets.create_many(
                        data=assets_to_create,
                        skip_duplicates=True
                    )
                    
                    # 2. Fetch created assets once (needed for IDs)
                    created_asset_tag_ids = [a["assetTagId"] for a in assets_to_create]
                    created_assets = await transaction.assets.find_many(
                        where={"assetTagId": {"in": created_asset_tag_ids}}
                    )
                    
                    # Build lookup maps
                    asset_id_map = {a.assetTagId: str(a.id) for a in created_assets}
                    asset_created_at_map = {a.assetTagId: a.createdAt for a in created_assets}
                    
                    # 3. Batch create history logs (all at once)
                    history_logs_to_create = [
                        {
                            "assetId": asset_id_map[tag_id],
                            "eventType": "added",
                            "actionBy": user_name,
                            "eventDate": asset_created_at_map[tag_id],
                        }
                        for tag_id in asset_id_map.keys()
                    ]
                    if history_logs_to_create:
                        await transaction.assetshistorylogs.create_many(
                            data=history_logs_to_create,
                            skip_duplicates=True
                        )
                    
                    # 4. Batch create audit records (all at once)
                    audit_records_to_create = []
                    for tag_id, asset in audit_data_map.items():
                        asset_id = asset_id_map.get(tag_id)
                        if not asset_id:
                            continue
                        
                        audit_date = None
                        if asset.get("lastAuditDate"):
                            if isinstance(asset.get("lastAuditDate"), datetime):
                                audit_date = asset.get("lastAuditDate")
                            else:
                                audit_date = parse_date(asset.get("lastAuditDate")) or datetime.now()
                        else:
                            audit_date = datetime.now()
                        
                        if not asset.get("lastAuditDate") and not asset.get("lastAuditType"):
                            continue
                        
                        audit_records_to_create.append({
                            "assetId": asset_id,
                            "auditType": asset.get("lastAuditType") or "Imported Audit",
                            "auditDate": audit_date,
                            "auditor": asset.get("lastAuditor"),
                            "status": "Completed",
                            "notes": "Imported from Excel file",
                        })
                    
                    if audit_records_to_create:
                        await transaction.assetsaudithistory.create_many(
                            data=audit_records_to_create,
                            skip_duplicates=True
                        )
                    
                    # 5. Batch create checkout records (all at once)
                    checkout_records_to_create = []
                    for tag_id in checkout_asset_tag_ids:
                        asset_id = asset_id_map.get(tag_id)
                        if not asset_id:
                            continue
                        
                        asset_data = asset_data_map.get(tag_id, {})
                        checkout_date = asset_data.get("deliveryDate") or asset_data.get("purchaseDate") or datetime.now()
                        if not isinstance(checkout_date, datetime):
                            checkout_date = parse_date(checkout_date) or datetime.now()
                        
                        checkout_records_to_create.append({
                            "assetId": asset_id,
                            "employeeUserId": None,
                            "checkoutDate": checkout_date,
                            "expectedReturnDate": None,
                        })
                    
                    if checkout_records_to_create:
                        await transaction.assetscheckout.create_many(
                            data=checkout_records_to_create,
                            skip_duplicates=True
                        )
                    
            except Exception as e:
                logger.error(f"Error in transaction batch create: {e}", exc_info=True)
                # Fallback: try without transaction (slower but works)
                try:
                    created_count = await prisma.assets.create_many(
                        data=assets_to_create,
                        skip_duplicates=True
                    )
                    
                    # Fetch created assets once
                    created_asset_tag_ids = [a["assetTagId"] for a in assets_to_create]
                    created_assets = await prisma.assets.find_many(
                        where={"assetTagId": {"in": created_asset_tag_ids}}
                    )
                    asset_id_map = {a.assetTagId: str(a.id) for a in created_assets}
                    asset_created_at_map = {a.assetTagId: a.createdAt for a in created_assets}
                    
                    # Create history logs
                    history_logs_to_create = [
                        {
                            "assetId": asset_id_map[tag_id],
                            "eventType": "added",
                            "actionBy": user_name,
                            "eventDate": asset_created_at_map[tag_id],
                        }
                        for tag_id in asset_id_map.keys()
                    ]
                    if history_logs_to_create:
                        await prisma.assetshistorylogs.create_many(
                            data=history_logs_to_create,
                            skip_duplicates=True
                        )
                    
                    # Create audit records
                    audit_records_to_create = []
                    for tag_id, asset in audit_data_map.items():
                        asset_id = asset_id_map.get(tag_id)
                        if not asset_id:
                            continue
                        audit_date = parse_date(asset.get("lastAuditDate")) if asset.get("lastAuditDate") else datetime.now()
                        if asset.get("lastAuditDate") or asset.get("lastAuditType"):
                            audit_records_to_create.append({
                                "assetId": asset_id,
                                "auditType": asset.get("lastAuditType") or "Imported Audit",
                                "auditDate": audit_date,
                                "auditor": asset.get("lastAuditor"),
                                "status": "Completed",
                                "notes": "Imported from Excel file",
                            })
                    if audit_records_to_create:
                        await prisma.assetsaudithistory.create_many(
                            data=audit_records_to_create,
                            skip_duplicates=True
                        )
                    
                    # Create checkout records
                    checkout_records_to_create = []
                    for tag_id in checkout_asset_tag_ids:
                        asset_id = asset_id_map.get(tag_id)
                        if not asset_id:
                            continue
                        asset_data = asset_data_map.get(tag_id, {})
                        checkout_date = asset_data.get("deliveryDate") or asset_data.get("purchaseDate") or datetime.now()
                        if not isinstance(checkout_date, datetime):
                            checkout_date = parse_date(checkout_date) or datetime.now()
                        checkout_records_to_create.append({
                            "assetId": asset_id,
                            "employeeUserId": None,
                            "checkoutDate": checkout_date,
                            "expectedReturnDate": None,
                        })
                    if checkout_records_to_create:
                        await prisma.assetscheckout.create_many(
                            data=checkout_records_to_create,
                            skip_duplicates=True
                        )
                except Exception as fallback_error:
                    logger.error(f"Error in fallback batch create: {fallback_error}", exc_info=True)
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to import assets: {str(fallback_error)}"
                    )
        
        # Process image and document URLs from import
        # Download and upload to Supabase storage, then create records
        if created_count > 0:
            try:
                # Get created assets for URL processing
                created_asset_tag_ids = [a["assetTagId"] for a in assets_to_create]
                created_assets_for_urls = await prisma.assets.find_many(
                    where={"assetTagId": {"in": created_asset_tag_ids}}
                )
                asset_tag_to_id_map = {a.assetTagId: str(a.id) for a in created_assets_for_urls}
                
                # Process images and documents
                supabase_admin = get_supabase_admin_client()
                images_to_create = []
                documents_to_create = []
                
                async def download_and_upload_file(url: str, asset_tag_id: str, file_type: str) -> Optional[str]:
                    """Download file from URL and upload to Supabase storage"""
                    try:
                        # Validate URL
                        if not url or not isinstance(url, str) or not url.startswith('http'):
                            return None
                        
                        # Check if URL is already in our Supabase storage
                        if 'supabase.co/storage/v1/object/public' in url:
                            # Extract path from existing Supabase URL
                            url_match = re.search(r'/storage/v1/object/public/([^/]+)/(.+)', url)
                            if url_match:
                                bucket = url_match.group(1)
                                existing_path = url_match.group(2)
                                
                                # Check if file exists in storage
                                try:
                                    folder_path = existing_path.rsplit('/', 1)[0] if '/' in existing_path else ''
                                    file_info = supabase_admin.storage.from_(bucket).list(
                                        folder_path,
                                        {"limit": 1000}
                                    )
                                    file_name = existing_path.split('/')[-1]
                                    if file_info:
                                        for f in file_info:
                                            if f.get('name') == file_name:
                                                # File exists, return the URL
                                                return url
                                except Exception:
                                    pass
                        
                        # Download file
                        async with httpx.AsyncClient(timeout=30.0) as client:
                            response = await client.get(url)
                            if response.status_code != 200:
                                logger.warning(f"Failed to download file from {url}: Status {response.status_code}")
                                return None
                            
                            file_content = response.content
                            file_size = len(file_content)
                            
                            # Validate file size (max 5MB)
                            max_size = 5 * 1024 * 1024
                            if file_size > max_size:
                                logger.warning(f"File from {url} is too large: {file_size} bytes")
                                return None
                            
                            # Determine content type
                            content_type = response.headers.get('content-type', 'application/octet-stream')
                            
                            # Extract file extension from URL
                            parsed_url = urlparse(url)
                            file_name_from_url = os.path.basename(parsed_url.path)
                            file_extension = os.path.splitext(file_name_from_url)[1] or ('.jpg' if 'image' in content_type else '.pdf')
                            sanitized_extension = file_extension.lower().lstrip('.')
                            
                            # Generate unique file path
                            timestamp = datetime.now().isoformat().replace(':', '-').replace('.', '-')
                            
                            if file_type == 'image':
                                folder = 'assets_images'
                                file_name = f"{asset_tag_id}-{timestamp}.{sanitized_extension}"
                            else:  # document
                                folder = 'assets_documents'
                                file_name = f"{asset_tag_id}-{timestamp}.{sanitized_extension}"
                            
                            file_path = f"{folder}/{file_name}"
                            
                            # Upload to Supabase storage
                            try:
                                upload_response = supabase_admin.storage.from_('assets').upload(
                                    file_path,
                                    file_content,
                                    file_options={"content-type": content_type, "upsert": "false"}
                                )
                                
                                if upload_response and (not isinstance(upload_response, dict) or not upload_response.get('error')):
                                    url_data = supabase_admin.storage.from_('assets').get_public_url(file_path)
                                    public_url = url_data.get('publicUrl', '') if isinstance(url_data, dict) else str(url_data)
                                    return public_url
                                else:
                                    logger.warning(f"Failed to upload file to storage: {upload_response}")
                                    return None
                            except Exception as upload_error:
                                logger.warning(f"Error uploading file to storage: {upload_error}")
                                return None
                    
                    except Exception as e:
                        logger.warning(f"Error downloading/uploading file from {url}: {e}")
                        return None
                
                # Process images and documents from import data
                for asset in assets:
                    asset_tag_id = asset.get("assetTagId")
                    if not asset_tag_id or asset_tag_id not in asset_tag_to_id_map:
                        continue
                    
                    # Check for image URLs (try multiple field names, handle comma/semicolon separated)
                    images_field = asset.get("images") or asset.get("imageUrl") or asset.get("image") or asset.get("imageURL") or asset.get("image_url")
                    if images_field:
                        # Handle multiple URLs separated by comma or semicolon
                        image_urls = []
                        if isinstance(images_field, str):
                            # Split by comma or semicolon
                            image_urls = [url.strip() for url in re.split(r'[,;]', images_field) if url.strip()]
                        elif isinstance(images_field, list):
                            image_urls = [str(url).strip() for url in images_field if url]
                        
                        for image_url in image_urls:
                            if not image_url or not image_url.startswith('http'):
                                continue
                            
                            uploaded_url = await download_and_upload_file(image_url, asset_tag_id, 'image')
                            if uploaded_url:
                                # Determine image type
                                url_extension = uploaded_url.split('.')[-1].split('?')[0].lower() if '.' in uploaded_url else None
                                image_type = f"image/{url_extension}" if url_extension else "image/jpeg"
                                if image_type == "image/jpg":
                                    image_type = "image/jpeg"
                                
                                images_to_create.append({
                                    "assetTagId": asset_tag_id,
                                    "imageUrl": uploaded_url,
                                    "imageType": image_type,
                                    "imageSize": None,  # Could fetch from storage if needed
                                })
                            else:
                                logger.warning(f"Failed to upload image for {asset_tag_id} from {image_url[:100]}...")
                    
                    # Check for document URLs (try multiple field names, handle comma/semicolon separated)
                    # Try various field name variations (case-insensitive check)
                    documents_field = None
                    for key in asset.keys():
                        key_lower = key.lower()
                        if key_lower in ['documents', 'documenturl', 'document', 'document_url']:
                            value = asset.get(key)
                            if value and (isinstance(value, str) and value.strip()) or isinstance(value, list) and value:
                                documents_field = value
                                break
                    
                    # Handle multiple document URLs separated by comma or semicolon
                    document_urls = []
                    if documents_field:
                        if isinstance(documents_field, str):
                            # Split by comma or semicolon
                            document_urls = [url.strip() for url in re.split(r'[,;]', documents_field) if url.strip()]
                        elif isinstance(documents_field, list):
                            document_urls = [str(url).strip() for url in documents_field if url]
                    
                    for document_url in document_urls:
                        if not document_url or not document_url.startswith('http'):
                            continue
                        
                        uploaded_url = await download_and_upload_file(document_url, asset_tag_id, 'document')
                        if uploaded_url:
                            # Determine document type
                            url_extension = uploaded_url.split('.')[-1].split('?')[0].lower() if '.' in uploaded_url else None
                            mime_type_map = {
                                'pdf': 'application/pdf',
                                'doc': 'application/msword',
                                'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                                'xls': 'application/vnd.ms-excel',
                                'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                                'txt': 'text/plain',
                                'csv': 'text/csv',
                                'rtf': 'application/rtf',
                            }
                            mime_type = mime_type_map.get(url_extension, 'application/octet-stream')
                            
                            documents_to_create.append({
                                "assetTagId": asset_tag_id,
                                "documentUrl": uploaded_url,
                                "documentType": asset.get("documentType"),
                                "fileName": os.path.basename(urlparse(uploaded_url).path),
                                "mimeType": mime_type,
                            })
                        else:
                            logger.warning(f"Failed to upload document for {asset_tag_id} from {document_url[:100]}...")
                
                # Batch create image and document records
                if images_to_create:
                    try:
                        result = await prisma.assetsimage.create_many(
                            data=images_to_create,
                            skip_duplicates=True
                        )
                        logger.info(f"Created {result} image records")
                    except Exception as e:
                        logger.error(f"Error creating image records: {e}", exc_info=True)
                
                if documents_to_create:
                    try:
                        result = await prisma.assetsdocument.create_many(
                            data=documents_to_create,
                            skip_duplicates=True
                        )
                        logger.info(f"Created {result} document records")
                    except Exception as e:
                        logger.error(f"Error creating document records: {e}", exc_info=True)
            
            except Exception as url_error:
                # Don't fail the import if URL processing fails
                logger.warning(f"Error processing image/document URLs during import: {url_error}")
        
        # Prepare results
        results = []
        for asset in assets:
            asset_tag_id = asset.get("assetTagId")
            if not asset_tag_id:
                continue
            
            if asset_tag_id in existing_asset_tags:
                if asset_tag_id in deleted_asset_tags:
                    results.append({"asset": asset_tag_id, "action": "skipped", "reason": "Asset exists in trash"})
                else:
                    results.append({"asset": asset_tag_id, "action": "skipped", "reason": "Duplicate asset tag"})
            else:
                results.append({"asset": asset_tag_id, "action": "created"})
        
        return {
            "message": "Assets imported successfully",
            "results": results,
            "summary": {
                "total": len(assets),
                "created": created_count,
                "skipped": len(assets) - created_count
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        error_message = str(e)
        logger.error(f"Error importing assets: {error_message}", exc_info=True)
        
        if "Unique constraint" in error_message or "duplicate" in error_message.lower():
            raise HTTPException(status_code=400, detail="Duplicate asset detected. Please ensure all Asset Tag IDs are unique.")
        if "Foreign key constraint" in error_message:
            raise HTTPException(status_code=400, detail="Invalid category or subcategory reference. Please check your category names.")
        if "Invalid value" in error_message:
            raise HTTPException(status_code=400, detail="Invalid data format. Please check your Excel file columns match the expected format.")
        
        raise HTTPException(
            status_code=500,
            detail="Failed to import assets. Please ensure your Excel file has the correct column headers and data format."
        )


# Helper functions for documents
def get_supabase_admin_client() -> Client:
    """Get Supabase admin client for storage operations"""
    supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_service_key:
        raise HTTPException(
            status_code=500,
            detail="Supabase service role key not configured"
        )
    return create_client(SUPABASE_URL, supabase_service_key)


async def check_permission(user_id: str, permission: str) -> bool:
    """Check if user has a specific permission"""
    try:
        asset_user = await prisma.assetuser.find_unique(
            where={"userId": user_id}
        )
        if not asset_user or not asset_user.isActive:
            return False
        
        # Admins have all permissions
        if asset_user.role == "admin":
            return True
        
        return getattr(asset_user, permission, False)
    except Exception:
        return False


# Document routes - must be registered before /{asset_id} route
@router.get("/documents")
async def get_documents(
    page: int = Query(1, ge=1),
    pageSize: int = Query(50, ge=1, le=1000),
    auth: dict = Depends(verify_auth)
):
    """Get all documents with pagination"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Allow viewing documents without canManageMedia permission
        # Users can view but actions (upload/delete) are controlled by client-side checks
        
        supabase_admin = get_supabase_admin_client()
        
        # Helper function to recursively list all files in a folder
        async def list_all_files(bucket: str, folder: str = "") -> List[Dict[str, Any]]:
            all_files: List[Dict[str, Any]] = []
            
            try:
                response = supabase_admin.storage.from_(bucket).list(folder, {
                    "limit": 1000
                })
                
                if not response:
                    return all_files
                
                for item in response:
                    item_path = f"{folder}/{item['name']}" if folder else item['name']
                    
                    # Check if it's a folder by checking if id is missing
                    is_folder = item.get('id') is None
                    
                    if is_folder:
                        # It's a folder, recursively list files inside
                        sub_files = await list_all_files(bucket, item_path)
                        all_files.extend(sub_files)
                    else:
                        # Include all files
                        all_files.append({
                            "name": item['name'],
                            "id": item.get('id') or item_path,
                            "created_at": item.get('created_at') or datetime.now().isoformat(),
                            "path": item_path,
                            "metadata": item.get('metadata', {})
                        })
            except Exception as e:
                logger.warning(f"Error listing files from {bucket}/{folder}: {e}")
            
            return all_files
        
        # Fetch fresh file list
        # List files from assets_documents folder in assets bucket
        assets_files = await list_all_files('assets', 'assets_documents')
        
        # List files from assets_documents folder in file-history bucket
        file_history_files = await list_all_files('file-history', 'assets/assets_documents')
        
        # Combine files from both buckets
        combined_files: List[Dict[str, Any]] = []
        
        # Add files from assets bucket (only from assets_documents folder)
        for file in assets_files:
            if file['path'].startswith('assets_documents/') and not file['path'].startswith('assets_images/'):
                combined_files.append({
                    **file,
                    "bucket": 'assets',
                })
        
        # Add files from file-history bucket (only from assets/assets_documents folder)
        for file in file_history_files:
            if file['path'].startswith('assets/assets_documents/') and not file['path'].startswith('assets/assets_images/'):
                combined_files.append({
                    **file,
                    "bucket": 'file-history',
                })
        
        # Sort by created_at descending
        combined_files.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        # Paginate
        total_count = len(combined_files)
        skip = (page - 1) * pageSize
        paginated_files = combined_files[skip:skip + pageSize]
        
        # Prepare all file data and extract URLs/assetTagIds
        file_data = []
        for file in paginated_files:
            try:
                url_data = supabase_admin.storage.from_(file['bucket']).get_public_url(file['path'])
                public_url = url_data if isinstance(url_data, str) else url_data.get('publicUrl', '') if isinstance(url_data, dict) else ''
                
                # Extract full filename and assetTagId
                path_parts = file['path'].split('/')
                actual_file_name = path_parts[-1]
                
                # Extract assetTagId - filename format is: assetTagId-timestamp.ext
                file_name_without_ext = actual_file_name.rsplit('.', 1)[0] if '.' in actual_file_name else actual_file_name
                import re
                timestamp_match = re.search(r'-(20\d{2}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)$', file_name_without_ext)
                asset_tag_id = file_name_without_ext[:timestamp_match.start()] if timestamp_match else file_name_without_ext.split('-')[0] if '-' in file_name_without_ext else file_name_without_ext
                
                # If the extracted assetTagId is "documents", it's a standalone document upload
                if asset_tag_id == 'documents':
                    asset_tag_id = ''
                
                file_data.append({
                    "file": file,
                    "publicUrl": public_url,
                    "assetTagId": asset_tag_id,
                    "actualFileName": actual_file_name,
                    "storageSize": file.get('metadata', {}).get('size') if isinstance(file.get('metadata'), dict) else None,
                    "storageMimeType": file.get('metadata', {}).get('mimetype') if isinstance(file.get('metadata'), dict) else None,
                })
            except Exception as e:
                logger.warning(f"Error processing file {file.get('path', 'unknown')}: {e}")
                continue
        
        # Batch query: Get all linked documents in a single query
        all_public_urls = [fd['publicUrl'] for fd in file_data if fd['publicUrl']]
        
        # Normalize URLs by removing query parameters and fragments
        def normalize_url(url: str) -> str:
            try:
                from urllib.parse import urlparse
                parsed = urlparse(url)
                return f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            except:
                return url.split('?')[0].split('#')[0]
        
        normalized_public_urls = [normalize_url(url) for url in all_public_urls]
        
        # Build OR conditions for URL matching
        url_conditions = []
        if all_public_urls:
            url_conditions.append({"documentUrl": {"in": all_public_urls}})
        if normalized_public_urls:
            url_conditions.append({"documentUrl": {"in": normalized_public_urls}})
        
        # Add filename-based matches
        for fd in file_data:
            if fd['actualFileName']:
                url_conditions.append({"documentUrl": {"contains": fd['actualFileName']}})
        
        # Query linked documents
        # Note: Prisma Python doesn't support 'select', so we fetch all fields
        all_linked_documents = []
        if url_conditions:
            try:
                all_linked_documents_raw = await prisma.assetsdocument.find_many(
                    where={"OR": url_conditions}
                )
                # Extract only the fields we need
                all_linked_documents = [
                    {
                        "assetTagId": doc.assetTagId,
                        "documentUrl": doc.documentUrl,
                        "documentType": doc.documentType,
                        "documentSize": doc.documentSize,
                        "fileName": doc.fileName,
                        "mimeType": doc.mimeType,
                    }
                    for doc in all_linked_documents_raw
                ]
            except Exception as e:
                logger.warning(f"Error querying linked documents: {e}")
        
        # Create maps for quick lookup
        document_url_to_asset_tag_ids: Dict[str, set] = {}
        asset_tag_id_to_document_urls: Dict[str, set] = {}
        document_url_to_metadata: Dict[str, Dict[str, Any]] = {}
        
        for doc in all_linked_documents:
            if not doc.get('assetTagId') or not doc.get('documentUrl'):
                continue
            
            doc_url = doc['documentUrl']
            
            # Store metadata
            document_url_to_metadata[doc_url] = {
                "documentType": doc.get('documentType'),
                "documentSize": doc.get('documentSize'),
                "fileName": doc.get('fileName'),
                "mimeType": doc.get('mimeType'),
            }
            
            # Map by documentUrl
            if doc_url not in document_url_to_asset_tag_ids:
                document_url_to_asset_tag_ids[doc_url] = set()
            document_url_to_asset_tag_ids[doc_url].add(doc['assetTagId'])
            
            # Map by assetTagId
            if doc['assetTagId'] not in asset_tag_id_to_document_urls:
                asset_tag_id_to_document_urls[doc['assetTagId']] = set()
            asset_tag_id_to_document_urls[doc['assetTagId']].add(doc_url)
        
        # Also check for filename matches
        for fd in file_data:
            asset_tag_id = fd['assetTagId']
            actual_file_name = fd['actualFileName']
            if not asset_tag_id:
                continue
            
            matching_urls = [
                url for url in asset_tag_id_to_document_urls.get(asset_tag_id, [])
                if actual_file_name.lower() in url.lower()
            ]
            
            for url in matching_urls:
                if url not in document_url_to_asset_tag_ids:
                    document_url_to_asset_tag_ids[url] = set()
                document_url_to_asset_tag_ids[url].add(asset_tag_id)
        
        # Get all unique asset tag IDs that are linked
        all_linked_asset_tag_ids = set()
        for fd in file_data:
            tag_ids = document_url_to_asset_tag_ids.get(fd['publicUrl'], set())
            all_linked_asset_tag_ids.update(tag_ids)
        
        # Batch query: Get all asset deletion status
        linked_assets_info_map: Dict[str, bool] = {}
        if all_linked_asset_tag_ids:
            try:
                assets = await prisma.assets.find_many(
                    where={"assetTagId": {"in": list(all_linked_asset_tag_ids)}},
                    select={"assetTagId": True, "isDeleted": True}
                )
                for asset in assets:
                    linked_assets_info_map[asset['assetTagId']] = asset.get('isDeleted', False)
            except Exception as e:
                logger.warning(f"Error querying assets: {e}")
        
        # Calculate total storage used from ALL files (not just paginated)
        documents_files = [f for f in combined_files if f['path'].startswith('assets_documents/') or f['path'].startswith('assets/assets_documents/')]
        all_file_data = []
        for file in documents_files:
            try:
                url_data = supabase_admin.storage.from_(file['bucket']).get_public_url(file['path'])
                public_url = url_data if isinstance(url_data, str) else url_data.get('publicUrl', '') if isinstance(url_data, dict) else ''
                all_file_data.append({
                    "publicUrl": public_url,
                    "storageSize": file.get('metadata', {}).get('size') if isinstance(file.get('metadata'), dict) else None,
                })
            except Exception:
                continue
        
        # Get metadata for all files from database
        all_file_public_urls = [fd['publicUrl'] for fd in all_file_data if fd['publicUrl']]
        all_db_documents = []
        if all_file_public_urls:
            try:
                # Note: Prisma Python doesn't support 'select', so we fetch all fields
                all_db_documents_raw = await prisma.assetsdocument.find_many(
                    where={"documentUrl": {"in": all_file_public_urls}}
                )
                # Extract only the fields we need
                all_db_documents = [
                    {
                        "documentUrl": doc.documentUrl,
                        "documentType": doc.documentType,
                        "documentSize": doc.documentSize,
                        "fileName": doc.fileName,
                        "mimeType": doc.mimeType,
                    }
                    for doc in all_db_documents_raw
                ]
            except Exception as e:
                logger.warning(f"Error querying all documents for storage calculation: {e}")
        
        all_document_url_to_metadata: Dict[str, Dict[str, Any]] = {}
        for doc in all_db_documents:
            if doc.get('documentUrl'):
                all_document_url_to_metadata[doc['documentUrl']] = {
                    "documentType": doc.get('documentType'),
                    "documentSize": doc.get('documentSize'),
                    "fileName": doc.get('fileName'),
                    "mimeType": doc.get('mimeType'),
                }
        
        # Calculate total storage used
        total_storage_used = sum(
            (fd.get('storageSize') or all_document_url_to_metadata.get(fd['publicUrl'], {}).get('documentSize') or 0)
            for fd in all_file_data
        )
        
        # Build the response (only for paginated documents)
        documents = []
        for fd in file_data:
            # Find matching database documentUrl
            normalized_public_url = normalize_url(fd['publicUrl'])
            matching_db_document_url = None
            
            for db_document_url in document_url_to_asset_tag_ids.keys():
                normalized_db_url = normalize_url(db_document_url)
                if db_document_url == fd['publicUrl'] or normalized_db_url == normalized_public_url:
                    matching_db_document_url = db_document_url
                    break
            
            # Also check by filename if no exact match found
            if not matching_db_document_url and fd['actualFileName']:
                for db_document_url in document_url_to_asset_tag_ids.keys():
                    if fd['actualFileName'].lower() in db_document_url.lower():
                        matching_db_document_url = db_document_url
                        break
            
            # Use database documentUrl if found, otherwise use storage publicUrl
            final_document_url = matching_db_document_url or fd['publicUrl']
            
            # Get linked asset tag IDs
            linked_asset_tag_ids = list(
                document_url_to_asset_tag_ids.get(final_document_url, set()) or
                document_url_to_asset_tag_ids.get(fd['publicUrl'], set()) or
                []
            )
            linked_assets_info = [
                {"assetTagId": tag_id, "isDeleted": linked_assets_info_map.get(tag_id, False)}
                for tag_id in linked_asset_tag_ids
            ]
            has_deleted_asset = any(info['isDeleted'] for info in linked_assets_info)
            
            # Get metadata
            db_metadata = document_url_to_metadata.get(final_document_url) or document_url_to_metadata.get(fd['publicUrl']) or {}
            
            # Prefer storage metadata over database metadata
            document_type = db_metadata.get('documentType')
            document_size = fd.get('storageSize') or db_metadata.get('documentSize')
            file_name = db_metadata.get('fileName') or fd['actualFileName']
            mime_type = fd.get('storageMimeType') or db_metadata.get('mimeType')
            
            documents.append({
                "id": fd['file'].get('id') or fd['file']['path'],
                "documentUrl": final_document_url,
                "assetTagId": fd['assetTagId'],
                "fileName": file_name,
                "createdAt": fd['file'].get('created_at') or datetime.now().isoformat(),
                "isLinked": len(linked_asset_tag_ids) > 0,
                "linkedAssetTagId": linked_asset_tag_ids[0] if linked_asset_tag_ids else None,
                "linkedAssetTagIds": linked_asset_tag_ids,
                "linkedAssetsInfo": linked_assets_info,
                "assetIsDeleted": has_deleted_asset,
                "documentType": document_type,
                "documentSize": document_size,
                "mimeType": mime_type,
            })
        
        return {
            "documents": documents,
            "pagination": {
                "total": total_count,
                "page": page,
                "pageSize": pageSize,
                "totalPages": (total_count + pageSize - 1) // pageSize if pageSize > 0 else 0,
            },
            "storage": {
                "used": total_storage_used,
                "limit": 5 * 1024 * 1024,  # 5MB limit (temporary)
            },
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching documents: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch documents")


@router.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    documentType: Optional[str] = Form(None),
    auth: dict = Depends(verify_auth)
):
    """Upload a document to storage"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check media permission
        has_permission = await check_permission(user_id, "canManageMedia")
        if not has_permission:
            raise HTTPException(status_code=403, detail="Permission denied: canManageMedia required")
        
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file provided")
        
        # Validate file type
        allowed_types = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
            'text/csv',
            'application/rtf',
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/webp',
        ]
        allowed_extensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv', '.rtf', '.jpg', '.jpeg', '.png', '.gif', '.webp']
        
        file_extension = '.' + file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
        
        if file.content_type not in allowed_types and file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail="Invalid file type. Only PDF, DOC, DOCX, XLS, XLSX, TXT, CSV, RTF, JPEG, PNG, GIF, and WebP files are allowed."
            )
        
        # Validate file size (max 5MB per file)
        max_file_size = 5 * 1024 * 1024  # 5MB
        file_content = await file.read()
        file_size = len(file_content)
        
        if file_size > max_file_size:
            raise HTTPException(
                status_code=400,
                detail="File size too large. Maximum size is 5MB."
            )
        
        # Check storage limit (5MB total - temporary)
        storage_limit = 5 * 1024 * 1024  # 5MB limit
        
        supabase_admin = get_supabase_admin_client()
        
        try:
            # List all files to calculate total size
            async def list_all_files(bucket: str, folder: str = "") -> List[Dict[str, Any]]:
                all_files: List[Dict[str, Any]] = []
                try:
                    response = supabase_admin.storage.from_(bucket).list(folder, {"limit": 1000})
                    if not response:
                        return all_files
                    for item in response:
                        item_path = f"{folder}/{item['name']}" if folder else item['name']
                        is_folder = item.get('id') is None
                        if is_folder:
                            sub_files = await list_all_files(bucket, item_path)
                            all_files.extend(sub_files)
                        else:
                            all_files.append({
                                "metadata": item.get('metadata', {}),
                                "path": item_path
                            })
                except Exception:
                    pass
                return all_files
            
            assets_files = await list_all_files('assets', '')
            file_history_files = await list_all_files('file-history', 'assets')
            
            # Calculate storage from files
            current_storage_used = 0
            for f in assets_files + file_history_files:
                if isinstance(f.get('metadata'), dict) and f['metadata'].get('size'):
                    current_storage_used += f['metadata']['size']
            
            # Also check database for documents that might have size info
            try:
                db_documents = await prisma.assetsdocument.find_many(
                    select={"documentUrl": True, "documentSize": True}
                )
                storage_sizes = {f.get('metadata', {}).get('size') for f in assets_files + file_history_files if isinstance(f.get('metadata'), dict)}
                for doc in db_documents:
                    if doc.get('documentSize') and doc['documentSize'] not in storage_sizes:
                        current_storage_used += doc['documentSize']
            except Exception:
                pass
            
            if current_storage_used + file_size > storage_limit:
                raise HTTPException(
                    status_code=400,
                    detail=f"Storage limit exceeded. Current usage: {current_storage_used / (1024 * 1024):.2f}MB / {storage_limit / (1024 * 1024):.2f}MB"
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Could not check storage limit: {e}")
        
        # Generate unique file path
        timestamp = datetime.now().isoformat().replace(':', '-').replace('.', '-')
        sanitized_extension = file_extension[1:] if file_extension.startswith('.') else file_extension
        file_name = f"documents-{timestamp}.{sanitized_extension}"
        file_path = f"assets_documents/{file_name}"
        
        # Upload to Supabase storage
        public_url = None
        final_file_path = file_path
        
        try:
            # Try assets bucket first
            response = supabase_admin.storage.from_('assets').upload(
                file_path,
                file_content,
                file_options={"content-type": file.content_type or "application/octet-stream"}
            )
            
            if response:
                url_data = supabase_admin.storage.from_('assets').get_public_url(file_path)
                public_url = url_data if isinstance(url_data, str) else (url_data.get('publicUrl', '') if isinstance(url_data, dict) else '')
        except Exception as upload_error:
            # If assets bucket doesn't exist, try file-history bucket
            error_msg = str(upload_error).lower()
            if 'bucket not found' in error_msg or 'not found' in error_msg:
                try:
                    response = supabase_admin.storage.from_('file-history').upload(
                        file_path,
                        file_content,
                        file_options={"content-type": file.content_type or "application/octet-stream"}
                    )
                    if response:
                        url_data = supabase_admin.storage.from_('file-history').get_public_url(file_path)
                        public_url = url_data if isinstance(url_data, str) else (url_data.get('publicUrl', '') if isinstance(url_data, dict) else '')
                except Exception as fallback_error:
                    logger.error(f"Storage upload error: {fallback_error}")
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to upload document to storage: {fallback_error}"
                    )
            else:
                logger.error(f"Storage upload error: {upload_error}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to upload document to storage: {upload_error}"
                )
        
        if not public_url:
            raise HTTPException(
                status_code=500,
                detail="Failed to get public URL for uploaded document"
            )
        
        # Create database record for the document
        asset_tag_id = 'STANDALONE'
        
        try:
            document_record = await prisma.assetsdocument.create(
                data={
                    "assetTagId": asset_tag_id,
                    "documentUrl": public_url,
                    "documentType": documentType,
                    "documentSize": file_size,
                    "fileName": file.filename,
                    "mimeType": file.content_type,
                }
            )
            
            return {
                "id": str(document_record.id),
                "filePath": final_file_path,
                "fileName": file_name,
                "fileSize": file_size,
                "mimeType": file.content_type,
                "publicUrl": public_url,
                "documentType": documentType,
                "assetTagId": asset_tag_id,
            }
        except Exception as db_error:
            logger.error(f"Error creating document record in database: {db_error}")
            # Even if database insert fails, the file is already uploaded to storage
            return {
                "error": "Document uploaded to storage but failed to save to database",
                "details": str(db_error),
                "filePath": final_file_path,
                "fileName": file_name,
                "fileSize": file_size,
                "mimeType": file.content_type,
                "publicUrl": public_url,
                "documentType": documentType,
            }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading document: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to upload document")


@router.get("/documents/bulk")
async def get_bulk_asset_documents(
    assetTagIds: str = Query(..., description="Comma-separated list of asset tag IDs"),
    auth: dict = Depends(verify_auth)
):
    """Get documents for multiple asset tag IDs"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")

        has_permission = await check_permission(user_id, "canViewAssets")
        if not has_permission:
            raise HTTPException(status_code=403, detail="Permission denied: canViewAssets required")

        if not assetTagIds:
            raise HTTPException(status_code=400, detail="assetTagIds parameter is required")

        # Parse comma-separated asset tag IDs
        asset_tag_ids = [id.strip() for id in assetTagIds.split(',') if id.strip()]

        if len(asset_tag_ids) == 0:
            return []

        # Fetch documents for all assets
        documents = await prisma.assetsdocument.find_many(
            where={"assetTagId": {"in": asset_tag_ids}},
            order={"createdAt": "desc"}
        )

        # Group documents by assetTagId
        documents_by_asset_tag = {}
        for doc in documents:
            asset_tag_id = str(doc.assetTagId)
            if asset_tag_id not in documents_by_asset_tag:
                documents_by_asset_tag[asset_tag_id] = []
            document_url = doc.documentUrl if doc.documentUrl else None
            if document_url:
                documents_by_asset_tag[asset_tag_id].append({
                    "documentUrl": document_url
                })

        # Return array of { assetTagId, documents: [{ documentUrl }] }
        result = [
            {
                "assetTagId": asset_tag_id,
                "documents": documents_by_asset_tag.get(asset_tag_id, [])
            }
            for asset_tag_id in asset_tag_ids
        ]

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching bulk asset documents: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch asset documents")


@router.get("/documents/{asset_tag_id}")
async def get_asset_documents(
    asset_tag_id: str,
    auth: dict = Depends(verify_auth)
):
    """Get all documents for a specific asset by assetTagId"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check view permission
        has_permission = await check_permission(user_id, "canViewAssets")
        if not has_permission:
            raise HTTPException(status_code=403, detail="Permission denied: canViewAssets required")
        
        if not asset_tag_id:
            raise HTTPException(status_code=400, detail="Asset Tag ID is required")
        
        # Fetch documents for the asset
        try:
            documents = await prisma.assetsdocument.find_many(
                where={
                    "assetTagId": asset_tag_id,
                },
                order={"createdAt": "desc"}
            )
        except Exception as db_error:
            error_str = str(db_error).lower()
            if 'p1001' in error_str or 'p2024' in error_str or 'connection' in error_str:
                raise HTTPException(
                    status_code=503,
                    detail="Database connection limit reached. Please try again in a moment."
                )
            raise
        
        return {"documents": documents}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching asset documents: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch asset documents")


@router.delete("/documents/delete")
async def delete_document_by_url(
    documentUrl: str = Query(..., description="Document URL to delete"),
    auth: dict = Depends(verify_auth)
):
    """Delete document by URL - removes all links and optionally deletes from storage"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check media permission
        has_permission = await check_permission(user_id, "canManageMedia")
        if not has_permission:
            raise HTTPException(status_code=403, detail="Permission denied: canManageMedia required")
        
        if not documentUrl:
            raise HTTPException(status_code=400, detail="Document URL is required")
        
        # Find all AssetsDocument records linked to this document URL
        try:
            linked_documents = await prisma.assetsdocument.find_many(
                where={
                    "documentUrl": documentUrl,
                }
            )
        except Exception as db_error:
            logger.error(f"Error finding linked documents: {db_error}")
            raise HTTPException(status_code=500, detail="Failed to find linked documents")
        
        # Delete all database links for this document (if any exist)
        deleted_count = 0
        if linked_documents:
            try:
                result = await prisma.assetsdocument.delete_many(
                    where={
                        "documentUrl": documentUrl,
                    }
                )
                deleted_count = result
            except Exception as db_error:
                logger.error(f"Error deleting document links: {db_error}")
                raise HTTPException(status_code=500, detail="Failed to delete document links")
        
        # Delete the file from storage
        try:
            supabase_admin = get_supabase_admin_client()
            import re
            from urllib.parse import unquote
            
            # Decode URL-encoded characters
            decoded_url = unquote(documentUrl)
            
            # Extract bucket and path from URL
            url_match = re.search(r'/storage/v1/object/public/([^/]+)/(.+)', decoded_url)
            if url_match:
                bucket = url_match.group(1)
                path = url_match.group(2)
                
                # Remove query parameters from path (e.g., ?t=timestamp)
                path = path.split('?')[0]
                
                # Remove URL-encoding from path
                path = unquote(path)
                
                logger.info(f"Attempting to delete document from storage: bucket={bucket}, path={path}")
                
                # Delete from storage
                delete_response = supabase_admin.storage.from_(bucket).remove([path])
                
                # Check for errors in response
                if delete_response:
                    if isinstance(delete_response, dict) and delete_response.get('error'):
                        logger.error(f"Failed to delete document from storage: {documentUrl}, Error: {delete_response['error']}")
                    else:
                        logger.info(f"Successfully deleted document from storage: {path}")
                else:
                    logger.warning(f"No response from storage deletion for: {path}")
            else:
                logger.warning(f"Could not parse storage URL: {documentUrl}")
        except Exception as storage_error:
            logger.error(f"Storage deletion error for {documentUrl}: {storage_error}", exc_info=True)
            # Continue even if storage deletion fails
        
        return {
            "success": True,
            "message": f"Deleted {deleted_count} link(s)" if deleted_count > 0 else "Deleted successfully",
            "deletedLinks": deleted_count,
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting document: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete document")


@router.delete("/documents/delete/{document_id}")
async def delete_document_by_id(
    document_id: str,
    auth: dict = Depends(verify_auth)
):
    """Delete document by ID - removes from database only (keeps file in storage)"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check media permission
        has_permission = await check_permission(user_id, "canManageMedia")
        if not has_permission:
            raise HTTPException(status_code=403, detail="Permission denied: canManageMedia required")
        
        if not document_id:
            raise HTTPException(status_code=400, detail="Document ID is required")
        
        # Check if document exists first
        try:
            existing_document = await prisma.assetsdocument.find_unique(
                where={
                    "id": document_id,
                }
            )
        except Exception as db_error:
            logger.error(f"Error finding document: {db_error}")
            raise HTTPException(status_code=500, detail="Failed to find document")
        
        if not existing_document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Delete document from database only (keep file in bucket)
        try:
            await prisma.assetsdocument.delete(
                where={
                    "id": document_id,
                }
            )
        except Exception as db_error:
            error_str = str(db_error).lower()
            if 'p2025' in error_str or 'record not found' in error_str:
                raise HTTPException(status_code=404, detail="Document not found")
            logger.error(f"Error deleting document: {db_error}")
            raise HTTPException(status_code=500, detail="Failed to delete document")
        
        return {
            "success": True,
            "message": "Document deleted from database"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting document: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete document")


@router.delete("/documents/bulk-delete")
async def bulk_delete_documents(
    request: Dict[str, Any],
    auth: dict = Depends(verify_auth)
):
    """Bulk delete documents by URLs"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check media permission
        has_permission = await check_permission(user_id, "canManageMedia")
        if not has_permission:
            raise HTTPException(status_code=403, detail="Permission denied: canManageMedia required")
        
        document_urls = request.get("documentUrls")
        
        if not document_urls or not isinstance(document_urls, list) or len(document_urls) == 0:
            raise HTTPException(
                status_code=400,
                detail="Document URLs array is required"
            )
        
        total_deleted_links = 0
        supabase_admin = get_supabase_admin_client()
        
        # Process each document URL
        for document_url in document_urls:
            # Find all AssetsDocument records linked to this document URL
            try:
                linked_documents = await prisma.assetsdocument.find_many(
                    where={
                        "documentUrl": document_url,
                    }
                )
            except Exception as db_error:
                logger.warning(f"Error finding linked documents for {document_url}: {db_error}")
                continue
            
            # Delete all database links for this document (if any exist)
            if linked_documents:
                try:
                    await prisma.assetsdocument.delete_many(
                        where={
                            "documentUrl": document_url,
                        }
                    )
                    total_deleted_links += len(linked_documents)
                except Exception as db_error:
                    logger.warning(f"Error deleting document links for {document_url}: {db_error}")
                    continue
            
            # Delete the file from storage
            try:
                import re
                from urllib.parse import unquote
                
                # Decode URL-encoded characters
                decoded_url = unquote(document_url)
                
                # Extract bucket and path from URL
                url_match = re.search(r'/storage/v1/object/public/([^/]+)/(.+)', decoded_url)
                if url_match:
                    bucket = url_match.group(1)
                    path = url_match.group(2)
                    
                    # Remove query parameters from path (e.g., ?t=timestamp)
                    path = path.split('?')[0]
                    
                    # Remove URL-encoding from path
                    path = unquote(path)
                    
                    # Delete from storage
                    delete_response = supabase_admin.storage.from_(bucket).remove([path])
                    
                    # Check for errors in response
                    if delete_response:
                        if isinstance(delete_response, dict) and delete_response.get('error'):
                            logger.error(f"Failed to delete document from storage: {document_url}, Error: {delete_response['error']}")
                        else:
                            logger.info(f"Successfully deleted document from storage: {path}")
                    else:
                        logger.warning(f"No response from storage deletion for: {path}")
                else:
                    logger.warning(f"Could not parse storage URL: {document_url}")
            except Exception as storage_error:
                logger.error(f"Storage deletion error for {document_url}: {storage_error}", exc_info=True)
                # Continue with other files even if one fails
        
        return {
            "success": True,
            "message": f"Deleted {len(document_urls)} document(s){f' and removed {total_deleted_links} link(s)' if total_deleted_links > 0 else ''}",
            "deletedCount": len(document_urls),
            "deletedLinks": total_deleted_links,
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error bulk deleting documents: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to bulk delete documents")


@router.get("/images/bulk")
async def get_bulk_asset_images(
    assetTagIds: str = Query(..., description="Comma-separated list of asset tag IDs"),
    auth: dict = Depends(verify_auth)
):
    """Get images for multiple asset tag IDs"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")

        has_permission = await check_permission(user_id, "canViewAssets")
        if not has_permission:
            raise HTTPException(status_code=403, detail="Permission denied: canViewAssets required")

        if not assetTagIds:
            raise HTTPException(status_code=400, detail="assetTagIds parameter is required")

        # Parse comma-separated asset tag IDs
        asset_tag_ids = [id.strip() for id in assetTagIds.split(',') if id.strip()]

        if len(asset_tag_ids) == 0:
            return []

        # Fetch images for all assets
        images = await prisma.assetsimage.find_many(
            where={"assetTagId": {"in": asset_tag_ids}},
            order={"createdAt": "desc"}
        )

        # Group images by assetTagId
        images_by_asset_tag = {}
        for img in images:
            asset_tag_id = img.assetTagId
            image_url = img.imageUrl
            if asset_tag_id not in images_by_asset_tag:
                images_by_asset_tag[asset_tag_id] = []
            if image_url:
                images_by_asset_tag[asset_tag_id].append(image_url)

        # Return array of { assetTagId, images: [{ imageUrl }] }
        result = [
            {
                "assetTagId": asset_tag_id,
                "images": [{"imageUrl": image_url} for image_url in images_by_asset_tag.get(asset_tag_id, [])]
            }
            for asset_tag_id in asset_tag_ids
        ]

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching bulk asset images: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch asset images")


@router.get("/images/{asset_tag_id}")
async def get_asset_images(
    asset_tag_id: str,
    auth: dict = Depends(verify_auth)
):
    """Get all images for a specific asset tag ID"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")

        has_permission = await check_permission(user_id, "canViewAssets")
        if not has_permission:
            raise HTTPException(status_code=403, detail="Permission denied: canViewAssets required")

        if not asset_tag_id:
            raise HTTPException(status_code=400, detail="Asset Tag ID is required")

        images = await prisma.assetsimage.find_many(
            where={"assetTagId": asset_tag_id},
            order={"createdAt": "desc"}
        )

        return {"images": images}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching asset images: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch asset images")


@router.delete("/images/delete/{image_id}")
async def delete_image_by_id(
    image_id: str,
    auth: dict = Depends(verify_auth)
):
    """Delete an image record from the database by its ID (keeps file in storage)"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")

        has_permission = await check_permission(user_id, "canManageMedia")
        if not has_permission:
            raise HTTPException(status_code=403, detail="Permission denied: canManageMedia required")

        if not image_id:
            raise HTTPException(status_code=400, detail="Image ID is required")

        existing_image = await prisma.assetsimage.find_unique(
            where={"id": image_id}
        )

        if not existing_image:
            raise HTTPException(status_code=404, detail="Image not found")

        await prisma.assetsimage.delete(
            where={"id": image_id}
        )

        return {"success": True, "message": "Image deleted from database"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting image by ID: {type(e).__name__}: {str(e)}", exc_info=True)
        if "P2025" in str(e):  # Prisma error for record not found
            raise HTTPException(status_code=404, detail="Image not found")
        raise HTTPException(status_code=500, detail="Failed to delete image")


@router.get("/media")
async def get_media(
    page: int = Query(1, ge=1),
    pageSize: int = Query(50, ge=1, le=1000),
    auth: dict = Depends(verify_auth)
):
    """Get all media (images) with pagination from storage buckets"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Allow viewing media without canManageMedia permission
        # Users can view but actions (upload/delete) are controlled by client-side checks
        
        supabase_admin = get_supabase_admin_client()
        
        # Helper function to recursively list all files in a folder
        async def list_all_files(bucket: str, folder: str = "") -> List[Dict[str, Any]]:
            all_files: List[Dict[str, Any]] = []
            
            try:
                response = supabase_admin.storage.from_(bucket).list(folder, {
                    "limit": 1000
                })
                
                if not response:
                    return all_files
                
                for item in response:
                    item_path = f"{folder}/{item['name']}" if folder else item['name']
                    
                    # Check if it's a folder by checking if id is missing
                    is_folder = item.get('id') is None
                    
                    if is_folder:
                        # It's a folder, recursively list files inside
                        sub_files = await list_all_files(bucket, item_path)
                        all_files.extend(sub_files)
                    else:
                        # Include all files
                        all_files.append({
                            "name": item['name'],
                            "id": item.get('id') or item_path,
                            "created_at": item.get('created_at') or datetime.now().isoformat(),
                            "path": item_path,
                            "metadata": item.get('metadata', {})
                        })
            except Exception as e:
                logger.warning(f"Error listing files from {bucket}/{folder}: {e}")
            
            return all_files
        
        # Fetch fresh file list
        # List files from assets_images folder in assets bucket
        assets_files = await list_all_files('assets', 'assets_images')
        
        # List files from assets_images folder in file-history bucket
        file_history_files = await list_all_files('file-history', 'assets/assets_images')
        
        # Combine files from both buckets
        combined_files: List[Dict[str, Any]] = []
        
        # Add files from assets bucket (only from assets_images folder)
        # Filter by path to ensure we only get images, not documents from assets_documents
        for file in assets_files:
            # Ensure file is in assets_images folder and NOT in assets_documents folder
            if file['path'].startswith('assets_images/') and not file['path'].startswith('assets_documents/'):
                combined_files.append({
                    **file,
                    "bucket": 'assets',
                })
        
        # Add files from file-history bucket (only from assets/assets_images folder)
        # Filter by path to ensure we only get images, not documents from assets/assets_documents
        for file in file_history_files:
            # Ensure file is in assets/assets_images folder and NOT in assets/assets_documents folder
            if file['path'].startswith('assets/assets_images/') and not file['path'].startswith('assets/assets_documents/'):
                combined_files.append({
                    **file,
                    "bucket": 'file-history',
                })
        
        # Sort by created_at descending
        combined_files.sort(key=lambda x: datetime.fromisoformat(x['created_at'].replace('Z', '+00:00')) if x.get('created_at') else datetime.min, reverse=True)
        
        # Paginate
        total_count = len(combined_files)
        skip = (page - 1) * pageSize
        paginated_files = combined_files[skip:skip + pageSize]
        
        # Prepare file data and extract URLs/assetTagIds
        file_data = []
        for file in paginated_files:
            url_data = supabase_admin.storage.from_(file['bucket']).get_public_url(file['path'])
            public_url = url_data.get('publicUrl', '') if isinstance(url_data, dict) else str(url_data)
            
            # Extract full filename and assetTagId
            path_parts = file['path'].split('/')
            actual_file_name = path_parts[-1]
            
            # Extract assetTagId - filename format is: assetTagId-timestamp.ext
            file_name_without_ext = actual_file_name.rsplit('.', 1)[0] if '.' in actual_file_name else actual_file_name
            # Try to match pattern: assetTagId-YYYY-MM-DDTHH-MM-SS-sssZ
            import re
            timestamp_match = re.search(r'-(20\d{2}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)$', file_name_without_ext)
            asset_tag_id = file_name_without_ext[:timestamp_match.start()] if timestamp_match else file_name_without_ext.split('-')[0] if '-' in file_name_without_ext else file_name_without_ext
            
            # If the extracted assetTagId is "media", it's a standalone media upload, not linked to an asset
            if asset_tag_id == 'media':
                asset_tag_id = ''
            
            file_data.append({
                "file": file,
                "publicUrl": public_url,
                "assetTagId": asset_tag_id,
                "actualFileName": actual_file_name,
                "storageSize": file.get('metadata', {}).get('size'),
                "storageMimeType": file.get('metadata', {}).get('mimetype'),
            })
        
        # Batch query: Get all linked images in a single query
        all_public_urls = [fd['publicUrl'] for fd in file_data if fd['publicUrl']]
        
        # Normalize URLs by removing query parameters and fragments for better matching
        def normalize_url(url: str) -> str:
            try:
                from urllib.parse import urlparse
                parsed = urlparse(url)
                return f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            except:
                return url.split('?')[0].split('#')[0]
        
        normalized_public_urls = [normalize_url(url) for url in all_public_urls]
        
        # Build OR conditions for URL matching
        url_conditions = []
        if all_public_urls:
            url_conditions.append({"imageUrl": {"in": all_public_urls}})
        if normalized_public_urls:
            url_conditions.append({"imageUrl": {"in": normalized_public_urls}})
        
        # Add filename-based matches
        for fd in file_data:
            if fd['actualFileName']:
                url_conditions.append({"imageUrl": {"contains": fd['actualFileName']}})
        
        # Query linked images - Note: Prisma Python doesn't support 'select', so we fetch all fields
        all_linked_images_raw = []
        if url_conditions:
            try:
                all_linked_images_raw = await prisma.assetsimage.find_many(
                    where={"OR": url_conditions} if url_conditions else {}
                )
            except Exception as e:
                logger.warning(f"Error querying linked images: {e}")
        
        # Extract only the fields we need
        all_linked_images = [
            {
                "assetTagId": img.assetTagId,
                "imageUrl": img.imageUrl,
                "imageType": img.imageType,
                "imageSize": img.imageSize,
            }
            for img in all_linked_images_raw
        ]
        
        # Create maps for quick lookup
        image_url_to_asset_tag_ids: Dict[str, set] = {}
        image_url_to_metadata: Dict[str, Dict[str, Any]] = {}
        
        for img in all_linked_images:
            if not img.get('assetTagId') or not img.get('imageUrl'):
                continue
            
            img_url = img['imageUrl']
            normalized_img_url = normalize_url(img_url)
            
            # Store metadata
            image_url_to_metadata[img_url] = {
                "imageType": img.get('imageType'),
                "imageSize": img.get('imageSize'),
            }
            
            # Map by exact URL
            if img_url not in image_url_to_asset_tag_ids:
                image_url_to_asset_tag_ids[img_url] = set()
            image_url_to_asset_tag_ids[img_url].add(img['assetTagId'])
            
            # Also map normalized URL
            if normalized_img_url not in image_url_to_asset_tag_ids:
                image_url_to_asset_tag_ids[normalized_img_url] = set()
            image_url_to_asset_tag_ids[normalized_img_url].add(img['assetTagId'])
        
        # Match database URLs to storage publicUrls
        for fd in file_data:
            public_url = fd['publicUrl']
            normalized_public_url = normalize_url(public_url)
            
            # Check if any database URL matches this publicUrl
            for img in all_linked_images:
                if not img.get('assetTagId') or not img.get('imageUrl'):
                    continue
                
                normalized_db_url = normalize_url(img['imageUrl'])
                
                # Match by exact URL or normalized URL
                if img['imageUrl'] == public_url or normalized_db_url == normalized_public_url:
                    if public_url not in image_url_to_asset_tag_ids:
                        image_url_to_asset_tag_ids[public_url] = set()
                    image_url_to_asset_tag_ids[public_url].add(img['assetTagId'])
        
        # Also check for filename matches
        for fd in file_data:
            public_url = fd['publicUrl']
            actual_file_name = fd['actualFileName']
            if not actual_file_name:
                continue
            
            normalized_public_url = normalize_url(public_url)
            file_name_lower = actual_file_name.lower()
            
            for img in all_linked_images:
                if not img.get('assetTagId') or not img.get('imageUrl'):
                    continue
                
                normalized_db_url = normalize_url(img['imageUrl'])
                db_url_lower = img['imageUrl'].lower()
                
                # Check multiple matching strategies
                if (normalized_db_url == normalized_public_url or 
                    file_name_lower in db_url_lower or 
                    file_name_lower in normalized_public_url):
                    if public_url not in image_url_to_asset_tag_ids:
                        image_url_to_asset_tag_ids[public_url] = set()
                    image_url_to_asset_tag_ids[public_url].add(img['assetTagId'])
        
        # Get all unique asset tag IDs that are linked
        all_linked_asset_tag_ids = set()
        for fd in file_data:
            tag_ids = image_url_to_asset_tag_ids.get(fd['publicUrl'], set())
            all_linked_asset_tag_ids.update(tag_ids)
        
        # Batch query: Get all asset deletion status
        linked_assets_info_map = {}
        if all_linked_asset_tag_ids:
            try:
                assets = await prisma.assets.find_many(
                    where={"assetTagId": {"in": list(all_linked_asset_tag_ids)}}
                )
                for asset in assets:
                    linked_assets_info_map[asset.assetTagId] = asset.isDeleted or False
            except Exception as e:
                logger.warning(f"Error querying linked assets: {e}")
        
        # Calculate total storage used from ALL files (not just paginated)
        images_files = [f for f in combined_files if f['path'].startswith('assets_images/') or f['path'].startswith('assets/assets_images/')]
        all_file_data = []
        for file in images_files:
            try:
                url_data = supabase_admin.storage.from_(file['bucket']).get_public_url(file['path'])
                public_url = url_data.get('publicUrl', '') if isinstance(url_data, dict) else str(url_data)
                all_file_data.append({
                    "publicUrl": public_url,
                    "storageSize": file.get('metadata', {}).get('size') if isinstance(file.get('metadata'), dict) else None,
                })
            except Exception:
                continue
        
        # Get metadata for all files from database
        all_file_public_urls = [fd['publicUrl'] for fd in all_file_data if fd['publicUrl']]
        all_db_images = []
        if all_file_public_urls:
            try:
                # Normalize URLs for matching
                normalized_all_urls = [normalize_url(url) for url in all_file_public_urls]
                
                # Build OR conditions for URL matching
                all_url_conditions = []
                if all_file_public_urls:
                    all_url_conditions.append({"imageUrl": {"in": all_file_public_urls}})
                if normalized_all_urls:
                    all_url_conditions.append({"imageUrl": {"in": normalized_all_urls}})
                
                # Query all images from database - Note: Prisma Python doesn't support 'select', so we fetch all fields
                all_db_images_raw = await prisma.assetsimage.find_many(
                    where={"OR": all_url_conditions} if all_url_conditions else {}
                )
                # Extract only the fields we need
                all_db_images = [
                    {
                        "imageUrl": img.imageUrl,
                        "imageSize": img.imageSize,
                    }
                    for img in all_db_images_raw
                ]
            except Exception as e:
                logger.warning(f"Error querying all images for storage calculation: {e}")
        
        all_image_url_to_metadata: Dict[str, Dict[str, Any]] = {}
        for img in all_db_images:
            if img.get('imageUrl'):
                all_image_url_to_metadata[img['imageUrl']] = {
                    "imageSize": img.get('imageSize'),
                }
        
        # Calculate total storage used - use storage size OR database size as fallback
        total_storage_used = sum(
            (fd.get('storageSize') or all_image_url_to_metadata.get(fd['publicUrl'], {}).get('imageSize') or 0)
            for fd in all_file_data
        )
        
        # Build the response
        images = []
        for fd in file_data:
            public_url = fd['publicUrl']
            normalized_public_url = normalize_url(public_url)
            
            # Find matching database imageUrl
            matching_db_image_url = None
            for db_image_url in image_url_to_asset_tag_ids.keys():
                normalized_db_url = normalize_url(db_image_url)
                if db_image_url == public_url or normalized_db_url == normalized_public_url:
                    matching_db_image_url = db_image_url
                    break
            
            # Also check by filename if no exact match
            if not matching_db_image_url and fd['actualFileName']:
                for db_image_url in image_url_to_asset_tag_ids.keys():
                    if fd['actualFileName'].lower() in db_image_url.lower():
                        matching_db_image_url = db_image_url
                        break
            
            # Use database imageUrl if found, otherwise use storage publicUrl
            final_image_url = matching_db_image_url or public_url
            
            # Get linked asset tag IDs
            linked_asset_tag_ids = list(image_url_to_asset_tag_ids.get(final_image_url, image_url_to_asset_tag_ids.get(public_url, set())))
            linked_assets_info = [
                {"assetTagId": tag_id, "isDeleted": linked_assets_info_map.get(tag_id, False)}
                for tag_id in linked_asset_tag_ids
            ]
            has_deleted_asset = any(info['isDeleted'] for info in linked_assets_info)
            
            # Get metadata
            db_metadata = image_url_to_metadata.get(final_image_url, image_url_to_metadata.get(public_url, {}))
            image_type = fd['storageMimeType'] or db_metadata.get('imageType')
            image_size = fd['storageSize'] or db_metadata.get('imageSize')
            
            images.append({
                "id": fd['file'].get('id') or fd['file']['path'],
                "imageUrl": final_image_url,
                "assetTagId": fd['assetTagId'],
                "fileName": fd['actualFileName'],
                "createdAt": fd['file'].get('created_at') or datetime.now().isoformat(),
                "isLinked": len(linked_asset_tag_ids) > 0,
                "linkedAssetTagId": linked_asset_tag_ids[0] if linked_asset_tag_ids else None,
                "linkedAssetTagIds": linked_asset_tag_ids,
                "linkedAssetsInfo": linked_assets_info,
                "assetIsDeleted": has_deleted_asset,
                "imageType": image_type,
                "imageSize": image_size,
            })
        
        return {
            "images": images,
            "pagination": {
                "total": total_count,
                "page": page,
                "pageSize": pageSize,
                "totalPages": (total_count + pageSize - 1) // pageSize,
            },
            "storage": {
                "used": total_storage_used,
                "limit": 5 * 1024 * 1024,  # 5MB limit
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching media: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch media")


@router.post("/media/upload")
async def upload_media(
    file: UploadFile = File(...),
    auth: dict = Depends(verify_auth)
):
    """Upload a media file (image) to storage"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")

        has_permission = await check_permission(user_id, "canManageMedia")
        if not has_permission:
            raise HTTPException(status_code=403, detail="Permission denied: canManageMedia required")

        if not file.filename:
            raise HTTPException(status_code=400, detail="No file provided")

        # Validate file type
        allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail="Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed."
            )

        # Read file content
        contents = await file.read()
        file_size = len(contents)

        # Validate file size (max 5MB per file)
        max_file_size = 5 * 1024 * 1024  # 5MB
        if file_size > max_file_size:
            raise HTTPException(
                status_code=400,
                detail="File size too large. Maximum size is 5MB."
            )

        # Check storage limit (5GB total)
        storage_limit = 5 * 1024 * 1024 * 1024  # 5GB
        supabase_admin = get_supabase_admin_client()

        # Calculate current storage used (simplified - just check if we're close to limit)
        # In production, you might want to cache this or calculate more efficiently
        try:
            # List files to calculate storage
            async def list_all_files(bucket: str, folder: str = "") -> List[Dict[str, Any]]:
                all_files: List[Dict[str, Any]] = []
                try:
                    response = supabase_admin.storage.from_(bucket).list(folder, {"limit": 1000})
                    if not response:
                        return all_files
                    for item in response:
                        item_path = f"{folder}/{item['name']}" if folder else item['name']
                        is_folder = item.get('id') is None
                        if is_folder:
                            sub_files = await list_all_files(bucket, item_path)
                            all_files.extend(sub_files)
                        else:
                            all_files.append({
                                "metadata": item.get('metadata', {}),
                                "path": item_path
                            })
                except Exception as e:
                    logger.warning(f"Error listing files from {bucket}/{folder}: {e}")
                return all_files

            assets_files = await list_all_files('assets', '')
            file_history_files = await list_all_files('file-history', 'assets')

            current_storage_used = 0
            for f in assets_files + file_history_files:
                if f.get('metadata', {}).get('size'):
                    current_storage_used += f['metadata']['size']

            if current_storage_used + file_size > storage_limit:
                raise HTTPException(
                    status_code=400,
                    detail=f"Storage limit exceeded. Current usage: {(current_storage_used / (1024 * 1024)):.2f}MB / {(storage_limit / (1024 * 1024)):.2f}MB"
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Could not check storage limit: {e}")

        # Generate unique file path
        timestamp = datetime.now().isoformat().replace(':', '-').replace('.', '-')
        file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
        sanitized_extension = file_extension.lower()
        file_name = f"media-{timestamp}.{sanitized_extension}"
        file_path = f"assets_images/{file_name}"

        # Upload to Supabase storage
        public_url = None
        final_file_path = file_path

        try:
            upload_response = supabase_admin.storage.from_('assets').upload(
                file_path,
                contents,
                file_options={"content-type": file.content_type, "upsert": "false"}
            )
            if upload_response and isinstance(upload_response, dict) and upload_response.get('error'):
                # Try file-history bucket as fallback
                fallback_path = file_path
                fallback_response = supabase_admin.storage.from_('file-history').upload(
                    fallback_path,
                    contents,
                    file_options={"content-type": file.content_type, "upsert": "false"}
                )
                if fallback_response and isinstance(fallback_response, dict) and fallback_response.get('error'):
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to upload image to storage: {fallback_response.get('error')}"
                    )
                url_data = supabase_admin.storage.from_('file-history').get_public_url(fallback_path)
                public_url = url_data.get('publicUrl') if isinstance(url_data, dict) else str(url_data)
                final_file_path = fallback_path
            else:
                url_data = supabase_admin.storage.from_('assets').get_public_url(file_path)
                public_url = url_data.get('publicUrl') if isinstance(url_data, dict) else str(url_data)
        except Exception as upload_error:
            logger.error(f"Storage upload error: {upload_error}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to upload image to storage: {str(upload_error)}"
            )

        if not public_url:
            raise HTTPException(
                status_code=500,
                detail="Failed to get public URL for uploaded image"
            )

        return {
            "filePath": final_file_path,
            "fileName": file_name,
            "fileSize": file_size,
            "mimeType": file.content_type,
            "publicUrl": public_url,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading media: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to upload media")


@router.delete("/media/delete")
async def delete_media(
    imageUrl: str = Query(...),
    auth: dict = Depends(verify_auth)
):
    """Delete a media file by its URL (removes database links and optionally the file from storage)"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")

        has_permission = await check_permission(user_id, "canManageMedia")
        if not has_permission:
            raise HTTPException(status_code=403, detail="Permission denied: canManageMedia required")

        if not imageUrl:
            raise HTTPException(status_code=400, detail="Image URL is required")

        # Find all AssetsImage records linked to this image URL
        linked_images = await prisma.assetsimage.find_many(
            where={"imageUrl": imageUrl}
        )

        # Delete all database links for this image (if any exist)
        if linked_images:
            await prisma.assetsimage.delete_many(
                where={"imageUrl": imageUrl}
            )

        # Delete the file from storage
        try:
            supabase_admin = get_supabase_admin_client()
            import re
            from urllib.parse import unquote, urlparse
            
            # Decode URL-encoded characters
            decoded_url = unquote(imageUrl)
            
            # Extract bucket and path from URL
            # URLs are like: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
            url_match = re.search(r'/storage/v1/object/public/([^/]+)/(.+)', decoded_url)
            if url_match:
                bucket = url_match.group(1)
                path = url_match.group(2)
                
                # Remove query parameters from path (e.g., ?t=timestamp)
                path = path.split('?')[0]
                
                # Remove URL-encoding from path
                path = unquote(path)
                
                logger.info(f"Attempting to delete file from storage: bucket={bucket}, path={path}")
                
                # Delete from storage
                delete_response = supabase_admin.storage.from_(bucket).remove([path])
                
                # Check for errors in response
                if delete_response:
                    if isinstance(delete_response, dict):
                        if delete_response.get('error'):
                            logger.error(f"Failed to delete file from storage: {imageUrl}, Error: {delete_response['error']}")
                        else:
                            logger.info(f"Successfully deleted file from storage: {path}")
                    elif isinstance(delete_response, list):
                        # Supabase Python client might return a list
                        logger.info(f"Successfully deleted file from storage: {path}")
                    else:
                        logger.info(f"File deletion response: {delete_response}")
                else:
                    logger.warning(f"No response from storage deletion for: {path}")
            else:
                logger.warning(f"Could not parse storage URL: {imageUrl}")
        except Exception as storage_error:
            logger.error(f"Storage deletion error for {imageUrl}: {storage_error}", exc_info=True)

        return {
            "success": True,
            "message": f"Deleted {len(linked_images)} link(s) and attempted to delete file from storage",
            "deletedLinks": len(linked_images),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting media: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete media")


@router.delete("/media/bulk-delete")
async def bulk_delete_media(
    request: Dict[str, Any],
    auth: dict = Depends(verify_auth)
):
    """Bulk delete media files by URLs (removes database links and optionally files from storage)"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")

        has_permission = await check_permission(user_id, "canManageMedia")
        if not has_permission:
            raise HTTPException(status_code=403, detail="Permission denied: canManageMedia required")

        image_urls = request.get("imageUrls")
        if not image_urls or not isinstance(image_urls, list) or len(image_urls) == 0:
            raise HTTPException(
                status_code=400,
                detail="Image URLs array is required"
            )

        total_deleted_links = 0
        supabase_admin = get_supabase_admin_client()

        for image_url in image_urls:
            # Find all AssetsImage records linked to this image URL
            linked_images = await prisma.assetsimage.find_many(
                where={"imageUrl": image_url}
            )

            # Delete all database links for this image (if any exist)
            if linked_images:
                await prisma.assetsimage.delete_many(
                    where={"imageUrl": image_url}
                )
                total_deleted_links += len(linked_images)

            # Delete the file from storage
            try:
                import re
                from urllib.parse import unquote
                
                # Decode URL-encoded characters
                decoded_url = unquote(image_url)
                
                # Extract bucket and path from URL
                url_match = re.search(r'/storage/v1/object/public/([^/]+)/(.+)', decoded_url)
                if url_match:
                    bucket = url_match.group(1)
                    path = url_match.group(2)
                    
                    # Remove query parameters from path (e.g., ?t=timestamp)
                    path = path.split('?')[0]
                    
                    # Remove URL-encoding from path
                    path = unquote(path)
                    
                    # Delete from storage
                    delete_response = supabase_admin.storage.from_(bucket).remove([path])
                    
                    # Check for errors in response
                    if delete_response:
                        if isinstance(delete_response, dict) and delete_response.get('error'):
                            logger.error(f"Failed to delete file from storage: {image_url}, Error: {delete_response['error']}")
                        else:
                            logger.info(f"Successfully deleted file from storage: {path}")
                    else:
                        logger.warning(f"No response from storage deletion for: {path}")
                else:
                    logger.warning(f"Could not parse storage URL: {image_url}")
            except Exception as storage_error:
                logger.error(f"Storage deletion error for {image_url}: {storage_error}", exc_info=True)

        return {
            "success": True,
            "message": f"Deleted {len(image_urls)} image(s){f' and removed {total_deleted_links} link(s)' if total_deleted_links > 0 else ''}",
            "deletedCount": len(image_urls),
            "deletedLinks": total_deleted_links,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error bulk deleting media: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to bulk delete media")


@router.post("/upload-document")
async def upload_document_to_asset(
    req: Request,
    auth: dict = Depends(verify_auth)
):
    """Upload or link a document to an asset"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")

        has_permission = await check_permission(user_id, "canManageMedia")
        if not has_permission:
            raise HTTPException(status_code=403, detail="Permission denied: canManageMedia required")

        content_type = req.headers.get("content-type", "")
        file: Optional[UploadFile] = None
        asset_tag_id: Optional[str] = None
        document_url: Optional[str] = None
        link_existing = False
        document_type: Optional[str] = None

        # Check if request is JSON (for linking) or FormData (for uploading)
        if "application/json" in content_type:
            # Handle JSON body (linking existing document)
            body = await req.json()
            asset_tag_id = body.get("assetTagId")
            document_url = body.get("documentUrl")
            link_existing = body.get("linkExisting", False)
            document_type = body.get("documentType")
        else:
            # Handle FormData (file upload)
            form = await req.form()
            file = form.get("file")
            if file and isinstance(file, UploadFile):
                pass  # file is already UploadFile
            asset_tag_id = form.get("assetTagId")
            if isinstance(asset_tag_id, str):
                pass
            else:
                asset_tag_id = None
            document_type = form.get("documentType")
            if isinstance(document_type, str):
                pass
            else:
                document_type = None

        if not asset_tag_id:
            raise HTTPException(status_code=400, detail="Asset Tag ID is required")

        # Verify asset exists
        asset = await prisma.assets.find_unique(
            where={"assetTagId": asset_tag_id}
        )

        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")

        # If linking existing document
        if link_existing and document_url:
            # Extract document type and size from URL/storage
            url_extension = document_url.split('.')[-1].split('?')[0].lower() if '.' in document_url else None
            mime_type = None
            if url_extension:
                mime_types = {
                    'pdf': 'application/pdf',
                    'doc': 'application/msword',
                    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'xls': 'application/vnd.ms-excel',
                    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'txt': 'text/plain',
                    'csv': 'text/csv',
                    'rtf': 'application/rtf',
                }
                mime_type = mime_types.get(url_extension)

            # Try to get file size from storage
            document_size = None
            try:
                supabase_admin = get_supabase_admin_client()
                import re
                url_match = re.search(r'/storage/v1/object/public/([^/]+)/(.+)', document_url)
                if url_match:
                    bucket = url_match.group(1)
                    full_path = url_match.group(2)
                    path_parts = full_path.split('/')
                    file_name = path_parts[-1]
                    folder_path = '/'.join(path_parts[:-1]) if len(path_parts) > 1 else ''

                    file_list = supabase_admin.storage.from_(bucket).list(folder_path, {"limit": 1000})
                    if file_list:
                        for f in file_list:
                            if f.get('name') == file_name and f.get('metadata', {}).get('size'):
                                document_size = f['metadata']['size']
                                break
            except Exception as e:
                logger.warning(f"Could not fetch file size from storage: {e}")

            # Extract filename from URL
            url_parts = document_url.split('/')
            file_name = url_parts[-1].split('?')[0] if url_parts else None

            # Create document record
            document_record = await prisma.assetsdocument.create(
                data={
                    "assetTagId": asset_tag_id,
                    "documentUrl": document_url,
                    "documentType": document_type,
                    "documentSize": document_size,
                    "fileName": file_name,
                    "mimeType": mime_type,
                }
            )

            return {
                "id": str(document_record.id),
                "assetTagId": document_record.assetTagId,
                "documentUrl": document_record.documentUrl,
                "publicUrl": document_url,
            }

        # Handle file upload
        if not file:
            raise HTTPException(status_code=400, detail="File is required for upload")

        # Validate file type
        allowed_types = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
            'text/csv',
            'application/rtf',
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/webp',
        ]
        allowed_extensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv', '.rtf', '.jpg', '.jpeg', '.png', '.gif', '.webp']
        file_extension = '.' + (file.filename.split('.')[-1] if '.' in file.filename else '').lower()

        if file.content_type not in allowed_types and file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail="Invalid file type. Only PDF, DOC, DOCX, XLS, XLSX, TXT, CSV, RTF, JPEG, PNG, GIF, and WebP files are allowed."
            )

        # Validate file size
        contents = await file.read()
        file_size = len(contents)
        max_file_size = 5 * 1024 * 1024  # 5MB
        if file_size > max_file_size:
            raise HTTPException(
                status_code=400,
                detail="File size too large. Maximum size is 5MB."
            )

        # Generate unique file path
        timestamp = datetime.now().isoformat().replace(':', '-').replace('.', '-')
        sanitized_extension = file_extension[1:] if file_extension.startswith('.') else 'pdf'
        file_name = f"{asset_tag_id}-{timestamp}.{sanitized_extension}"
        file_path = f"assets_documents/{file_name}"

        # Upload to Supabase storage
        supabase_admin = get_supabase_admin_client()
        public_url = None
        final_file_path = file_path

        try:
            upload_response = supabase_admin.storage.from_('assets').upload(
                file_path,
                contents,
                file_options={"content-type": file.content_type, "upsert": "false"}
            )
            if upload_response and isinstance(upload_response, dict) and upload_response.get('error'):
                # Try file-history bucket as fallback
                fallback_path = f"assets/{file_path}"
                fallback_response = supabase_admin.storage.from_('file-history').upload(
                    fallback_path,
                    contents,
                    file_options={"content-type": file.content_type, "upsert": "false"}
                )
                if fallback_response and isinstance(fallback_response, dict) and fallback_response.get('error'):
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to upload document to storage: {fallback_response.get('error')}"
                    )
                url_data = supabase_admin.storage.from_('file-history').get_public_url(fallback_path)
                public_url = url_data.get('publicUrl') if isinstance(url_data, dict) else str(url_data)
                final_file_path = fallback_path
            else:
                url_data = supabase_admin.storage.from_('assets').get_public_url(file_path)
                public_url = url_data.get('publicUrl') if isinstance(url_data, dict) else str(url_data)
        except Exception as upload_error:
            logger.error(f"Storage upload error: {upload_error}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to upload document to storage: {str(upload_error)}"
            )

        if not public_url:
            raise HTTPException(
                status_code=500,
                detail="Failed to get public URL for uploaded document"
            )

        # Save document record to database
        document_record = await prisma.assetsdocument.create(
            data={
                "assetTagId": asset_tag_id,
                "documentUrl": public_url,
                "documentType": document_type,
                "documentSize": file_size,
                "fileName": file.filename,
                "mimeType": file.content_type,
            }
        )

        return {
            "id": str(document_record.id),
            "assetTagId": document_record.assetTagId,
            "documentUrl": document_record.documentUrl,
            "publicUrl": public_url,
            "filePath": final_file_path,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading/linking document: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to upload/link document")


@router.post("/upload-image")
async def upload_image_to_asset(
    req: Request,
    auth: dict = Depends(verify_auth)
):
    """Upload or link an image to an asset"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")

        has_permission = await check_permission(user_id, "canManageMedia")
        if not has_permission:
            raise HTTPException(status_code=403, detail="Permission denied: canManageMedia required")

        content_type = req.headers.get("content-type", "")
        file: Optional[UploadFile] = None
        asset_tag_id: Optional[str] = None
        image_url: Optional[str] = None
        link_existing = False

        # Check if request is JSON (for linking) or FormData (for uploading)
        if "application/json" in content_type:
            # Handle JSON body (linking existing image)
            body = await req.json()
            asset_tag_id = body.get("assetTagId")
            image_url = body.get("imageUrl")
            link_existing = body.get("linkExisting", False)
        else:
            # Handle FormData (file upload)
            form = await req.form()
            file = form.get("file")
            if file and isinstance(file, UploadFile):
                pass  # file is already UploadFile
            asset_tag_id = form.get("assetTagId")
            if isinstance(asset_tag_id, str):
                pass
            else:
                asset_tag_id = None

        if not asset_tag_id:
            raise HTTPException(status_code=400, detail="Asset Tag ID is required")

        # Verify asset exists
        asset = await prisma.assets.find_unique(
            where={"assetTagId": asset_tag_id}
        )

        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")

        # If linking existing image
        if link_existing and image_url:
            # Extract image type from URL
            url_extension = image_url.split('.')[-1].split('?')[0].lower() if '.' in image_url else None
            image_type = f"image/{url_extension}" if url_extension else None
            if image_type and url_extension == 'jpg':
                image_type = 'image/jpeg'

            # Try to get file size from storage
            image_size = None
            try:
                supabase_admin = get_supabase_admin_client()
                import re
                url_match = re.search(r'/storage/v1/object/public/([^/]+)/(.+)', image_url)
                if url_match:
                    bucket = url_match.group(1)
                    full_path = url_match.group(2)
                    path_parts = full_path.split('/')
                    file_name = path_parts[-1]
                    folder_path = '/'.join(path_parts[:-1]) if len(path_parts) > 1 else ''

                    file_list = supabase_admin.storage.from_(bucket).list(folder_path, {"limit": 1000})
                    if file_list:
                        for f in file_list:
                            if f.get('name') == file_name and f.get('metadata', {}).get('size'):
                                image_size = f['metadata']['size']
                                break
            except Exception as e:
                logger.warning(f"Could not fetch file size from storage: {e}")

            # Create image record
            image_record = await prisma.assetsimage.create(
                data={
                    "assetTagId": asset_tag_id,
                    "imageUrl": image_url,
                    "imageType": image_type,
                    "imageSize": image_size,
                }
            )

            return {
                "id": str(image_record.id),
                "assetTagId": image_record.assetTagId,
                "imageUrl": image_record.imageUrl,
                "publicUrl": image_url,
            }

        # Handle file upload
        if not file:
            raise HTTPException(status_code=400, detail="File is required for upload")

        # Validate file type
        allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail="Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed."
            )

        # Validate file size
        contents = await file.read()
        file_size = len(contents)
        max_size = 5 * 1024 * 1024  # 5MB
        if file_size > max_size:
            raise HTTPException(
                status_code=400,
                detail="File size too large. Maximum size is 5MB."
            )

        # Generate unique file path
        timestamp = datetime.now().isoformat().replace(':', '-').replace('.', '-')
        file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
        sanitized_extension = file_extension.lower()
        file_name = f"{asset_tag_id}-{timestamp}.{sanitized_extension}"
        file_path = f"assets_images/{file_name}"

        # Upload to Supabase storage
        supabase_admin = get_supabase_admin_client()
        public_url = None
        final_file_path = file_path

        try:
            upload_response = supabase_admin.storage.from_('assets').upload(
                file_path,
                contents,
                file_options={"content-type": file.content_type, "upsert": "false"}
            )
            if upload_response and isinstance(upload_response, dict) and upload_response.get('error'):
                # Try file-history bucket as fallback
                fallback_path = f"assets/{file_path}"
                fallback_response = supabase_admin.storage.from_('file-history').upload(
                    fallback_path,
                    contents,
                    file_options={"content-type": file.content_type, "upsert": "false"}
                )
                if fallback_response and isinstance(fallback_response, dict) and fallback_response.get('error'):
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to upload image to storage: {fallback_response.get('error')}"
                    )
                url_data = supabase_admin.storage.from_('file-history').get_public_url(fallback_path)
                public_url = url_data.get('publicUrl') if isinstance(url_data, dict) else str(url_data)
                final_file_path = fallback_path
            else:
                url_data = supabase_admin.storage.from_('assets').get_public_url(file_path)
                public_url = url_data.get('publicUrl') if isinstance(url_data, dict) else str(url_data)
        except Exception as upload_error:
            logger.error(f"Storage upload error: {upload_error}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to upload image to storage: {str(upload_error)}"
            )

        if not public_url:
            raise HTTPException(
                status_code=500,
                detail="Failed to get public URL for uploaded image"
            )

        # Save image record to database
        image_record = await prisma.assetsimage.create(
            data={
                "assetTagId": asset_tag_id,
                "imageUrl": public_url,
                "imageType": file.content_type,
                "imageSize": file_size,
            }
        )

        return {
            "id": str(image_record.id),
            "assetTagId": image_record.assetTagId,
            "imageUrl": image_record.imageUrl,
            "filePath": final_file_path,
            "fileName": file_name,
            "fileSize": file_size,
            "mimeType": file.content_type,
            "publicUrl": public_url,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading image: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to upload image")


@router.get("/{asset_id}", response_model=AssetResponse)
async def get_asset(
    asset_id: str = Path(..., description="Asset ID (UUID) or assetTagId"),
    auth: dict = Depends(verify_auth)
):
    """Get a single asset by ID or assetTagId"""
    try:
        user_id = auth.get("user", {}).get("id") or auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check permission
        has_permission = await check_permission(user_id, "canViewAssets")
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to view assets"
            )
        # Check if it's a UUID or assetTagId
        is_id_uuid = is_uuid(asset_id)
        
        include_options = {
            "category": True,
            "subCategory": True,
            "checkouts": {
                "include": {
                    "employeeUser": True,
                    "checkins": True
                }
            },
            "leases": {
                "include": {
                    "returns": True
                }
            },
            "reservations": {
                "include": {
                    "employeeUser": True
                },
                "order_by": {
                    "reservationDate": "desc"
                }
            },
            "auditHistory": True
        }
        
        # Find the asset by UUID or assetTagId
        if is_id_uuid:
            asset_data = await prisma.assets.find_unique(
                where={"id": asset_id},
                include=include_options
            )
        else:
            # Look up by assetTagId
            asset_data = await prisma.assets.find_first(
                where={"assetTagId": asset_id, "isDeleted": False},
                include=include_options
            )
        
        if not asset_data:
            raise HTTPException(status_code=404, detail=f"Asset with ID {asset_id} not found")
        
        # Get image count
        image_counts = {}
        try:
            # Count images for this asset
            image_count = await prisma.assetsimage.count(
                where={"assetTagId": asset_data.assetTagId}
            )
            image_counts[asset_data.assetTagId] = image_count
        except Exception as e:
            logger.warning(f"Error counting images: {e}")
            image_counts[asset_data.assetTagId] = 0
        
        # Format category info
        category_info = None
        if asset_data.category:
            category_info = CategoryInfo(
                id=str(asset_data.category.id),
                name=str(asset_data.category.name)
            )
        
        # Format subcategory info
        sub_category_info = None
        if asset_data.subCategory:
            sub_category_info = SubCategoryInfo(
                id=str(asset_data.subCategory.id),
                name=str(asset_data.subCategory.name)
            )
        
        # Format checkouts
        checkouts_list = []
        if asset_data.checkouts:
            for checkout in asset_data.checkouts:
                employee_info = None
                if checkout.employeeUser:
                    employee_info = EmployeeInfo(
                        id=str(checkout.employeeUser.id),
                        name=str(checkout.employeeUser.name),
                        email=str(checkout.employeeUser.email),
                        department=checkout.employeeUser.department
                    )
                
                # Format checkins
                checkins_list = []
                if checkout.checkins:
                    for checkin in checkout.checkins:
                        checkins_list.append(CheckinInfo(id=str(checkin.id)))
                
                checkouts_list.append(CheckoutInfo(
                    id=str(checkout.id),
                    checkoutDate=checkout.checkoutDate,
                    expectedReturnDate=checkout.expectedReturnDate,
                    employeeUser=employee_info,
                    checkins=checkins_list if checkins_list else None
                ))
        
        # Format leases
        leases_list = []
        if asset_data.leases:
            for lease in asset_data.leases:
                leases_list.append(LeaseInfo(
                    id=str(lease.id),
                    leaseStartDate=lease.leaseStartDate,
                    leaseEndDate=lease.leaseEndDate,
                    lessee=lease.lessee
                ))
        
        # Format reservations
        reservations_list = []
        if asset_data.reservations:
            for reservation in asset_data.reservations:
                employee_info = None
                if reservation.employeeUser:
                    employee_info = EmployeeInfo(
                        id=str(reservation.employeeUser.id),
                        name=str(reservation.employeeUser.name),
                        email=str(reservation.employeeUser.email),
                        department=reservation.employeeUser.department
                    )
                reservations_list.append(ReservationInfo(
                    id=str(reservation.id),
                    reservationType=reservation.reservationType,
                    department=reservation.department,
                    purpose=reservation.purpose,
                    reservationDate=reservation.reservationDate,
                    employeeUser=employee_info
                ))
        
        # Format audit history
        audit_history_list = []
        if asset_data.auditHistory:
            # Sort by auditDate descending and take only the first 5
            sorted_audits = sorted(
                asset_data.auditHistory,
                key=lambda x: x.auditDate if x.auditDate else datetime.min,
                reverse=True
            )[:5]
            for audit in sorted_audits:
                audit_history_list.append(AuditHistoryInfo(
                    id=str(audit.id),
                    auditDate=audit.auditDate,
                    auditType=audit.auditType,
                    auditor=audit.auditor
                ))
        
        asset = Asset(
            id=str(asset_data.id),
            assetTagId=str(asset_data.assetTagId),
            description=str(asset_data.description),
            purchasedFrom=asset_data.purchasedFrom,
            purchaseDate=asset_data.purchaseDate,
            brand=asset_data.brand,
            cost=asset_data.cost,
            model=asset_data.model,
            serialNo=asset_data.serialNo,
            additionalInformation=asset_data.additionalInformation,
            xeroAssetNo=asset_data.xeroAssetNo,
            owner=asset_data.owner,
            pbiNumber=asset_data.pbiNumber,
            status=asset_data.status,
            issuedTo=asset_data.issuedTo,
            poNumber=asset_data.poNumber,
            paymentVoucherNumber=asset_data.paymentVoucherNumber,
            assetType=asset_data.assetType,
            deliveryDate=asset_data.deliveryDate,
            unaccountedInventory=asset_data.unaccountedInventory,
            remarks=asset_data.remarks,
            qr=asset_data.qr,
            oldAssetTag=asset_data.oldAssetTag,
            depreciableAsset=asset_data.depreciableAsset,
            depreciableCost=asset_data.depreciableCost,
            salvageValue=asset_data.salvageValue,
            assetLifeMonths=asset_data.assetLifeMonths,
            depreciationMethod=asset_data.depreciationMethod,
            dateAcquired=asset_data.dateAcquired,
            categoryId=asset_data.categoryId,
            category=category_info,
            subCategoryId=asset_data.subCategoryId,
            subCategory=sub_category_info,
            department=asset_data.department,
            site=asset_data.site,
            location=asset_data.location,
            createdAt=asset_data.createdAt,
            updatedAt=asset_data.updatedAt,
            deletedAt=asset_data.deletedAt,
            isDeleted=asset_data.isDeleted,
            checkouts=checkouts_list if checkouts_list else None,
            leases=leases_list if leases_list else None,
            reservations=reservations_list if reservations_list else None,
            auditHistory=audit_history_list if audit_history_list else None,
            imagesCount=image_counts.get(asset_data.assetTagId, 0)
        )
        
        return AssetResponse(asset=asset)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching asset: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch asset")

@router.post("", response_model=AssetResponse, status_code=201)
async def create_asset(
    asset_data: AssetCreate,
    auth: dict = Depends(verify_auth)
):
    """Create a new asset"""
    try:
        user_id = auth.get("user", {}).get("id") or auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check permission
        has_permission = await check_permission(user_id, "canCreateAssets")
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to create assets"
            )
        
        # Get user info for history logging
        user_metadata = auth.get("user_metadata", {})
        user_name = (
            user_metadata.get("name") or
            user_metadata.get("full_name") or
            auth.get("email", "").split("@")[0] if auth.get("email") else
            auth.get("user_id", "system")
        )
        
        # Parse dates
        purchase_date = parse_date(asset_data.purchaseDate)
        delivery_date = parse_date(asset_data.deliveryDate)
        date_acquired = parse_date(asset_data.dateAcquired)
        
        # Create asset in transaction
        async with prisma.tx() as transaction:
            # Create the asset
            new_asset_data = await transaction.assets.create(
                data={
                    "assetTagId": asset_data.assetTagId,
                    "description": asset_data.description,
                    "purchasedFrom": asset_data.purchasedFrom,
                    "purchaseDate": purchase_date,
                    "brand": asset_data.brand,
                    "cost": Decimal(str(asset_data.cost)) if asset_data.cost else None,
                    "model": asset_data.model,
                    "serialNo": asset_data.serialNo,
                    "additionalInformation": asset_data.additionalInformation,
                    "xeroAssetNo": asset_data.xeroAssetNo,
                    "owner": asset_data.owner,
                    "pbiNumber": asset_data.pbiNumber,
                    "status": asset_data.status or "Available",
                    "issuedTo": asset_data.issuedTo,
                    "poNumber": asset_data.poNumber,
                    "paymentVoucherNumber": asset_data.paymentVoucherNumber,
                    "assetType": asset_data.assetType,
                    "deliveryDate": delivery_date,
                    "unaccountedInventory": asset_data.unaccountedInventory or False,
                    "remarks": asset_data.remarks,
                    "qr": asset_data.qr,
                    "oldAssetTag": asset_data.oldAssetTag,
                    "depreciableAsset": asset_data.depreciableAsset or False,
                    "depreciableCost": Decimal(str(asset_data.depreciableCost)) if asset_data.depreciableCost else None,
                    "salvageValue": Decimal(str(asset_data.salvageValue)) if asset_data.salvageValue else None,
                    "assetLifeMonths": asset_data.assetLifeMonths,
                    "depreciationMethod": asset_data.depreciationMethod,
                    "dateAcquired": date_acquired,
                    "categoryId": asset_data.categoryId,
                    "subCategoryId": asset_data.subCategoryId,
                    "department": asset_data.department,
                    "site": asset_data.site,
                    "location": asset_data.location
                },
                include={
                    "category": True,
                    "subCategory": True,
                    "checkouts": {
                        "include": {
                            "employeeUser": True
                        }
                    }
                }
            )
            
            # Create history log for asset creation
            await transaction.assetshistorylogs.create(
                data={
                    "assetId": new_asset_data.id,
                    "eventType": "added",
                    "actionBy": user_name
                }
            )
        
        # Convert to Asset model
        category_info = None
        if new_asset_data.category:
            category_info = CategoryInfo(
                id=str(new_asset_data.category.id),
                name=str(new_asset_data.category.name)
            )
        
        sub_category_info = None
        if new_asset_data.subCategory:
            sub_category_info = SubCategoryInfo(
                id=str(new_asset_data.subCategory.id),
                name=str(new_asset_data.subCategory.name)
            )
        
        checkouts_list = []
        if new_asset_data.checkouts:
            # Sort by checkoutDate descending and take only the first one
            sorted_checkouts = sorted(
                new_asset_data.checkouts,
                key=lambda x: x.checkoutDate if x.checkoutDate else datetime.min,
                reverse=True
            )[:1]
            for checkout in sorted_checkouts:
                employee_info = None
                if checkout.employeeUser:
                    employee_info = EmployeeInfo(
                        id=str(checkout.employeeUser.id),
                        name=str(checkout.employeeUser.name),
                        email=str(checkout.employeeUser.email)
                    )
                checkouts_list.append(CheckoutInfo(
                    id=str(checkout.id),
                    checkoutDate=checkout.checkoutDate,
                    expectedReturnDate=checkout.expectedReturnDate,
                    employeeUser=employee_info
                ))
        
        asset = Asset(
            id=str(new_asset_data.id),
            assetTagId=str(new_asset_data.assetTagId),
            description=str(new_asset_data.description),
            purchasedFrom=new_asset_data.purchasedFrom,
            purchaseDate=new_asset_data.purchaseDate,
            brand=new_asset_data.brand,
            cost=new_asset_data.cost,
            model=new_asset_data.model,
            serialNo=new_asset_data.serialNo,
            additionalInformation=new_asset_data.additionalInformation,
            xeroAssetNo=new_asset_data.xeroAssetNo,
            owner=new_asset_data.owner,
            pbiNumber=new_asset_data.pbiNumber,
            status=new_asset_data.status,
            issuedTo=new_asset_data.issuedTo,
            poNumber=new_asset_data.poNumber,
            paymentVoucherNumber=new_asset_data.paymentVoucherNumber,
            assetType=new_asset_data.assetType,
            deliveryDate=new_asset_data.deliveryDate,
            unaccountedInventory=new_asset_data.unaccountedInventory,
            remarks=new_asset_data.remarks,
            qr=new_asset_data.qr,
            oldAssetTag=new_asset_data.oldAssetTag,
            depreciableAsset=new_asset_data.depreciableAsset,
            depreciableCost=new_asset_data.depreciableCost,
            salvageValue=new_asset_data.salvageValue,
            assetLifeMonths=new_asset_data.assetLifeMonths,
            depreciationMethod=new_asset_data.depreciationMethod,
            dateAcquired=new_asset_data.dateAcquired,
            categoryId=new_asset_data.categoryId,
            category=category_info,
            subCategoryId=new_asset_data.subCategoryId,
            subCategory=sub_category_info,
            department=new_asset_data.department,
            site=new_asset_data.site,
            location=new_asset_data.location,
            createdAt=new_asset_data.createdAt,
            updatedAt=new_asset_data.updatedAt,
            deletedAt=new_asset_data.deletedAt,
            isDeleted=new_asset_data.isDeleted,
            checkouts=checkouts_list if checkouts_list else None,
            imagesCount=0
        )
        
        return AssetResponse(asset=asset)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating asset: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to create asset")

@router.put("/{asset_id}", response_model=AssetResponse)
async def update_asset(
    asset_id: str = Path(..., description="Asset ID (UUID) or assetTagId"),
    asset_data: AssetUpdate = None,
    auth: dict = Depends(verify_auth)
):
    """Update an existing asset"""
    try:
        user_id = auth.get("user", {}).get("id") or auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check permission
        has_permission = await check_permission(user_id, "canEditAssets")
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to edit assets"
            )
        
        # Get user info for history logging
        user_metadata = auth.get("user_metadata", {})
        user_name = (
            user_metadata.get("name") or
            user_metadata.get("full_name") or
            auth.get("email", "").split("@")[0] if auth.get("email") else
            auth.get("user_id", "system")
        )
        
        # Check if it's a UUID or assetTagId
        is_id_uuid = is_uuid(asset_id)
        
        # Check if asset exists
        if is_id_uuid:
            current_asset = await prisma.assets.find_unique(where={"id": asset_id})
        else:
            current_asset = await prisma.assets.find_first(where={"assetTagId": asset_id, "isDeleted": False})
        
        if not current_asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        
        # Use the actual UUID for subsequent operations
        actual_asset_id = current_asset.id
        
        # Check if assetTagId is being changed and if it already exists
        if asset_data.assetTagId and asset_data.assetTagId != current_asset.assetTagId:
            existing_asset = await prisma.assets.find_first(
                where={
                    "assetTagId": asset_data.assetTagId,
                    "id": {"not": actual_asset_id}
                }
            )
            if existing_asset:
                raise HTTPException(status_code=400, detail="Asset tag ID already exists")
        
        # Build update data - only include fields that are provided
        update_data: Dict[str, Any] = {}
        
        # Helper to add field if provided (not None)
        def add_if_provided(field_name: str, value: Any, transform=None):
            if value is not None:
                update_data[field_name] = transform(value) if transform else value
        
        # String fields
        add_if_provided("assetTagId", asset_data.assetTagId)
        add_if_provided("description", asset_data.description)
        add_if_provided("purchasedFrom", asset_data.purchasedFrom)
        add_if_provided("brand", asset_data.brand)
        add_if_provided("model", asset_data.model)
        add_if_provided("serialNo", asset_data.serialNo)
        add_if_provided("additionalInformation", asset_data.additionalInformation)
        add_if_provided("xeroAssetNo", asset_data.xeroAssetNo)
        add_if_provided("owner", asset_data.owner)
        add_if_provided("pbiNumber", asset_data.pbiNumber)
        add_if_provided("status", asset_data.status)
        add_if_provided("issuedTo", asset_data.issuedTo)
        add_if_provided("poNumber", asset_data.poNumber)
        add_if_provided("paymentVoucherNumber", asset_data.paymentVoucherNumber)
        add_if_provided("assetType", asset_data.assetType)
        add_if_provided("remarks", asset_data.remarks)
        add_if_provided("qr", asset_data.qr)
        add_if_provided("oldAssetTag", asset_data.oldAssetTag)
        add_if_provided("depreciationMethod", asset_data.depreciationMethod)
        add_if_provided("department", asset_data.department)
        add_if_provided("site", asset_data.site)
        add_if_provided("location", asset_data.location)
        add_if_provided("categoryId", asset_data.categoryId)
        add_if_provided("subCategoryId", asset_data.subCategoryId)
        
        # Numeric fields
        if asset_data.cost is not None:
            update_data["cost"] = Decimal(str(asset_data.cost)) if asset_data.cost else None
        if asset_data.depreciableCost is not None:
            update_data["depreciableCost"] = Decimal(str(asset_data.depreciableCost)) if asset_data.depreciableCost else None
        if asset_data.salvageValue is not None:
            update_data["salvageValue"] = Decimal(str(asset_data.salvageValue)) if asset_data.salvageValue else None
        if asset_data.assetLifeMonths is not None:
            update_data["assetLifeMonths"] = asset_data.assetLifeMonths
        
        # Boolean fields
        if asset_data.unaccountedInventory is not None:
            update_data["unaccountedInventory"] = asset_data.unaccountedInventory
        if asset_data.depreciableAsset is not None:
            update_data["depreciableAsset"] = asset_data.depreciableAsset
        
        # Date fields
        if asset_data.purchaseDate is not None:
            update_data["purchaseDate"] = parse_date(asset_data.purchaseDate)
        if asset_data.deliveryDate is not None:
            update_data["deliveryDate"] = parse_date(asset_data.deliveryDate)
        if asset_data.dateAcquired is not None:
            update_data["dateAcquired"] = parse_date(asset_data.dateAcquired)
        
        # Track changes for history logging
        history_logs = []
        date_fields = ["purchaseDate", "deliveryDate", "dateAcquired"]
        numeric_fields = ["cost", "depreciableCost", "salvageValue", "assetLifeMonths"]
        
        for field, new_value in update_data.items():
            old_value = getattr(current_asset, field, None)
            
            # Normalize for comparison
            if field in date_fields:
                old_date_str = old_value.strftime("%Y-%m-%d") if old_value else ""
                new_date_str = new_value.strftime("%Y-%m-%d") if new_value else ""
                if old_date_str != new_date_str:
                    history_logs.append({
                        "field": field,
                        "changeFrom": old_date_str,
                        "changeTo": new_date_str
                    })
            elif field in numeric_fields:
                # Compare numeric values, not string representations
                # This prevents false changes like "45000" vs "45000.0"
                old_num = float(old_value) if old_value is not None else None
                new_num = float(new_value) if new_value is not None else None
                if old_num != new_num:
                    # Format for display: remove trailing zeros for cleaner logs
                    old_str = f"{old_num:g}" if old_num is not None else ""
                    new_str = f"{new_num:g}" if new_num is not None else ""
                    history_logs.append({
                        "field": field,
                        "changeFrom": old_str,
                        "changeTo": new_str
                    })
            else:
                old_str = str(old_value) if old_value is not None else ""
                new_str = str(new_value) if new_value is not None else ""
                if old_str != new_str:
                    history_logs.append({
                        "field": field,
                        "changeFrom": old_str,
                        "changeTo": new_str
                    })
        
        # Update asset and create history logs in transaction
        async with prisma.tx() as transaction:
            # Update asset
            # Note: Prisma Python doesn't support 'order' inside 'include', so we'll sort in Python
            updated_asset_data = await transaction.assets.update(
                where={"id": actual_asset_id},
                data=update_data,
                include={
                    "category": True,
                    "subCategory": True,
                    "checkouts": {
                        "include": {
                            "employeeUser": True
                        }
                    }
                }
            )
            
            # Create history logs for each changed field
            for log in history_logs:
                await transaction.assetshistorylogs.create(
                    data={
                        "assetId": actual_asset_id,
                        "eventType": "edited",
                        "field": log["field"],
                        "changeFrom": log["changeFrom"],
                        "changeTo": log["changeTo"],
                        "actionBy": user_name
                    }
                )
        
        # Get image count
        image_count = await prisma.assetsimage.count(
            where={"assetTagId": updated_asset_data.assetTagId}
        )
        
        # Convert to Asset model
        category_info = None
        if updated_asset_data.category:
            category_info = CategoryInfo(
                id=str(updated_asset_data.category.id),
                name=str(updated_asset_data.category.name)
            )
        
        sub_category_info = None
        if updated_asset_data.subCategory:
            sub_category_info = SubCategoryInfo(
                id=str(updated_asset_data.subCategory.id),
                name=str(updated_asset_data.subCategory.name)
            )
        
        checkouts_list = []
        if updated_asset_data.checkouts:
            # Sort by checkoutDate descending (most recent first)
            # Note: Prisma Python doesn't support 'order' inside 'include', so we sort in Python
            sorted_checkouts = sorted(
                updated_asset_data.checkouts,
                key=lambda x: x.checkoutDate if x.checkoutDate else datetime.min,
                reverse=True
            )
            for checkout in sorted_checkouts[:1]:
                employee_info = None
                if checkout.employeeUser:
                    employee_info = EmployeeInfo(
                        id=str(checkout.employeeUser.id),
                        name=str(checkout.employeeUser.name),
                        email=str(checkout.employeeUser.email)
                    )
                checkouts_list.append(CheckoutInfo(
                    id=str(checkout.id),
                    checkoutDate=checkout.checkoutDate,
                    expectedReturnDate=checkout.expectedReturnDate,
                    employeeUser=employee_info
                ))
        
        asset = Asset(
            id=str(updated_asset_data.id),
            assetTagId=str(updated_asset_data.assetTagId),
            description=str(updated_asset_data.description),
            purchasedFrom=updated_asset_data.purchasedFrom,
            purchaseDate=updated_asset_data.purchaseDate,
            brand=updated_asset_data.brand,
            cost=updated_asset_data.cost,
            model=updated_asset_data.model,
            serialNo=updated_asset_data.serialNo,
            additionalInformation=updated_asset_data.additionalInformation,
            xeroAssetNo=updated_asset_data.xeroAssetNo,
            owner=updated_asset_data.owner,
            pbiNumber=updated_asset_data.pbiNumber,
            status=updated_asset_data.status,
            issuedTo=updated_asset_data.issuedTo,
            poNumber=updated_asset_data.poNumber,
            paymentVoucherNumber=updated_asset_data.paymentVoucherNumber,
            assetType=updated_asset_data.assetType,
            deliveryDate=updated_asset_data.deliveryDate,
            unaccountedInventory=updated_asset_data.unaccountedInventory,
            remarks=updated_asset_data.remarks,
            qr=updated_asset_data.qr,
            oldAssetTag=updated_asset_data.oldAssetTag,
            depreciableAsset=updated_asset_data.depreciableAsset,
            depreciableCost=updated_asset_data.depreciableCost,
            salvageValue=updated_asset_data.salvageValue,
            assetLifeMonths=updated_asset_data.assetLifeMonths,
            depreciationMethod=updated_asset_data.depreciationMethod,
            dateAcquired=updated_asset_data.dateAcquired,
            categoryId=updated_asset_data.categoryId,
            category=category_info,
            subCategoryId=updated_asset_data.subCategoryId,
            subCategory=sub_category_info,
            department=updated_asset_data.department,
            site=updated_asset_data.site,
            location=updated_asset_data.location,
            createdAt=updated_asset_data.createdAt,
            updatedAt=updated_asset_data.updatedAt,
            deletedAt=updated_asset_data.deletedAt,
            isDeleted=updated_asset_data.isDeleted,
            checkouts=checkouts_list if checkouts_list else None,
            imagesCount=image_count
        )
        
        return AssetResponse(asset=asset)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating asset: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update asset")

@router.delete("/{asset_id}", response_model=DeleteResponse)
async def delete_asset(
    asset_id: str = Path(..., description="Asset ID (UUID) or assetTagId"),
    permanent: bool = Query(False, description="Permanently delete the asset"),
    auth: dict = Depends(verify_auth)
):
    """Delete an asset (soft delete by default, permanent if specified)"""
    try:
        user_id = auth.get("user", {}).get("id") or auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check permission
        has_permission = await check_permission(user_id, "canDeleteAssets")
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to delete assets"
            )
        
        # Get user info for history logging
        user_metadata = auth.get("user_metadata", {})
        user_name = (
            user_metadata.get("name") or
            user_metadata.get("full_name") or
            auth.get("email", "").split("@")[0] if auth.get("email") else
            auth.get("user_id", "system")
        )
        
        # Check if it's a UUID or assetTagId
        is_id_uuid = is_uuid(asset_id)
        
        # Check if asset exists
        if is_id_uuid:
            existing_asset = await prisma.assets.find_unique(where={"id": asset_id})
        else:
            existing_asset = await prisma.assets.find_first(where={"assetTagId": asset_id, "isDeleted": False})
        
        if not existing_asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        
        # Use the actual UUID for operations
        actual_asset_id = existing_asset.id
        
        if permanent:
            # Permanent delete (hard delete)
            async with prisma.tx() as transaction:
                # Log history before deleting
                await transaction.assetshistorylogs.create(
                    data={
                        "assetId": actual_asset_id,
                        "eventType": "deleted",
                        "actionBy": user_name
                    }
                )
                
                # Delete the asset
                await transaction.assets.delete(
                    where={"id": actual_asset_id}
                )
            
            return DeleteResponse(
                success=True,
                message="Asset permanently deleted"
            )
        else:
            # Soft delete
            async with prisma.tx() as transaction:
                # Log history
                await transaction.assetshistorylogs.create(
                    data={
                        "assetId": actual_asset_id,
                        "eventType": "deleted",
                        "actionBy": user_name
                    }
                )
                
                # Soft delete - set isDeleted and deletedAt
                await transaction.assets.update(
                    where={"id": actual_asset_id},
                    data={
                        "deletedAt": datetime.now(),
                        "isDeleted": True
                    }
                )
            
            return DeleteResponse(
                success=True,
                message="Asset archived. It will be permanently deleted after 30 days."
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting asset: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete asset")


@router.delete("/history/{history_id}")
async def delete_history_log(
    history_id: str,
    auth: dict = Depends(verify_auth)
):
    """Delete a history log record"""
    try:
        # Check if history log record exists
        history_log = await prisma.assetshistorylogs.find_unique(
            where={"id": history_id}
        )
        
        if not history_log:
            raise HTTPException(status_code=404, detail="History log record not found")
        
        # Delete the history log record
        await prisma.assetshistorylogs.delete(
            where={"id": history_id}
        )
        
        return {"success": True}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting history log record: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete history log record")


@router.patch("/{asset_id}/restore")
async def restore_asset(
    asset_id: str = Path(..., description="Asset ID (UUID) or assetTagId"),
    auth: dict = Depends(verify_auth)
):
    """Restore a soft-deleted asset"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check permission
        has_permission = await check_permission(user_id, "canManageTrash")
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to restore assets"
            )
        
        # Check if it's a UUID or assetTagId
        is_id_uuid = is_uuid(asset_id)
        
        # Check if asset exists and is soft-deleted
        if is_id_uuid:
            asset = await prisma.assets.find_first(where={"id": asset_id, "isDeleted": True})
        else:
            asset = await prisma.assets.find_first(where={"assetTagId": asset_id, "isDeleted": True})
        
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found or not deleted")
        
        # Use the actual UUID for operations
        actual_asset_id = asset.id
        
        # Restore asset
        await prisma.assets.update(
            where={"id": actual_asset_id},
            data={
                "deletedAt": None,
                "isDeleted": False
            }
        )
        
        return {"success": True, "message": "Asset restored successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error restoring asset: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to restore asset")


@router.post("/bulk-restore", response_model=BulkRestoreResponse)
async def bulk_restore_assets(
    request: BulkRestoreRequest,
    auth: dict = Depends(verify_auth)
):
    """Bulk restore multiple soft-deleted assets"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check permission
        has_permission = await check_permission(user_id, "canManageTrash")
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to restore assets"
            )
        
        if not request.ids or len(request.ids) == 0:
            raise HTTPException(status_code=400, detail="Invalid request. Expected an array of asset IDs.")
        
        # Restore all assets in a transaction
        async with prisma.tx() as transaction:
            # Update all assets to restore them
            result = await transaction.assets.update_many(
                where={
                    "id": {"in": request.ids},
                    "isDeleted": True  # Only restore assets that are actually deleted
                },
                data={
                    "deletedAt": None,
                    "isDeleted": False
                }
            )
        
        return BulkRestoreResponse(
            success=True,
            restoredCount=result,
            message=f"{result} asset(s) restored successfully"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error bulk restoring assets: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to restore assets")


@router.delete("/trash/empty")
async def empty_trash(
    auth: dict = Depends(verify_auth)
):
    """Permanently delete all soft-deleted assets"""
    try:
        user_id = auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check permission
        has_permission = await check_permission(user_id, "canManageTrash")
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to empty trash"
            )
        
        # Permanently delete all soft-deleted assets
        result = await prisma.assets.delete_many(
            where={
                "isDeleted": True
            }
        )
        
        return {
            "success": True,
            "deletedCount": result,
            "message": f"{result} asset(s) permanently deleted"
        }
    
    except Exception as e:
        logger.error(f"Error emptying trash: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to empty trash")


@router.post("/bulk-delete", response_model=BulkDeleteResponse)
async def bulk_delete_assets(
    request: BulkDeleteRequest,
    auth: dict = Depends(verify_auth)
):
    """Bulk delete multiple assets (soft delete or permanent)"""
    try:
        user_id = auth.get("user", {}).get("id") or auth.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check permission
        has_permission = await check_permission(user_id, "canDeleteAssets")
        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to delete assets"
            )
        
        user_metadata = auth.get("user_metadata", {})
        user_name = (
            user_metadata.get("name") or
            user_metadata.get("full_name") or
            auth.get("email", "").split("@")[0] if auth.get("email") else
            auth.get("user_id", "system")
        )
        
        if not request.ids or len(request.ids) == 0:
            raise HTTPException(status_code=400, detail="Invalid request. Expected an array of asset IDs.")
        
        if request.permanent:
            # Permanent delete (hard delete)
            async with prisma.tx() as transaction:
                # Log history for each asset before deleting
                for asset_id in request.ids:
                    await transaction.assetshistorylogs.create(
                        data={
                            "assetId": asset_id,
                            "eventType": "deleted",
                            "actionBy": user_name
                        }
                    )
                
                # Delete all assets
                result = await transaction.assets.delete_many(
                    where={
                        "id": {"in": request.ids}
                    }
                )
            
            return BulkDeleteResponse(
                success=True,
                deletedCount=result,
                message=f"{result} asset(s) permanently deleted"
            )
        else:
            # Soft delete
            async with prisma.tx() as transaction:
                # Log history for each asset
                for asset_id in request.ids:
                    await transaction.assetshistorylogs.create(
                        data={
                            "assetId": asset_id,
                            "eventType": "deleted",
                            "actionBy": user_name
                        }
                    )
                
                # Soft delete - set isDeleted and deletedAt
                result = await transaction.assets.update_many(
                    where={
                        "id": {"in": request.ids}
                    },
                    data={
                        "deletedAt": datetime.now(),
                        "isDeleted": True
                    }
                )
            
            return BulkDeleteResponse(
                success=True,
                deletedCount=result,
                message=f"{result} asset(s) archived. They will be permanently deleted after 30 days."
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error bulk deleting assets: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete assets")


# ==================== ASSET PDF GENERATION ====================

from fastapi.responses import Response
from pydantic import BaseModel

class PDFSections(BaseModel):
    """Sections to include in the PDF"""
    basicDetails: bool = True
    checkout: bool = True
    creation: bool = True
    auditHistory: bool = True
    maintenance: bool = True
    reservations: bool = True
    historyLogs: bool = True
    photos: bool = True
    documents: bool = True


def format_date_pdf(date_val) -> str:
    """Format date for PDF"""
    if not date_val:
        return 'N/A'
    try:
        if isinstance(date_val, str):
            date_val = datetime.fromisoformat(date_val.replace('Z', '+00:00'))
        return date_val.strftime('%b %d, %Y')
    except:
        return 'N/A'


def format_datetime_pdf(date_val) -> str:
    """Format datetime for PDF"""
    if not date_val:
        return 'N/A'
    try:
        if isinstance(date_val, str):
            date_val = datetime.fromisoformat(date_val.replace('Z', '+00:00'))
        return date_val.strftime('%b %d, %Y %I:%M %p')
    except:
        return 'N/A'


def format_currency_pdf(value) -> str:
    """Format currency for PDF (using PHP instead of ₱ for font compatibility)"""
    if value is None:
        return 'N/A'
    try:
        return f"PHP {float(value):,.2f}"
    except:
        return 'N/A'


@router.post("/{asset_id}/pdf")
async def generate_asset_pdf(
    asset_id: str = Path(..., description="Asset ID (UUID) or assetTagId"),
    sections: PDFSections = None,
    auth: dict = Depends(verify_auth)
):
    """Generate PDF for a single asset with all its details"""
    try:
        from fpdf import FPDF
    except ImportError:
        raise HTTPException(status_code=500, detail="PDF generation not available - fpdf2 not installed")
    
    if sections is None:
        sections = PDFSections()
    
    try:
        # Check if it's a UUID or assetTagId
        is_id_uuid = is_uuid(asset_id)
        
        # Fetch asset with related data
        if is_id_uuid:
            asset = await prisma.assets.find_first(
                where={"id": asset_id, "isDeleted": False},
                include={
                    "category": True,
                    "subCategory": True,
                    "checkouts": {
                        "include": {
                            "employeeUser": True,
                            "checkins": True
                        }
                    },
                    "auditHistory": True
                }
            )
        else:
            asset = await prisma.assets.find_first(
                where={"assetTagId": asset_id, "isDeleted": False},
                include={
                    "category": True,
                    "subCategory": True,
                    "checkouts": {
                        "include": {
                            "employeeUser": True,
                            "checkins": True
                        }
                    },
                    "auditHistory": True
                }
            )
        
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        
        # Sort checkouts and audit history
        if asset.checkouts:
            asset.checkouts = sorted(asset.checkouts, key=lambda x: x.checkoutDate if x.checkoutDate else datetime.min, reverse=True)[:10]
        if asset.auditHistory:
            asset.auditHistory = sorted(asset.auditHistory, key=lambda x: x.auditDate if x.auditDate else datetime.min, reverse=True)
        
        # Fetch additional related data
        maintenances = await prisma.assetsmaintenance.find_many(
            where={"assetId": asset.id}
        )
        maintenances = sorted(maintenances, key=lambda x: x.createdAt if x.createdAt else datetime.min, reverse=True)
        
        reservations = await prisma.assetsreserve.find_many(
            where={"assetId": asset.id},
            include={"employeeUser": True}
        )
        reservations = sorted(reservations, key=lambda x: x.reservationDate if x.reservationDate else datetime.min, reverse=True)
        
        history_logs = await prisma.assetshistorylogs.find_many(
            where={"assetId": asset.id}
        )
        history_logs = sorted(history_logs, key=lambda x: x.eventDate if x.eventDate else datetime.min, reverse=True)
        
        images = await prisma.assetsimage.find_many(
            where={"assetTagId": asset.assetTagId}
        )
        images = sorted(images, key=lambda x: x.createdAt if x.createdAt else datetime.min, reverse=True)
        
        documents = await prisma.assetsdocument.find_many(
            where={"assetTagId": asset.assetTagId}
        )
        documents = sorted(documents, key=lambda x: x.createdAt if x.createdAt else datetime.min, reverse=True)
        
        # Find active checkout
        active_checkout = None
        if asset.checkouts:
            for checkout in asset.checkouts:
                if not checkout.checkins or len(checkout.checkins) == 0:
                    active_checkout = checkout
                    break
        
        assigned_to = active_checkout.employeeUser.name if active_checkout and active_checkout.employeeUser else 'N/A'
        issued_to = asset.issuedTo or 'N/A'
        
        # Find creator from history logs
        creation_log = next((log for log in history_logs if log.eventType == 'added'), None)
        created_by = creation_log.actionBy if creation_log else 'N/A'
        
        # Create PDF
        class AssetPDF(FPDF):
            def __init__(self):
                super().__init__(orientation='P', format='A4')
                self.set_auto_page_break(auto=True, margin=15)
                
            def header(self):
                pass  # Custom header in body
                
            def footer(self):
                self.set_y(-15)
                self.set_font('Helvetica', 'I', 8)
                self.set_text_color(128, 128, 128)
                self.cell(0, 10, f'Page {self.page_no()}', align='C')
        
        pdf = AssetPDF()
        pdf.add_page()
        
        # Title
        pdf.set_font('Helvetica', 'B', 18)
        pdf.set_text_color(102, 126, 234)
        pdf.cell(0, 10, f'Asset Details: {asset.assetTagId}', new_x='LMARGIN', new_y='NEXT', align='C')
        
        pdf.set_font('Helvetica', '', 10)
        pdf.set_text_color(100, 100, 100)
        pdf.cell(0, 6, f'Description: {asset.description or "N/A"}', new_x='LMARGIN', new_y='NEXT', align='C')
        pdf.cell(0, 6, f'Generated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}', new_x='LMARGIN', new_y='NEXT', align='C')
        pdf.ln(10)
        
        def add_section_title(title: str):
            pdf.set_font('Helvetica', 'B', 12)
            pdf.set_text_color(51, 51, 51)
            pdf.set_fill_color(240, 240, 240)
            pdf.cell(0, 8, title, new_x='LMARGIN', new_y='NEXT', fill=True)
            pdf.ln(2)
        
        def add_key_value_row(key: str, value: str, wrap: bool = False):
            value_str = str(value) if value else 'N/A'
            key_width = 70
            value_width = pdf.w - pdf.l_margin - pdf.r_margin - key_width
            
            if wrap and len(value_str) > 50:
                # For long text, use multi_cell with proper row height
                # Calculate needed height
                pdf.set_font('Helvetica', '', 9)
                chars_per_line = int(value_width / 2.2)  # Approximate chars per line
                lines_needed = max(1, -(-len(value_str) // chars_per_line))  # Ceiling division
                row_height = max(6, lines_needed * 5)
                
                start_x = pdf.get_x()
                start_y = pdf.get_y()
                
                # Draw key cell
                pdf.set_font('Helvetica', 'B', 9)
                pdf.set_text_color(80, 80, 80)
                pdf.cell(key_width, row_height, key, border=1)
                
                # Draw value cell border
                pdf.cell(value_width, row_height, '', border=1)
                
                # Fill value with multi_cell
                pdf.set_xy(start_x + key_width + 1, start_y + 1)
                pdf.set_font('Helvetica', '', 9)
                pdf.set_text_color(51, 51, 51)
                pdf.multi_cell(value_width - 2, 5, value_str, border=0, align='L')
                
                pdf.set_xy(start_x, start_y + row_height)
            else:
                # Standard single-line row
                pdf.set_font('Helvetica', 'B', 9)
                pdf.set_text_color(80, 80, 80)
                pdf.cell(key_width, 6, key, border=1)
                pdf.set_font('Helvetica', '', 9)
                pdf.set_text_color(51, 51, 51)
                pdf.cell(value_width, 6, value_str[:60], border=1, new_x='LMARGIN', new_y='NEXT')
        
        def add_table(headers: list, rows: list):
            if not rows:
                pdf.set_font('Helvetica', 'I', 9)
                pdf.cell(0, 6, 'No records found', new_x='LMARGIN', new_y='NEXT')
                return
            
            num_cols = len(headers)
            col_width = (pdf.w - 20) / num_cols
            
            # Header
            pdf.set_font('Helvetica', 'B', 8)
            pdf.set_fill_color(102, 126, 234)
            pdf.set_text_color(255, 255, 255)
            for header in headers:
                pdf.cell(col_width, 7, str(header)[:15], border=1, fill=True, align='C')
            pdf.ln()
            
            # Rows
            pdf.set_font('Helvetica', '', 7)
            pdf.set_text_color(51, 51, 51)
            fill = False
            for row in rows:
                if pdf.get_y() > 260:
                    pdf.add_page()
                    # Re-add header
                    pdf.set_font('Helvetica', 'B', 8)
                    pdf.set_fill_color(102, 126, 234)
                    pdf.set_text_color(255, 255, 255)
                    for header in headers:
                        pdf.cell(col_width, 7, str(header)[:15], border=1, fill=True, align='C')
                    pdf.ln()
                    pdf.set_font('Helvetica', '', 7)
                    pdf.set_text_color(51, 51, 51)
                
                pdf.set_fill_color(248, 248, 248) if fill else pdf.set_fill_color(255, 255, 255)
                for cell in row:
                    pdf.cell(col_width, 6, str(cell)[:20] if cell else '-', border=1, fill=fill)
                pdf.ln()
                fill = not fill
        
        # Basic Details Section
        if sections.basicDetails:
            add_section_title('Basic Details')
            add_key_value_row('Asset Tag ID', asset.assetTagId)
            add_key_value_row('Purchase Date', format_date_pdf(asset.purchaseDate))
            add_key_value_row('Cost', format_currency_pdf(asset.cost))
            add_key_value_row('Brand', asset.brand or 'N/A')
            add_key_value_row('Model', asset.model or 'N/A', wrap=True)
            add_key_value_row('Serial No', asset.serialNo or 'N/A')
            add_key_value_row('Site', asset.site or 'N/A')
            add_key_value_row('Location', asset.location or 'N/A')
            add_key_value_row('Category', asset.category.name if asset.category else 'N/A')
            add_key_value_row('Sub-Category', asset.subCategory.name if asset.subCategory else 'N/A')
            add_key_value_row('Department', asset.department or 'N/A')
            add_key_value_row('Assigned To', assigned_to)
            add_key_value_row('Issued To', issued_to)
            add_key_value_row('Status', asset.status or 'N/A')
            add_key_value_row('Owner', asset.owner or 'N/A')
            add_key_value_row('PO Number', asset.poNumber or 'N/A')
            add_key_value_row('Purchased From', asset.purchasedFrom or 'N/A')
            add_key_value_row('Xero Asset No', asset.xeroAssetNo or 'N/A')
            add_key_value_row('PBI Number', asset.pbiNumber or 'N/A')
            add_key_value_row('Payment Voucher', asset.paymentVoucherNumber or 'N/A')
            add_key_value_row('Asset Type', asset.assetType or 'N/A')
            add_key_value_row('Delivery Date', format_date_pdf(asset.deliveryDate))
            add_key_value_row('Old Asset Tag', asset.oldAssetTag or 'N/A')
            add_key_value_row('QR Code', asset.qr or 'N/A')
            add_key_value_row('Additional Info', asset.additionalInformation or 'N/A', wrap=True)
            add_key_value_row('Remarks', asset.remarks or 'N/A', wrap=True)
            add_key_value_row('Unaccounted Inventory', asset.unaccountedInventory or 'N/A')
            add_key_value_row('Description', asset.description or 'N/A', wrap=True)
            pdf.ln(5)
        
        # Checkout Section
        if sections.checkout and active_checkout:
            add_section_title('Current Checkout')
            add_key_value_row('Checkout Date', format_date_pdf(active_checkout.checkoutDate))
            add_key_value_row('Expected Return', format_date_pdf(active_checkout.expectedReturnDate))
            if active_checkout.employeeUser:
                add_key_value_row('Assigned To', active_checkout.employeeUser.name or 'N/A')
                add_key_value_row('Employee Email', active_checkout.employeeUser.email or 'N/A')
            pdf.ln(5)
        
        # Creation Section
        if sections.creation:
            add_section_title('Creation Info')
            add_key_value_row('Created By', created_by)
            add_key_value_row('Created At', format_datetime_pdf(asset.createdAt))
            add_key_value_row('Updated At', format_datetime_pdf(asset.updatedAt))
            pdf.ln(5)
        
        # Audit History Section
        if sections.auditHistory:
            add_section_title('Audit History')
            if asset.auditHistory and len(asset.auditHistory) > 0:
                headers = ['Date', 'Type', 'Status', 'Auditor', 'Notes']
                rows = [
                    [
                        format_date_pdf(a.auditDate),
                        a.auditType or 'N/A',
                        a.status or 'N/A',
                        a.auditor or 'N/A',
                        a.notes or '-'
                    ]
                    for a in asset.auditHistory[:20]  # Limit to 20
                ]
                add_table(headers, rows)
            else:
                pdf.set_font('Helvetica', 'I', 9)
                pdf.set_text_color(128, 128, 128)
                pdf.cell(0, 8, 'No audit records found.', new_x='LMARGIN', new_y='NEXT')
                pdf.set_text_color(51, 51, 51)
            pdf.ln(5)
        
        # Maintenance Section
        if sections.maintenance:
            add_section_title('Maintenance Records')
            if maintenances and len(maintenances) > 0:
                headers = ['Title', 'Status', 'Due Date', 'Completed', 'Cost']
                rows = [
                    [
                        m.title or 'N/A',
                        m.status or 'N/A',
                        format_date_pdf(m.dueDate),
                        format_date_pdf(m.dateCompleted),
                        format_currency_pdf(m.cost)
                    ]
                    for m in maintenances[:20]
                ]
                add_table(headers, rows)
            else:
                pdf.set_font('Helvetica', 'I', 9)
                pdf.set_text_color(128, 128, 128)
                pdf.cell(0, 8, 'No maintenance records found.', new_x='LMARGIN', new_y='NEXT')
                pdf.set_text_color(51, 51, 51)
            pdf.ln(5)
        
        # Reservation Records Section
        if sections.reservations:
            add_section_title('Reservation Records')
            if reservations and len(reservations) > 0:
                headers = ['Type', 'Reserved For', 'Purpose', 'Date']
                rows = [
                    [
                        r.reservationType or 'N/A',
                        r.employeeUser.name if r.employeeUser else (r.department or 'N/A'),
                        r.purpose or '-',
                        format_date_pdf(r.reservationDate)
                    ]
                    for r in reservations[:20]
                ]
                add_table(headers, rows)
            else:
                pdf.set_font('Helvetica', 'I', 9)
                pdf.set_text_color(128, 128, 128)
                pdf.cell(0, 8, 'No reservation records found.', new_x='LMARGIN', new_y='NEXT')
                pdf.set_text_color(51, 51, 51)
            pdf.ln(5)
        
        # History Logs Section
        if sections.historyLogs:
            add_section_title('History Logs')
            if history_logs and len(history_logs) > 0:
                headers = ['Date', 'Event', 'Field', 'From', 'To', 'By']
                rows = [
                    [
                        format_date_pdf(log.eventDate),
                        log.eventType or 'N/A',
                        (log.field or '-').capitalize(),
                        log.changeFrom or '-',
                        log.changeTo or '-',
                        log.actionBy or 'N/A'
                    ]
                    for log in history_logs[:30]
                ]
                add_table(headers, rows)
            else:
                pdf.set_font('Helvetica', 'I', 9)
                pdf.set_text_color(128, 128, 128)
                pdf.cell(0, 8, 'No history logs found.', new_x='LMARGIN', new_y='NEXT')
                pdf.set_text_color(51, 51, 51)
            pdf.ln(5)
        
        # Photos Section - table with embedded images
        if sections.photos:
            add_section_title('Photos')
            if images and len(images) > 0:
                import httpx
                import tempfile
                import os as os_module
                
                # Table header
                col_widths = [70, 40, 35, 45]  # Image, Type, Size, Uploaded
                row_height = 50  # Taller rows to fit images
                
                pdf.set_font('Helvetica', 'B', 8)
                pdf.set_fill_color(102, 126, 234)  # Blue header
                pdf.set_text_color(255, 255, 255)  # White text
                pdf.cell(col_widths[0], 7, 'Image', border=1, fill=True, align='C')
                pdf.cell(col_widths[1], 7, 'Type', border=1, fill=True, align='C')
                pdf.cell(col_widths[2], 7, 'Size', border=1, fill=True, align='C')
                pdf.cell(col_widths[3], 7, 'Uploaded', border=1, fill=True, align='C')
                pdf.ln()
                
                for img in images[:10]:  # Limit to 10 images
                    # Check if need new page
                    if pdf.get_y() + row_height > 270:
                        pdf.add_page()
                        add_section_title('Photos (continued)')
                        # Re-add header
                        pdf.set_font('Helvetica', 'B', 8)
                        pdf.set_fill_color(102, 126, 234)  # Blue header
                        pdf.set_text_color(255, 255, 255)  # White text
                        pdf.cell(col_widths[0], 7, 'Image', border=1, fill=True, align='C')
                        pdf.cell(col_widths[1], 7, 'Type', border=1, fill=True, align='C')
                        pdf.cell(col_widths[2], 7, 'Size', border=1, fill=True, align='C')
                        pdf.cell(col_widths[3], 7, 'Uploaded', border=1, fill=True, align='C')
                        pdf.ln()
                    
                    start_x = pdf.get_x()
                    start_y = pdf.get_y()
                    
                    # Draw row cells first (borders)
                    pdf.cell(col_widths[0], row_height, '', border=1)
                    pdf.cell(col_widths[1], row_height, '', border=1)
                    pdf.cell(col_widths[2], row_height, '', border=1)
                    pdf.cell(col_widths[3], row_height, '', border=1)
                    
                    # Try to embed actual image in first cell
                    img_embedded = False
                    if img.imageUrl:
                        try:
                            with httpx.Client(timeout=10.0) as client:
                                response = client.get(img.imageUrl)
                                if response.status_code == 200:
                                    img_ext = img.imageType.split('/')[-1] if img.imageType else 'jpg'
                                    if img_ext not in ['jpg', 'jpeg', 'png', 'gif']:
                                        img_ext = 'jpg'
                                    
                                    with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{img_ext}') as tmp_file:
                                        tmp_file.write(response.content)
                                        tmp_path = tmp_file.name
                                    
                                    # Get image dimensions to maintain aspect ratio
                                    from PIL import Image as PILImage
                                    with PILImage.open(tmp_path) as pil_img:
                                        orig_w, orig_h = pil_img.size
                                    
                                    # Calculate scaled dimensions to fit in cell while maintaining aspect ratio
                                    max_w = col_widths[0] - 4
                                    max_h = row_height - 4
                                    
                                    # Calculate scale factor
                                    scale_w = max_w / orig_w
                                    scale_h = max_h / orig_h
                                    scale = min(scale_w, scale_h)  # Use smaller scale to fit
                                    
                                    img_w = orig_w * scale
                                    img_h = orig_h * scale
                                    
                                    # Center image in cell
                                    img_x = start_x + 2 + (max_w - img_w) / 2
                                    img_y = start_y + 2 + (max_h - img_h) / 2
                                    
                                    pdf.image(tmp_path, x=img_x, y=img_y, w=img_w, h=img_h)
                                    img_embedded = True
                                    os_module.unlink(tmp_path)
                        except Exception as img_error:
                            logger.warning(f"Failed to embed image: {img_error}")
                    
                    if not img_embedded:
                        pdf.set_xy(start_x + 2, start_y + row_height/2 - 3)
                        pdf.set_font('Helvetica', 'I', 7)
                        pdf.set_text_color(150, 150, 150)
                        pdf.cell(col_widths[0] - 4, 6, 'Image unavailable', align='C')
                    
                    # Fill in other columns
                    pdf.set_font('Helvetica', '', 8)
                    pdf.set_text_color(51, 51, 51)
                    
                    # Type column
                    pdf.set_xy(start_x + col_widths[0] + 2, start_y + row_height/2 - 3)
                    pdf.cell(col_widths[1] - 4, 6, img.imageType or 'N/A', align='C')
                    
                    # Size column
                    pdf.set_xy(start_x + col_widths[0] + col_widths[1] + 2, start_y + row_height/2 - 3)
                    size_kb = f"{(img.imageSize or 0) / 1024:.2f} KB" if img.imageSize else 'N/A'
                    pdf.cell(col_widths[2] - 4, 6, size_kb, align='C')
                    
                    # Uploaded column
                    pdf.set_xy(start_x + col_widths[0] + col_widths[1] + col_widths[2] + 2, start_y + row_height/2 - 3)
                    pdf.cell(col_widths[3] - 4, 6, format_date_pdf(img.createdAt), align='C')
                    
                    pdf.set_xy(start_x, start_y + row_height)
                
                pdf.ln(5)
            else:
                pdf.set_font('Helvetica', 'I', 9)
                pdf.set_text_color(128, 128, 128)
                pdf.cell(0, 8, 'No photos found.', new_x='LMARGIN', new_y='NEXT')
                pdf.set_text_color(51, 51, 51)
                pdf.ln(5)
        
        # Documents Section - table format
        if sections.documents:
            add_section_title('Documents')
            if documents and len(documents) > 0:
                # Table header - File Name, Type, Size, URL, Uploaded
                doc_col_widths = [35, 20, 20, 85, 30]  # Total ~190
                
                pdf.set_font('Helvetica', 'B', 8)
                pdf.set_fill_color(102, 126, 234)  # Blue header
                pdf.set_text_color(255, 255, 255)  # White text
                pdf.cell(doc_col_widths[0], 7, 'File Name', border=1, fill=True, align='C')
                pdf.cell(doc_col_widths[1], 7, 'Type', border=1, fill=True, align='C')
                pdf.cell(doc_col_widths[2], 7, 'Size', border=1, fill=True, align='C')
                pdf.cell(doc_col_widths[3], 7, 'URL', border=1, fill=True, align='C')
                pdf.cell(doc_col_widths[4], 7, 'Uploaded', border=1, fill=True, align='C')
                pdf.ln()
                
                pdf.set_font('Helvetica', '', 7)
                pdf.set_text_color(51, 51, 51)
                
                for doc in documents[:15]:  # Limit to 15 documents
                    # Check if need new page
                    if pdf.get_y() > 265:
                        pdf.add_page()
                        add_section_title('Documents (continued)')
                        # Re-add header
                        pdf.set_font('Helvetica', 'B', 8)
                        pdf.set_fill_color(102, 126, 234)  # Blue header
                        pdf.set_text_color(255, 255, 255)  # White text
                        pdf.cell(doc_col_widths[0], 7, 'File Name', border=1, fill=True, align='C')
                        pdf.cell(doc_col_widths[1], 7, 'Type', border=1, fill=True, align='C')
                        pdf.cell(doc_col_widths[2], 7, 'Size', border=1, fill=True, align='C')
                        pdf.cell(doc_col_widths[3], 7, 'URL', border=1, fill=True, align='C')
                        pdf.cell(doc_col_widths[4], 7, 'Uploaded', border=1, fill=True, align='C')
                        pdf.ln()
                        pdf.set_font('Helvetica', '', 7)
                        pdf.set_text_color(51, 51, 51)
                    
                    # Calculate row height based on URL length
                    url = doc.documentUrl or ''
                    # Estimate characters per line in URL column
                    chars_per_line = int(doc_col_widths[3] / 1.8)
                    url_lines = max(1, -(-len(url) // chars_per_line)) if url else 1  # Ceiling division
                    doc_row_height = max(8, url_lines * 4 + 2)
                    
                    start_x = pdf.get_x()
                    start_y = pdf.get_y()
                    
                    # Draw cell borders
                    pdf.cell(doc_col_widths[0], doc_row_height, '', border=1)
                    pdf.cell(doc_col_widths[1], doc_row_height, '', border=1)
                    pdf.cell(doc_col_widths[2], doc_row_height, '', border=1)
                    pdf.cell(doc_col_widths[3], doc_row_height, '', border=1)
                    pdf.cell(doc_col_widths[4], doc_row_height, '', border=1)
                    
                    # Fill in content
                    # File Name
                    pdf.set_xy(start_x + 1, start_y + 1)
                    file_name = doc.fileName or 'N/A'
                    if len(file_name) > 15:
                        # Split into two lines
                        pdf.multi_cell(doc_col_widths[0] - 2, 4, file_name[:30], align='L')
                    else:
                        pdf.set_xy(start_x + 1, start_y + doc_row_height/2 - 2)
                        pdf.cell(doc_col_widths[0] - 2, 4, file_name, align='L')
                    
                    # Type
                    mime_type = getattr(doc, 'mimeType', None)
                    doc_type = doc.documentType or (mime_type.split('/')[-1].upper() if mime_type else 'N/A')
                    pdf.set_xy(start_x + doc_col_widths[0] + 1, start_y + doc_row_height/2 - 2)
                    pdf.cell(doc_col_widths[1] - 2, 4, doc_type[:10], align='C')
                    
                    # Size
                    size_kb = f"{(doc.documentSize or 0) / 1024:.2f} KB" if doc.documentSize else 'N/A'
                    pdf.set_xy(start_x + doc_col_widths[0] + doc_col_widths[1] + 1, start_y + doc_row_height/2 - 2)
                    pdf.cell(doc_col_widths[2] - 2, 4, size_kb, align='C')
                    
                    # URL (with word wrap)
                    pdf.set_xy(start_x + doc_col_widths[0] + doc_col_widths[1] + doc_col_widths[2] + 1, start_y + 1)
                    pdf.set_text_color(102, 126, 234)
                    pdf.set_font('Helvetica', '', 6)
                    pdf.multi_cell(doc_col_widths[3] - 2, 3, url or 'N/A', align='L')
                    pdf.set_text_color(51, 51, 51)
                    pdf.set_font('Helvetica', '', 7)
                    
                    # Uploaded
                    pdf.set_xy(start_x + doc_col_widths[0] + doc_col_widths[1] + doc_col_widths[2] + doc_col_widths[3] + 1, start_y + doc_row_height/2 - 2)
                    pdf.cell(doc_col_widths[4] - 2, 4, format_date_pdf(doc.createdAt), align='C')
                    
                    pdf.set_xy(start_x, start_y + doc_row_height)
            else:
                pdf.set_font('Helvetica', 'I', 9)
                pdf.set_text_color(128, 128, 128)
                pdf.cell(0, 8, 'No documents found.', new_x='LMARGIN', new_y='NEXT')
                pdf.set_text_color(51, 51, 51)
        
        # Generate PDF bytes
        pdf_content = bytes(pdf.output())
        
        filename = f"asset-details-{asset.assetTagId}-{datetime.now().strftime('%Y-%m-%d')}.pdf"
        
        return Response(
            content=pdf_content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating asset PDF: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")


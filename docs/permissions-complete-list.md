# Complete Permissions List & Backend Implementation Status

## Overview

This document lists **all permissions** in the system, their frontend usage, and their backend implementation status. The frontend already handles permission checks for UI visibility, but backend security is still being implemented.

## Permission Categories

### 1. Asset Management Permissions

| Permission | Frontend Usage | Backend Status | Affected Endpoints |
|------------|---------------|----------------|-------------------|
| **canViewAssets** | ✅ Used extensively | ✅ **IMPLEMENTED** | `GET /api/assets`, `GET /api/assets/{asset_id}` |
| **canCreateAssets** | ✅ Used in add asset page | ✅ **IMPLEMENTED** | `POST /api/assets` |
| **canEditAssets** | ✅ Used in edit asset page | ✅ **IMPLEMENTED** | `PUT /api/assets/{asset_id}` |
| **canDeleteAssets** | ✅ Used in asset actions | ✅ **IMPLEMENTED** | `DELETE /api/assets/{asset_id}`, `POST /api/assets/bulk-delete` |

**Frontend Files Using These Permissions:**
- `app/assets/page.tsx` - Asset list page
- `app/assets/add/page.tsx` - Add asset page
- `app/assets/[assetTagId]/page.tsx` - Edit asset page
- `app/assets/details/[assetTagId]/page.tsx` - Asset details page
- `components/app-header.tsx` - Header navigation

**Backend Router:** `backend/routers/assets.py`

**Implementation Details:**
- ✅ `GET /api/assets` → Requires `canViewAssets`
- ✅ `GET /api/assets/{asset_id}` → Requires `canViewAssets`
- ✅ `POST /api/assets` → Requires `canCreateAssets`
- ✅ `PUT /api/assets/{asset_id}` → Requires `canEditAssets`
- ✅ `DELETE /api/assets/{asset_id}` → Requires `canDeleteAssets`
- ✅ `POST /api/assets/bulk-delete` → Requires `canDeleteAssets`
- ✅ Admin role has all permissions automatically
- ✅ Frontend updated to disable buttons/actions instead of showing toast messages 

---

### 2. Asset Operations Permissions

| Permission | Frontend Usage | Backend Status | Affected Endpoints |
|------------|---------------|----------------|-------------------|
| **canCheckout** | ✅ Used in checkout page | ✅ **IMPLEMENTED** | `POST /api/assets/checkout`, `PATCH /api/assets/checkout/{checkout_id}` |
| **canCheckin** | ✅ Used in checkin page | ✅ **IMPLEMENTED** | `POST /api/assets/checkin` |
| **canReserve** | ✅ Used in reserve page | ✅ **IMPLEMENTED** | `POST /api/assets/reserve`, `DELETE /api/assets/reserve/{reservation_id}` |
| **canMove** | ✅ Used in move page | ✅ **IMPLEMENTED** | `POST /api/assets/move` |
| **canLease** | ✅ Used in lease page | ✅ **IMPLEMENTED** | `POST /api/assets/lease`, `POST /api/assets/lease-return` |
| **canDispose** | ✅ Used in dispose page | ✅ **IMPLEMENTED** | `POST /api/assets/dispose` |

**Frontend Files Using These Permissions:**
- `app/assets/checkout/page.tsx`
- `app/assets/checkin/page.tsx`
- `app/assets/reserve/page.tsx`
- `app/assets/move/page.tsx`
- `app/assets/lease/page.tsx`
- `app/assets/dispose/page.tsx`
- `app/assets/page.tsx` (More Actions dropdown)
- `app/assets/details/[assetTagId]/page.tsx` (More Actions dropdown)
- `components/app-header.tsx` (QR scan dialog)

**Backend Routers:**
- `backend/routers/checkout.py` - ✅ Permission checks added to POST and PATCH endpoints
- `backend/routers/checkin.py` - ✅ Permission checks added to POST endpoint
- `backend/routers/reserve.py` - ✅ Permission checks added to POST and DELETE endpoints
- `backend/routers/move.py` - ✅ Permission checks added to POST endpoint
- `backend/routers/lease.py` - ✅ Permission checks added to POST endpoint
- `backend/routers/dispose.py` - ✅ Permission checks added to POST endpoint
- `backend/routers/lease_return.py` - ✅ Permission checks added to POST endpoint (uses `canLease`)

**Implementation Details:**
- ✅ All POST/PUT/PATCH/DELETE endpoints secured with permission checks
- ✅ GET endpoints remain open (users can view data)
- ✅ Frontend buttons/actions disabled when user lacks permission (no toast messages)
- ✅ Admin role has all permissions automatically

---

### 3. Maintenance & Audit Permissions

| Permission | Frontend Usage | Backend Status | Affected Endpoints |
|------------|---------------|----------------|-------------------|
| **canManageMaintenance** | ✅ Used in maintenance page | ✅ **IMPLEMENTED** | `GET /api/assets/maintenance` (open), `POST /api/assets/maintenance` (secured), `PUT /api/assets/maintenance` (secured), `DELETE /api/assets/maintenance/{id}` (secured) |
| **canAudit** | ✅ Used in audit page | ✅ **IMPLEMENTED** | `GET /api/assets/{asset_id}/audit` (open), `GET /api/assets/audit/stats` (open), `POST /api/assets/{asset_id}/audit` (secured), `PATCH /api/assets/audit/{audit_id}` (secured), `DELETE /api/assets/audit/{audit_id}` (secured) |

**Frontend Files Using These Permissions:**
- `app/assets/maintenance/page.tsx` - Buttons disabled when `!canManageMaintenance`
- `app/tools/audit/page.tsx` - Buttons disabled when `!canAudit`
- `app/assets/page.tsx` - Maintenance and audit dropdown items disabled
- `app/employees/page.tsx` - Maintenance dropdown items disabled
- `app/lists/maintenances/page.tsx`
- `components/app-header.tsx`

**Backend Routers:**
- `backend/routers/maintenance.py` - Permission checks added to POST, PUT, DELETE endpoints
- `backend/routers/audit.py` - Permission checks added to POST, PATCH, DELETE endpoints

**Implementation Status:**
- ✅ Backend endpoints secured with permission checks
- ✅ Frontend UI elements disabled when user lacks permission (no toast messages)
- ✅ GET endpoints remain open for viewing data

---

### 4. Setup & Configuration Permissions

| Permission | Frontend Usage | Backend Status | Affected Endpoints |
|------------|---------------|----------------|-------------------|
| **canManageSetup** | ✅ Used in setup pages | ✅ **IMPLEMENTED** | `POST/PUT/DELETE /api/sites`, `/api/departments`, `/api/locations`, `/api/categories`, `/api/subcategories` |

**Frontend Files Using These Permissions:**
- `app/setup/sites/page.tsx`
- `app/setup/departments/page.tsx`
- `app/setup/locations/page.tsx`
- `app/setup/categories/page.tsx`

**Backend Routers:**
- `backend/routers/sites.py` ✅
- `backend/routers/departments.py` ✅
- `backend/routers/locations.py` ✅
- `backend/routers/categories.py` ✅
- `backend/routers/subcategories.py` ✅

**Status:** ✅ **COMPLETE** - All setup endpoints are secured

---

### 5. Employee Management Permissions

| Permission | Frontend Usage | Backend Status | Affected Endpoints |
|------------|---------------|----------------|-------------------|
| **canManageEmployees** | ✅ Used in employees page | ✅ **IMPLEMENTED** | `POST /api/employees`, `PUT /api/employees/{id}`, `DELETE /api/employees/{id}` |

**Frontend Files Using These Permissions:**
- `app/employees/page.tsx`

**Backend Router:** `backend/routers/employees.py`

**Implementation Details:**
- ✅ GET endpoints are **open** (no permission required) - Users need to see employees for dropdowns in checkout/checkin forms
- ✅ POST endpoint requires `canManageEmployees` - Returns 403: "You do not have permission to create employees"
- ✅ PUT endpoint requires `canManageEmployees` - Returns 403: "You do not have permission to update employees"
- ✅ DELETE endpoint requires `canManageEmployees` - Returns 403: "You do not have permission to delete employees"

---

### 6. Media & Trash Permissions

| Permission | Frontend Usage | Backend Status | Affected Endpoints |
|------------|---------------|----------------|-------------------|
| **canManageMedia** | ✅ Used in media page | ✅ **IMPLEMENTED** | `POST /api/assets/media/upload`, `DELETE /api/assets/media/delete`, `DELETE /api/assets/media/bulk-delete`, `POST /api/assets/upload-image`, `POST /api/assets/upload-document`, `DELETE /api/assets/images/delete/{id}`, `DELETE /api/assets/documents/delete/{id}` |
| **canManageTrash** | ✅ Used in trash page | ✅ **IMPLEMENTED** | `PATCH /api/assets/{id}/restore`, `POST /api/assets/bulk-restore`, `DELETE /api/assets/trash/empty` |

**Frontend Files Using These Permissions:**
- `app/tools/media/page.tsx` - Upload/delete buttons disabled when no permission
- `app/tools/trash/page.tsx` - Restore/delete/empty buttons disabled when no permission

**Backend Router:** 
- `backend/routers/assets.py` - All media and trash endpoints require respective permissions

**Implementation Details:**
- ✅ All media management endpoints require `canManageMedia` permission
- ✅ All trash/restore endpoints require `canManageTrash` permission
- ✅ Frontend disables buttons and dropdown items when user lacks permission
- ✅ Toast messages removed - UI elements are disabled instead

---

### 7. Import/Export Permissions

| Permission | Frontend Usage | Backend Status | Affected Endpoints |
|------------|---------------|----------------|-------------------|
| **canManageImport** | ✅ Used in import page and assets page | ✅ **IMPLEMENTED** | `POST /api/assets/import` |
| **canManageExport** | ✅ Used in export page and assets page | ✅ **IMPLEMENTED** | Export actions (client-side, no dedicated endpoint) |

**Frontend Files Using These Permissions:**
- `app/tools/import/page.tsx` - Import buttons disabled when no permission
- `app/tools/export/page.tsx` - Export buttons disabled when no permission
- `app/assets/page.tsx` - Import/Export dropdown items and buttons disabled when no permission

**Backend Router:** 
- `backend/routers/assets.py` - `POST /api/assets/import` requires `canManageImport`
- `backend/routers/file_history.py` (for import/export history)

**Implementation Details:**
- ✅ `POST /api/assets/import` endpoint requires `canManageImport` permission
- ✅ Frontend disables import/export buttons and dropdown items when user lacks permission
- ✅ Toast messages removed - UI elements are disabled instead
- ✅ Mobile dock buttons also respect permissions
- ℹ️ Export functionality is client-side (fetches assets via GET, then exports), so no dedicated export endpoint exists

---

### 8. Forms Permissions

| Permission | Frontend Usage | Backend Status | Affected Endpoints |
|------------|---------------|----------------|-------------------|
| **canViewReturnForms** | ✅ Used in return forms page | ✅ **IMPLEMENTED** | `GET /api/forms/return-form`, `GET /api/forms/history/{form_id}` (when type=return) |
| **canManageReturnForms** | ✅ Used in return forms page | ✅ **IMPLEMENTED** | `POST /api/forms/return-form`, `DELETE /api/forms/history/{form_id}` (when type=return), PDF download |
| **canViewAccountabilityForms** | ✅ Used in accountability forms page | ✅ **IMPLEMENTED** | `GET /api/forms/accountability-form`, `GET /api/forms/history/{form_id}` (when type=accountability) |
| **canManageAccountabilityForms** | ✅ Used in accountability forms page | ✅ **IMPLEMENTED** | `POST /api/forms/accountability-form`, `DELETE /api/forms/history/{form_id}` (when type=accountability), PDF download |

**Frontend Files Using These Permissions:**
- `app/forms/return-form/page.tsx` - PDF download requires `canManageReturnForms`
- `app/forms/accountability-form/page.tsx` - PDF download requires `canManageAccountabilityForms`
- `app/forms/history/page.tsx` - View history list
- `app/forms/history/[id]/page.tsx` - View individual form details (requires view permission)

**Backend Router:** `backend/routers/forms.py`

**Status:** ✅ **IMPLEMENTED**

**Security Model:**
- ✅ **View Access (GET):** Most GET endpoints require view permissions:
  - `GET /api/forms/return-form` → Requires `canViewReturnForms`
  - `GET /api/forms/accountability-form` → Requires `canViewAccountabilityForms`
  - `GET /api/forms/history` → **Open** (no permission required) - Users can view the history list
  - `GET /api/forms/history/{form_id}` → Requires `canViewReturnForms` or `canViewAccountabilityForms` based on `formType` query parameter - Individual form details are restricted
- ✅ **Manage Access (POST/DELETE):** All write operations require manage permissions:
  - `POST /api/forms/return-form` → Requires `canManageReturnForms`
  - `POST /api/forms/accountability-form` → Requires `canManageAccountabilityForms`
  - `DELETE /api/forms/history/{form_id}` → Requires `canManageReturnForms` or `canManageAccountabilityForms` based on `formType` query parameter
- ✅ **PDF Download:** Handled client-side in frontend, requires manage permissions:
  - Return form PDF download → Requires `canManageReturnForms`
  - Accountability form PDF download → Requires `canManageAccountabilityForms`
- ✅ Admin role has all permissions automatically

---

### 9. Reports Permissions

| Permission | Frontend Usage | Backend Status | Affected Endpoints |
|------------|---------------|----------------|-------------------|
| **canManageReports** | ✅ Used in reports pages | ✅ **IMPLEMENTED** | All `/api/reports/*/export` endpoints, `/api/reports/automated/*` POST/PUT/DELETE endpoints |

**Frontend Files Using These Permissions:**
- `app/reports/assets/page.tsx`
- `app/reports/checkout/page.tsx`
- `app/reports/location/page.tsx`
- `app/reports/maintenance/page.tsx`
- `app/reports/audit/page.tsx`
- `app/reports/depreciation/page.tsx`
- `app/reports/lease/page.tsx`
- `app/reports/reservation/page.tsx`
- `app/reports/transaction/page.tsx`
- `app/reports/automated-reports/page.tsx`

**Backend Routers:**
- `backend/routers/reports.py` ✅
- `backend/routers/reports_checkout.py` ✅
- `backend/routers/reports_location.py` ✅
- `backend/routers/reports_maintenance.py` ✅
- `backend/routers/reports_audit.py` ✅
- `backend/routers/reports_depreciation.py` ✅
- `backend/routers/reports_lease.py` ✅
- `backend/routers/reports_reservation.py` ✅
- `backend/routers/reports_transaction.py` ✅
- `backend/routers/reports_automated.py` ✅

**Implementation Details:**
- ✅ GET endpoints are **open** (no permission required) - Users can view reports
- ✅ Export endpoints (GET /export) require `canManageReports` - Returns 403: "You do not have permission to export reports"
- ✅ Automated reports POST/PUT/DELETE require `canManageReports`
- ✅ Frontend export buttons (CSV, Excel, PDF) are disabled when user lacks permission
- ✅ No toast messages - buttons are disabled instead

---

### 10. Inventory Permissions

| Permission | Frontend Usage | Backend Status | Affected Endpoints |
|------------|---------------|----------------|-------------------|
| **canManageInventory** | ✅ Used in inventory pages | ✅ **IMPLEMENTED** | All inventory management operations (create, update, delete, export, import, transactions, restore, empty trash) |

**Frontend Files Using These Permissions:**
- `app/inventory/page.tsx` - Main inventory page with add, edit, delete, export, import actions
- `app/inventory/trash/page.tsx` - Trash page with restore and delete actions
- `app/inventory/[itemCode]/transaction-history/page.tsx` - Transaction history with delete actions

**Backend Router:** `backend/routers/inventory.py`

**Status:** ✅ **IMPLEMENTED**

**Security Model:**
- ✅ **Read Access (GET):** All GET endpoints are open - users can view inventory items, transactions, and trash
- ✅ **Write Access (POST/PUT/DELETE):** All write operations require `canManageInventory`:
  - `POST /api/inventory` - Create inventory item (also covers import)
  - `PUT /api/inventory/{id}` - Update inventory item
  - `DELETE /api/inventory/{id}` - Delete inventory item
  - `DELETE /api/inventory/bulk-delete` - Bulk delete items
  - `POST /api/inventory/{id}/transactions` - Create transaction
  - `DELETE /api/inventory/{id}/transactions/bulk-delete` - Bulk delete transactions
  - `POST /api/inventory/{id}/restore` - Restore deleted item
  - `POST /api/inventory/bulk-restore` - Bulk restore items
  - `DELETE /api/inventory/trash/empty` - Empty trash
  - `GET /api/inventory/export` - Export inventory (Excel/PDF)

**Frontend Implementation:**
- ✅ All action buttons (Add, Edit, Delete, Add Transaction) are disabled when user lacks permission
- ✅ Export dropdown items (Excel, PDF) are disabled when user lacks permission
- ✅ Import dropdown item is disabled when user lacks permission
- ✅ Trash page buttons (Restore, Delete, Empty) are disabled when user lacks permission
- ✅ Transaction history delete actions are disabled when user lacks permission
- ✅ No toast messages - buttons are visually disabled instead
- ✅ Admin role has all permissions automatically

---

### 11. User Management Permissions

| Permission | Frontend Usage | Backend Status | Affected Endpoints |
|------------|---------------|----------------|-------------------|
| **canManageUsers** | ✅ Used in users settings page | ✅ **IMPLEMENTED** | `POST /api/users`, `PUT /api/users/{id}`, `DELETE /api/users/{id}`, `POST /api/users/{id}/send-password-reset` |

**Frontend Files Using These Permissions:**
- `app/settings/users/page.tsx` - Create/Edit/Delete/Approve buttons and dropdown items disabled when no permission

**Backend Router:** 
- `backend/routers/users.py` - All user management endpoints require `canManageUsers` permission

**Implementation Details:**
- ✅ `POST /api/users` endpoint requires `canManageUsers` permission
- ✅ `PUT /api/users/{id}` endpoint requires `canManageUsers` permission
- ✅ `DELETE /api/users/{id}` endpoint requires `canManageUsers` permission
- ✅ `POST /api/users/{id}/send-password-reset` endpoint requires `canManageUsers` permission
- ✅ `GET /api/users` endpoint is open (allows viewing users list)
- ✅ Frontend disables buttons and dropdown items when user lacks permission
- ✅ Toast messages removed - UI elements are disabled instead

---

### 12. Company Info Permissions

| Permission | Frontend Usage | Backend Status | Affected Endpoints |
|------------|---------------|----------------|-------------------|
| **canManageSetup** | ✅ Used in company info page | ✅ **IMPLEMENTED** | `GET /api/setup/company-info`, `PUT /api/setup/company-info`, `POST /api/setup/company-info/upload-logo`, `DELETE /api/setup/company-info/delete-logo` |

**Frontend Files Using These Permissions:**
- `app/setup/company-info/page.tsx`

**Backend Router:** `backend/routers/company_info.py`

**Status:** ✅ **IMPLEMENTED** - Uses `canManageSetup` permission

---

## Summary Table

| Permission | Frontend | Backend | Priority |
|------------|----------|---------|----------|
| `canViewAssets` | ✅ | ✅ | ✅ Complete |
| `canCreateAssets` | ✅ | ✅ | ✅ Complete |
| `canEditAssets` | ✅ | ✅ | ✅ Complete |
| `canDeleteAssets` | ✅ | ✅ | ✅ Complete |
| `canCheckout` | ✅ | ✅ | ✅ Complete |
| `canCheckin` | ✅ | ✅ | ✅ Complete |
| `canReserve` | ✅ | ✅ | ✅ Complete |
| `canMove` | ✅ | ✅ | ✅ Complete |
| `canLease` | ✅ | ✅ | ✅ Complete |
| `canDispose` | ✅ | ✅ | ✅ Complete |
| `canManageMaintenance` | ✅ | ✅ | ✅ Complete |
| `canAudit` | ✅ | ✅ | ✅ Complete |
| `canManageSetup` | ✅ | ✅ | ✅ Complete |
| `canManageEmployees` | ✅ | ✅ | ✅ Complete |
| `canManageMedia` | ✅ | ✅ | ✅ Complete |
| `canManageTrash` | ✅ | ✅ | ✅ Complete |
| `canManageImport` | ✅ | ✅ | ✅ Complete |
| `canManageExport` | ✅ | ✅ | ✅ Complete |
| `canViewReturnForms` | ✅ | ✅ | ✅ Complete |
| `canManageReturnForms` | ✅ | ✅ | ✅ Complete |
| `canViewAccountabilityForms` | ✅ | ✅ | ✅ Complete |
| `canManageAccountabilityForms` | ✅ | ✅ | ✅ Complete |
| `canManageReports` | ✅ | ✅ | ✅ Complete |
| `canManageInventory` | ✅ | ✅ | ✅ Complete |
| `canManageUsers` | ✅ | ✅ | ✅ Complete |

## Implementation Priority

### 🔴 **HIGH PRIORITY** (Core Asset Operations)
1. ~~**canViewAssets**~~ - ✅ **COMPLETED** - Permission checks implemented
2. ~~**canCreateAssets**~~ - ✅ **COMPLETED** - Permission checks implemented
3. ~~**canEditAssets**~~ - ✅ **COMPLETED** - Permission checks implemented
4. ~~**canDeleteAssets**~~ - ✅ **COMPLETED** - Permission checks implemented
4. ~~**canCheckout**~~ - ✅ **COMPLETED** - Permission checks implemented
5. ~~**canCheckin**~~ - ✅ **COMPLETED** - Permission checks implemented

### 🟡 **MEDIUM PRIORITY** (Asset Lifecycle)
6. ~~**canReserve**~~ - ✅ **COMPLETED** - Permission checks implemented
7. ~~**canMove**~~ - ✅ **COMPLETED** - Permission checks implemented
8. ~~**canLease**~~ - ✅ **COMPLETED** - Permission checks implemented
9. ~~**canDispose**~~ - ✅ **COMPLETED** - Permission checks implemented
10. **canManageMaintenance** - Manage maintenance records
11. **canAudit** - Perform audits
12. **canManageEmployees** - Manage employee records
13. **canManageImport** - Import data
14. **canManageReports** - Generate reports

### 🟢 **LOW PRIORITY** (Supporting Features)
15. **canManageMedia** - Manage media files
16. **canManageTrash** - Manage trash/restore
17. **canManageExport** - Export data
18. **canViewReturnForms** / **canManageReturnForms** - Return forms
19. **canViewAccountabilityForms** / **canManageAccountabilityForms** - Accountability forms

## Implementation Pattern

For each permission, follow this pattern:

```python
async def check_permission(user_id: str, permission: str) -> bool:
    """Check if user has a specific permission. Admins have all permissions."""
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

@router.post("")
async def create_resource(
    data: ResourceCreate,
    auth: dict = Depends(verify_auth)
):
    user_id = auth.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # Check permission
    has_permission = await check_permission(user_id, "canCreateResource")
    if not has_permission:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to create resources"
        )
    
    # ... rest of the logic
```

## Notes

- **Frontend checks are for UX only** - They hide/show UI elements but don't prevent API calls
- **Backend checks are the source of truth** - They actually enforce security
- **Admin users** automatically have all permissions (role === "admin")
- **Inactive users** are denied all access
- **Error messages** should be user-friendly but not expose system internals

---

**Last Updated**: 2025-01-XX  
**Status**: Documentation complete, implementation in progress


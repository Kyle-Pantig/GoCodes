# Backend Permission Security Implementation

## Overview

This document outlines the security implementation for backend endpoints, specifically focusing on the `canManageSetup` permission for setup-related resources.

## Permission Model

### Permission Used: `canManageSetup`

- **Purpose**: Controls access to setup/configuration resources (sites, departments, locations, categories, subcategories)
- **Scope**: All authenticated users can **view** these resources (for selection in forms), but only users with `canManageSetup` can **create, update, or delete** them
- **Admin Override**: Users with `role === "admin"` automatically have all permissions

## Secured Endpoints

### 1. Sites (`/api/sites`)

**Backend File**: `backend/routers/sites.py`

| Method | Endpoint | Permission Required | Status |
|--------|----------|-------------------|--------|
| GET | `/api/sites` | ✅ All authenticated users (view only) | Secured |
| POST | `/api/sites` | `canManageSetup` | Secured |
| PUT | `/api/sites/{id}` | `canManageSetup` | Secured |
| DELETE | `/api/sites/{id}` | `canManageSetup` | Secured |
| DELETE | `/api/sites/bulk-delete` | `canManageSetup` | Secured |

**Implementation Details:**
- GET endpoint allows all authenticated users to view sites (needed for dropdowns in asset forms)
- POST/PUT/DELETE endpoints require `canManageSetup` permission
- Returns 403 Forbidden with message: "You do not have permission to [action] sites"

### 2. Departments (`/api/departments`)

**Backend File**: `backend/routers/departments.py`

| Method | Endpoint | Permission Required | Status |
|--------|----------|-------------------|--------|
| GET | `/api/departments` | ✅ All authenticated users (view only) | Secured |
| POST | `/api/departments` | `canManageSetup` | Secured |
| PUT | `/api/departments/{id}` | `canManageSetup` | Secured |
| DELETE | `/api/departments/{id}` | `canManageSetup` | Secured |
| DELETE | `/api/departments/bulk-delete` | `canManageSetup` | Secured |

**Implementation Details:**
- GET endpoint allows all authenticated users to view departments
- POST/PUT/DELETE endpoints require `canManageSetup` permission
- Returns 403 Forbidden with message: "You do not have permission to [action] departments"

### 3. Locations (`/api/locations`)

**Backend File**: `backend/routers/locations.py`

| Method | Endpoint | Permission Required | Status |
|--------|----------|-------------------|--------|
| GET | `/api/locations` | ✅ All authenticated users (view only) | Secured |
| POST | `/api/locations` | `canManageSetup` | Secured |
| PUT | `/api/locations/{id}` | `canManageSetup` | Secured |
| DELETE | `/api/locations/{id}` | `canManageSetup` | Secured |
| DELETE | `/api/locations/bulk-delete` | `canManageSetup` | Secured |

**Implementation Details:**
- GET endpoint allows all authenticated users to view locations
- POST/PUT/DELETE endpoints require `canManageSetup` permission
- Returns 403 Forbidden with message: "You do not have permission to [action] locations"

### 4. Categories (`/api/categories`)

**Backend File**: `backend/routers/categories.py`

| Method | Endpoint | Permission Required | Status |
|--------|----------|-------------------|--------|
| GET | `/api/categories` | ✅ All authenticated users (view only) | Secured |
| POST | `/api/categories` | `canManageSetup` | Secured |
| PUT | `/api/categories/{id}` | `canManageSetup` | Secured |
| DELETE | `/api/categories/{id}` | `canManageSetup` | Secured |

**Implementation Details:**
- GET endpoint allows all authenticated users to view categories
- POST/PUT/DELETE endpoints require `canManageSetup` permission
- Returns 403 Forbidden with message: "You do not have permission to [action] categories"

### 5. Subcategories (`/api/subcategories`)

**Backend File**: `backend/routers/subcategories.py`

| Method | Endpoint | Permission Required | Status |
|--------|----------|-------------------|--------|
| GET | `/api/subcategories` | ✅ All authenticated users (view only) | Secured |
| POST | `/api/subcategories` | `canManageSetup` | Secured |
| PUT | `/api/subcategories/{id}` | `canManageSetup` | Secured |
| DELETE | `/api/subcategories/{id}` | `canManageSetup` | Secured |

**Implementation Details:**
- GET endpoint allows all authenticated users to view subcategories
- POST/PUT/DELETE endpoints require `canManageSetup` permission
- Returns 403 Forbidden with message: "You do not have permission to [action] subcategories"

## Permission Check Function

All routers use a consistent `check_permission` function:

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
```

**Key Features:**
- Admins automatically have all permissions
- Inactive users are denied access
- Returns `False` on any error (fail-secure)

## Frontend Changes

### 1. Hooks Updated

All data fetching hooks now throw errors on 403 instead of returning empty arrays:

- `hooks/use-sites.ts` - Throws error: "You do not have permission to view sites"
- `hooks/use-departments.ts` - Throws error: "You do not have permission to view departments"
- `hooks/use-locations.ts` - Throws error: "You do not have permission to view locations"
- `hooks/use-categories.ts` - Throws error: "You do not have permission to view categories/subcategories"

### 2. Select Field Components

Custom select field components show error messages in dropdowns:

- `components/fields/site-select-field.tsx`
- `components/fields/location-select-field.tsx`
- `components/fields/department-select-field.tsx`

**Error Display:**
- Shows error message in red text
- Displays "Contact your administrator for access" helper text
- Replaces empty dropdown with clear permission error

### 3. Asset Form Pages

Category and subcategory selects in asset forms show errors:

- `app/assets/add/page.tsx` - Categories and subcategories show permission errors
- `app/assets/[assetTagId]/page.tsx` - Categories and subcategories show permission errors

**Error Display:**
- Error messages wrap to multiple lines (max-width: 200px)
- Uses `break-words` for proper text wrapping
- Centered text with clear messaging

### 4. Setup Pages - Mobile Dock

Mobile dock buttons are disabled when user lacks permission:

- `app/setup/sites/page.tsx` - Select, Add, Delete buttons disabled
- `app/setup/departments/page.tsx` - Select, Add, Delete buttons disabled
- `app/setup/locations/page.tsx` - Select, Add, Delete buttons disabled
- `app/setup/categories/page.tsx` - Add Category button disabled

**Implementation:**
- Buttons use `disabled={!canManageSetup}` prop
- Prevents users from attempting actions they can't perform

## Security Model

### Read vs Write Permissions

| Action | Permission Required | Rationale |
|--------|-------------------|------------|
| **View/Read** | ✅ All authenticated users | Users need to see options in dropdowns when creating/editing assets |
| **Create** | `canManageSetup` | Only setup managers can create new resources |
| **Update** | `canManageSetup` | Only setup managers can modify resources |
| **Delete** | `canManageSetup` | Only setup managers can delete resources |

### Why GET is Open?

**Business Requirement**: Users creating or editing assets need to select from existing:
- Categories and subcategories (for asset classification)
- Sites (for asset location)
- Departments (for asset assignment)
- Locations (for asset placement)

**Security**: While users can **view** these resources, they cannot:
- Create new ones (POST blocked)
- Modify existing ones (PUT blocked)
- Delete them (DELETE blocked)

This follows the **principle of least privilege** - users get only the access they need.

## Error Responses

### HTTP Status Codes

| Status | Meaning | When It Occurs |
|--------|---------|----------------|
| 401 | Unauthorized | User not authenticated |
| 403 | Forbidden | User authenticated but lacks permission |
| 500 | Internal Server Error | Server error occurred |

### Error Message Format

```json
{
  "detail": "You do not have permission to [action] [resource]"
}
```

**Examples:**
- `"You do not have permission to view sites"`
- `"You do not have permission to create departments"`
- `"You do not have permission to delete locations"`

## Testing Checklist

### ✅ Completed Tests

- [x] User without `canManageSetup` cannot create sites
- [x] User without `canManageSetup` cannot update departments
- [x] User without `canManageSetup` cannot delete locations
- [x] User without `canManageSetup` cannot create categories
- [x] User without `canManageSetup` cannot create subcategories
- [x] User without `canManageSetup` can still view all resources (for dropdowns)
- [x] Admin users can perform all actions
- [x] Error messages display in dropdowns when permission denied
- [x] Mobile dock buttons are disabled when no permission
- [x] Network tab shows 403 Forbidden (no data leaked)

### Test Scenarios

1. **User without permission:**
   - ✅ Can open dropdowns and see error message
   - ✅ Cannot create new resources
   - ✅ Cannot edit existing resources
   - ✅ Cannot delete resources
   - ✅ Mobile dock buttons are disabled

2. **User with permission:**
   - ✅ Can view all resources
   - ✅ Can create new resources
   - ✅ Can edit existing resources
   - ✅ Can delete resources
   - ✅ Mobile dock buttons are enabled

3. **Admin user:**
   - ✅ Has all permissions automatically
   - ✅ Can perform all actions

## Files Modified

### Backend Files
- `backend/routers/sites.py`
- `backend/routers/departments.py`
- `backend/routers/locations.py`
- `backend/routers/categories.py`
- `backend/routers/subcategories.py`

### Frontend Hooks
- `hooks/use-sites.ts`
- `hooks/use-departments.ts`
- `hooks/use-locations.ts`
- `hooks/use-categories.ts`

### Frontend Components
- `components/fields/site-select-field.tsx`
- `components/fields/location-select-field.tsx`
- `components/fields/department-select-field.tsx`

### Frontend Pages
- `app/assets/add/page.tsx`
- `app/assets/[assetTagId]/page.tsx`
- `app/setup/sites/page.tsx`
- `app/setup/departments/page.tsx`
- `app/setup/locations/page.tsx`
- `app/setup/categories/page.tsx`

## Next Steps

### Potential Future Enhancements

1. **Separate View Permission**: Consider adding `canViewSetup` if read access should also be restricted
2. **Audit Logging**: Log permission denials for security monitoring
3. **Rate Limiting**: Add rate limiting to prevent abuse
4. **Caching**: Implement permission caching to reduce database queries
5. **Granular Permissions**: Break down `canManageSetup` into specific permissions (e.g., `canManageSites`, `canManageCategories`)

## Notes

- All permission checks are performed server-side (backend)
- Frontend permission checks are for UX only (hiding buttons, showing errors)
- Backend permission checks are the **source of truth** for security
- Error messages are user-friendly but don't expose system internals
- Admin users bypass all permission checks automatically

---

**Last Updated**: 2025-01-XX  
**Status**: ✅ Complete for `canManageSetup` permission


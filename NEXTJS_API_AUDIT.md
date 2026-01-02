# Next.js API Calls Audit

This document lists all hardcoded Next.js API calls that are **NOT** using the FastAPI toggle pattern.

These should be updated to use:
```typescript
const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
  ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
  : ''
const url = `${baseUrl}/api/...`
```

---

## Summary

| Location | Endpoint | Priority |
|----------|----------|----------|
| `app/setup/company-info/page.tsx:148` | `/api/countries` | Low |
| `app/inventory/page.tsx:1226` | `/api/inventory/pdf` | ✅ Fixed |
| `app/inventory/page.tsx:1441` | `/api/inventory/generate-code` | ✅ Fixed |
| `app/page.tsx:25` | `/api/auth/me` | ✅ Fixed |
| `components/dialogs/qr-code-display-dialog.tsx:49` | `/api/assets?search=...` | ✅ Fixed |
| `components/settings/permissions.tsx:40` | `/api/auth/me` | Low (Auth) |
| `components/navigation/nav-user.tsx:54` | `/api/auth/logout` | ✅ Fixed |
| `components/fields/country-select-field.tsx:35` | `/api/countries` | Low |
| `hooks/use-categories.ts:575` | `/api/assets` | ✅ Fixed |

---

## Detailed List

### 1. `app/setup/company-info/page.tsx` (Line 148)
```typescript
const response = await fetch('/api/countries')
```
**Endpoint:** `/api/countries`
**Priority:** Low - Static data, rarely changes

---

### 2. `app/inventory/page.tsx` ✅ FIXED
```typescript
// Now uses FastAPI export endpoint with format=pdf
const url = `${baseUrl}/api/inventory/export?format=pdf&...`
const response = await fetch(url, { credentials: 'include', headers })
```
**Endpoint:** `/api/inventory/export?format=pdf`
**Status:** ✅ Fixed - Now uses FastAPI export endpoint (same pattern as reports)

---

### 3. `app/inventory/page.tsx` (Line 1441) ✅ FIXED
```typescript
// Now uses FastAPI pattern with baseUrl and auth token
const response = await fetch(url, { headers })
```
**Endpoint:** `/api/inventory/generate-code`
**Status:** ✅ Fixed - Now uses FastAPI

---

### 4. `app/page.tsx` (Line 25) ✅ FIXED
```typescript
// Now uses FastAPI pattern with baseUrl and auth token
const response = await fetch(`${baseUrl}/api/auth/me`, { headers, credentials: 'include' })
```
**Endpoint:** `/api/auth/me`
**Status:** ✅ Fixed - Now uses FastAPI

---

### 5. `components/dialogs/qr-code-display-dialog.tsx` (Line 49) ✅ FIXED
```typescript
// Now uses FastAPI pattern with baseUrl and auth token
const response = await fetch(`${baseUrl}/api/assets?search=...`, { headers, credentials: 'include' })
```
**Endpoint:** `/api/assets`
**Status:** ✅ Fixed - Now uses FastAPI

---

### 6. `components/settings/permissions.tsx` (Line 40)
```typescript
const response = await fetch('/api/auth/me')
```
**Endpoint:** `/api/auth/me`
**Priority:** Low - Auth endpoints typically stay on Next.js

---

### 7. `components/navigation/nav-user.tsx` (Line 54) ✅ FIXED
```typescript
// Now uses FastAPI pattern with baseUrl and auth token
await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST', headers, credentials: 'include' })
```
**Endpoint:** `/api/auth/logout`
**Status:** ✅ Fixed - Now uses FastAPI

---

### 8. `components/fields/country-select-field.tsx` (Line 35)
```typescript
const response = await fetch('/api/countries')
```
**Endpoint:** `/api/countries`
**Priority:** Low - Static data

---

### 9. `hooks/use-categories.ts` (Line 575) ✅ FIXED
```typescript
// Now uses FastAPI pattern with baseUrl and auth token
const response = await fetch(`${baseUrl}/api/assets`, {
```
**Endpoint:** `/api/assets`
**Status:** ✅ Fixed - Now uses FastAPI

---

## Recommendations

### High Priority ✅ ALL DONE
1. ~~`components/dialogs/qr-code-display-dialog.tsx` - Asset search in QR dialog~~ - Fixed!
2. ~~`hooks/use-categories.ts` - Asset fetch in categories hook~~ - Fixed!

### Medium Priority ✅ DONE
1. ~~`app/inventory/page.tsx` - PDF generation and code generation~~ - Fixed!

### Low Priority (Can Stay on Next.js)
1. Auth endpoints (`/api/auth/me`, `/api/auth/logout`) - These handle Supabase auth and are better kept on Next.js
2. Countries endpoint (`/api/countries`) - Static data that doesn't need FastAPI

---

*Generated: December 22, 2024*


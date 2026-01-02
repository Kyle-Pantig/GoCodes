# Date Picker Migration List

This document lists all pages and components that are currently using native HTML date inputs (`type="date"`) and need to be migrated to use the reusable `DatePicker` component from `@/components/ui/date-picker`.

## ✅ Already Using DatePicker

- ✅ `app/assets/add/page.tsx` - Purchase Date, Delivery Date, Date Acquired
- ✅ `app/assets/[assetTagId]/page.tsx` - Purchase Date, Delivery Date, Date Acquired
- ✅ `app/forms/return-form/page.tsx` - Return Date, Returner Date, IT Department Date (3 instances)
- ✅ `app/forms/accountability-form/page.tsx` - Date Issued, Replacement Dates, Staff Date, IT Department Date, Asset Custodian Date, Finance Department Date (7 instances)
- ✅ `app/assets/checkin/page.tsx` - Checkin date (1 instance)
- ✅ `app/assets/checkout/page.tsx` - Checkout date, Expected return date (2 instances)
- ✅ `app/assets/reserve/page.tsx` - Reservation date (1 instance)
- ✅ `app/assets/lease/page.tsx` - Lease start date, Lease end date (2 instances)
- ✅ `app/assets/lease-return/page.tsx` - Return date (1 instance)
- ✅ `app/assets/move/page.tsx` - Move date (1 instance)
- ✅ `app/assets/dispose/page.tsx` - Dispose date (1 instance)
- ✅ `app/assets/maintenance/page.tsx` - Maintenance date (1 instance)
- ✅ `app/lists/maintenances/page.tsx` - Date Completed, Date Cancelled (2 instances)
- ✅ `components/dialogs/schedule-dialog.tsx` - Schedule date (1 instance)
- ✅ `components/dialogs/audit-dialog.tsx` - Audit date (1 instance)
- ✅ `components/reports/report-filters.tsx` - Start date, End date (2 instances)
- ✅ `components/reports/checkout-report-filters.tsx` - Due date, Checkout start date, Checkout end date (3 instances)
- ✅ `components/reports/transaction-report-filters.tsx` - Start date, End date (2 instances)
- ✅ `components/reports/reservation-report-filters.tsx` - Reservation start date, Reservation end date (2 instances)
- ✅ `components/reports/lease-report-filters.tsx` - Lease start from, Lease start to (2 instances)
- ✅ `components/reports/depreciation-report-filters.tsx` - Date acquired from, Date acquired to (2 instances)
- ✅ `components/reports/audit-report-filters.tsx` - Start date, End date (2 instances)
- ✅ `components/reports/automated-report-filters.tsx` - Various date range filters (16 instances)

## 📋 Pages/Components to Migrate

### Forms

_All forms have been migrated ✅_

### Asset Management Pages

_All asset management pages have been migrated ✅_

### Lists Pages

_All list pages have been migrated ✅_

### Dialogs

_All dialogs have been migrated ✅_

### Report Components

_All report components have been migrated ✅_

## 📊 Summary

- **Total Files to Migrate**: 0 files remaining
- **Total Instances**: 0 instances remaining
- **Already Migrated**: 23 files
  - ✅ `app/assets/add/page.tsx` (3 instances)
  - ✅ `app/assets/[assetTagId]/page.tsx` (3 instances)
  - ✅ `app/forms/return-form/page.tsx` (3 instances)
  - ✅ `app/forms/accountability-form/page.tsx` (7 instances)
  - ✅ `app/assets/checkin/page.tsx` (1 instance)
  - ✅ `app/assets/checkout/page.tsx` (2 instances)
  - ✅ `app/assets/reserve/page.tsx` (1 instance)
  - ✅ `app/assets/lease/page.tsx` (2 instances)
  - ✅ `app/assets/lease-return/page.tsx` (1 instance)
  - ✅ `app/assets/move/page.tsx` (1 instance)
  - ✅ `app/assets/dispose/page.tsx` (1 instance)
  - ✅ `app/assets/maintenance/page.tsx` (1 instance)
  - ✅ `app/lists/maintenances/page.tsx` (2 instances)
  - ✅ `components/dialogs/schedule-dialog.tsx` (1 instance)
  - ✅ `components/dialogs/audit-dialog.tsx` (1 instance)
  - ✅ `components/reports/report-filters.tsx` (2 instances)
  - ✅ `components/reports/checkout-report-filters.tsx` (3 instances)
  - ✅ `components/reports/transaction-report-filters.tsx` (2 instances)
  - ✅ `components/reports/reservation-report-filters.tsx` (2 instances)
  - ✅ `components/reports/lease-report-filters.tsx` (2 instances)
  - ✅ `components/reports/depreciation-report-filters.tsx` (2 instances)
  - ✅ `components/reports/audit-report-filters.tsx` (2 instances)
  - ✅ `components/reports/automated-report-filters.tsx` (16 instances)

## 🔄 Migration Steps

For each file, follow these steps:

1. **Import DatePicker component**:
   ```tsx
   import { DatePicker } from "@/components/ui/date-picker"
   ```

2. **Replace native date input**:
   ```tsx
   // Before
   <Input
     type="date"
     {...form.register("fieldName")}
   />
   
   // After
   <Controller
     name="fieldName"
     control={form.control}
     render={({ field, fieldState }) => (
       <DatePicker
         id="fieldName"
         value={field.value}
         onChange={field.onChange}
         onBlur={field.onBlur}
         placeholder="Select date"
         error={fieldState.error?.message}
         className="gap-2"
         labelClassName="hidden"
       />
     )}
   />
   ```

3. **For non-form fields** (direct state):
   ```tsx
   // Before
   <Input
     type="date"
     value={dateValue}
     onChange={(e) => setDateValue(e.target.value)}
   />
   
   // After
   <DatePicker
     id="fieldName"
     value={dateValue}
     onChange={setDateValue}
     placeholder="Select date"
   />
   ```

## 🎯 Priority Order

1. **High Priority** (User-facing forms):
   - ✅ Return Form (Completed)
   - ✅ Accountability Form (Completed)
   - ✅ Checkin Page (Completed)
   - ✅ Checkout Page (Completed)
   - ✅ Reserve Page (Completed)
   - ✅ Lease Pages (Completed)

2. **Medium Priority** (Asset management):
   - Move/Dispose pages
   - Maintenance pages

3. **Low Priority** (Filters and reports):
   - Report filter components
   - List page filters

## 📝 Notes

- The DatePicker component uses ISO date strings (YYYY-MM-DD) for value and onChange
- It includes proper error handling and validation display
- It has consistent styling with `bg-transparent dark:bg-input/30`
- It supports placeholder text and custom styling via className props


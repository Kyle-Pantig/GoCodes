'use client'

import { useState, useRef, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Controller, Control, FieldError } from 'react-hook-form'
import { Search } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel, FieldContent, FieldError as FieldErrorComponent } from '@/components/ui/field'
import { cn } from '@/lib/utils'

interface EmployeeUser {
  id: string
  name: string
  email: string
  department: string | null
  checkouts?: Array<{
    asset: {
      assetTagId: string
    }
  }>
}

interface EmployeeSelectFieldProps {
  // For react-hook-form integration
  name?: string
  control?: Control<any>
  error?: FieldError
  
  // For regular state management
  value?: string
  onValueChange?: (value: string) => void
  
  // Common props
  label?: string
  required?: boolean
  disabled?: boolean
  placeholder?: string
  currentEmployeeId?: string // For highlighting current employee (used in move page)
  queryKey?: string[] // Custom query key for employees
}

export function EmployeeSelectField({
  name,
  control,
  error,
  value,
  onValueChange,
  label = 'Assign To',
  required = true,
  disabled = false,
  placeholder = 'Select an employee',
  currentEmployeeId,
  queryKey = ['employees'],
}: EmployeeSelectFieldProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Fetch employees
  const { data: employees = [], isLoading: isLoadingEmployees } = useQuery<EmployeeUser[]>({
    queryKey,
    queryFn: async () => {
      const response = await fetch('/api/employees')
      if (!response.ok) {
        throw new Error('Failed to fetch employees')
      }
      const data = await response.json()
      return (data.employees || []) as EmployeeUser[]
    },
    retry: 2,
    retryDelay: 1000,
  })

  // Filter employees based on search term
  const filteredEmployees = useMemo(() => {
    if (!searchTerm.trim()) {
      return employees
    }
    
    const searchLower = searchTerm.toLowerCase().trim()
    return employees.filter((employee) => {
      const nameMatch = employee.name.toLowerCase().includes(searchLower)
      const emailMatch = employee.email.toLowerCase().includes(searchLower)
      const departmentMatch = employee.department?.toLowerCase().includes(searchLower) || false
      
      return nameMatch || emailMatch || departmentMatch
    })
  }, [employees, searchTerm])

  // Shared SelectContent to avoid duplication
  const renderSelectContent = () => (
                <SelectContent className="max-h-[300px] w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)]" position="popper">
                  <div className="sticky -top-1 z-50 -mx-1 -mt-1 px-3 py-1.5 bg-popover border-b border-border mb-1 backdrop-blur-sm">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        ref={searchInputRef}
                        placeholder="Search employees..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        onFocus={(e) => e.stopPropagation()}
                        className="pl-8 h-8"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  {filteredEmployees.length === 0 ? (
                    <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                      No employees found
                    </div>
                  ) : (
                    filteredEmployees.map((employee) => {
                      const activeCheckouts = employee.checkouts || []
                      const hasCheckedOutAssets = activeCheckouts.length > 0
                      const assetTagIds = hasCheckedOutAssets
                        ? activeCheckouts.map((co) => co.asset.assetTagId).join(', ')
                        : ''
                      const isCurrentEmployee = currentEmployeeId === employee.id

                      return (
                        <SelectItem
                          key={employee.id}
                          value={employee.id}
                          className={isCurrentEmployee ? 'bg-primary' : ''}
                        >
                          <span>
                            {employee.name} ({employee.email})
                            {employee.department && (
                              <span className="text-muted-foreground"> - {employee.department}</span>
                            )}
                            {isCurrentEmployee && (
                              <span className="ml-2 text-xs text-muted-foreground font-medium">
                                (Current)
                              </span>
                            )}
                            {hasCheckedOutAssets && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                - Checked out: {assetTagIds}
                              </span>
                            )}
                          </span>
                        </SelectItem>
                      )
                    })
                  )}
                </SelectContent>
  )

  // If using react-hook-form
  if (control && name) {
    return (
      <Field>
        <FieldLabel htmlFor={name}>
          {label} {required && <span className="text-destructive">*</span>}
        </FieldLabel>
        <FieldContent>
          <Controller
            name={name}
            control={control}
            render={({ field }) => (
              <Select
                value={field.value || ''}
                onValueChange={(value) => {
                  field.onChange(value)
                  // Clear search when employee is selected
                  setSearchTerm('')
                }}
                onOpenChange={(open) => {
                  if (open) {
                    // Focus search input when select opens
                    setTimeout(() => {
                      searchInputRef.current?.focus()
                    }, 100)
                  } else {
                    // Clear search when select closes
                    setSearchTerm('')
                  }
                }}
                disabled={disabled || isLoadingEmployees}
              >
                <SelectTrigger className="w-full" aria-invalid={error ? 'true' : 'false'}>
                  <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                {renderSelectContent()}
              </Select>
            )}
          />
          {error && <FieldErrorComponent>{error.message}</FieldErrorComponent>}
        </FieldContent>
      </Field>
    )
  }

  // If using regular state management
  return (
    <Field>
      <FieldLabel htmlFor="employee-select">
        {label} {required && <span className="text-destructive">*</span>}
      </FieldLabel>
      <FieldContent>
        <Select
          value={value || ''}
          onValueChange={(value) => {
            onValueChange?.(value)
            // Clear search when employee is selected
            setSearchTerm('')
          }}
          onOpenChange={(open) => {
            if (open) {
              // Focus search input when select opens
              setTimeout(() => {
                searchInputRef.current?.focus()
              }, 100)
            } else {
              // Clear search when select closes
              setSearchTerm('')
            }
          }}
          disabled={disabled || isLoadingEmployees}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          {renderSelectContent()}
        </Select>
      </FieldContent>
    </Field>
  )
}


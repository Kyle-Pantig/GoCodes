'use client'

import { useEffect } from 'react'
import type React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { Field, FieldLabel, FieldContent, FieldError } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { departmentSchema, type DepartmentFormData } from '@/lib/validations/departments'

interface DepartmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: { name: string; description?: string }) => Promise<void>
  mode?: 'create' | 'edit'
  initialData?: {
    name: string
    description?: string
  }
  isLoading?: boolean
}

export function DepartmentDialog({
  open,
  onOpenChange,
  onSubmit,
  mode = 'create',
  initialData,
  isLoading = false,
}: DepartmentDialogProps) {
  const form = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  })

  useEffect(() => {
    if (!open) {
      form.reset({
        name: '',
        description: '',
      })
      return
    }

    if (initialData) {
      form.reset({
        name: initialData.name || '',
        description: initialData.description || '',
      })
    } else {
      form.reset({
        name: '',
        description: '',
      })
    }
  }, [open, initialData, form])
  
  const handleSubmit = async (data: DepartmentFormData) => {
    await onSubmit({
      name: data.name.trim(),
      description: data.description?.trim() || undefined,
    })
  }

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    e.stopPropagation()
    await form.handleSubmit(handleSubmit)(e)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isLoading) {
      onOpenChange(newOpen)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit' ? 'Edit Department' : 'Create Department'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'edit'
              ? 'Update department information'
              : 'Add a new department for assets'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleFormSubmit}>
          <div className="space-y-4">
            <Field>
              <FieldLabel htmlFor="department-name">
                Name <span className="text-destructive">*</span>
              </FieldLabel>
              <FieldContent>
                <Input
                  id="department-name"
                  {...form.register('name')}
                  placeholder="Department name"
                  disabled={isLoading}
                  aria-invalid={form.formState.errors.name ? 'true' : 'false'}
                />
              </FieldContent>
              <FieldError>{form.formState.errors.name?.message}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="department-description">Description</FieldLabel>
              <FieldContent>
                <Textarea
                  id="department-description"
                  {...form.register('description')}
                  placeholder="Department description (optional)"
                  disabled={isLoading}
                  className="min-h-[80px]"
                  aria-invalid={form.formState.errors.description ? 'true' : 'false'}
                />
              </FieldContent>
              <FieldError>{form.formState.errors.description?.message}</FieldError>
            </Field>
          </div>
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
              className='btn-glass'
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  {mode === 'edit' ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                mode === 'edit' ? 'Update' : 'Create'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}


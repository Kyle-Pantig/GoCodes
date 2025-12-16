'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
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
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { Field, FieldLabel, FieldContent, FieldError } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CheckCircle2 } from 'lucide-react'
import { auditSchema, type AuditFormData } from '@/lib/validations/audit'

interface AuditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: AuditFormData) => Promise<void>
  isLoading?: boolean
}

export function AuditDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
}: AuditDialogProps) {
  const form = useForm<AuditFormData>({
    resolver: zodResolver(auditSchema),
    defaultValues: {
      auditType: '',
      auditDate: new Date().toISOString().split('T')[0],
      status: 'Completed',
      auditor: '',
      notes: '',
    },
  })

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      form.reset({
        auditType: '',
        auditDate: new Date().toISOString().split('T')[0],
        status: 'Completed',
        auditor: '',
        notes: '',
      })
    }
  }, [open, form])

  const handleSubmit = async (data: AuditFormData) => {
    await onSubmit(data)
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
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            New Audit Record
          </DialogTitle>
          <DialogDescription>
            Fill in the details for this audit
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="auditType">
                  Audit Type <span className="text-destructive">*</span>
                </FieldLabel>
                <FieldContent>
                  <Input
                    id="auditType"
                    {...form.register('auditType')}
                    placeholder="e.g., October Audit, Annual Audit"
                    disabled={isLoading}
                    aria-invalid={form.formState.errors.auditType ? 'true' : 'false'}
                  />
                </FieldContent>
                <FieldError>{form.formState.errors.auditType?.message}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="auditDate">
                  Audit Date <span className="text-destructive">*</span>
                </FieldLabel>
                <FieldContent>
                  <Input
                    id="auditDate"
                    type="date"
                    {...form.register('auditDate')}
                    disabled={isLoading}
                    aria-invalid={form.formState.errors.auditDate ? 'true' : 'false'}
                  />
                </FieldContent>
                <FieldError>{form.formState.errors.auditDate?.message}</FieldError>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="status">Status</FieldLabel>
                <FieldContent>
                  <Controller
                    name="status"
                    control={form.control}
                    render={({ field }) => (
                      <Select
                        value={field.value || 'Completed'}
                        onValueChange={field.onChange}
                        disabled={isLoading}
                      >
                        <SelectTrigger id="status" aria-invalid={form.formState.errors.status ? 'true' : 'false'}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Completed">Completed</SelectItem>
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="In Progress">In Progress</SelectItem>
                          <SelectItem value="Failed">Failed</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FieldContent>
                <FieldError>{form.formState.errors.status?.message}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="auditor">Auditor</FieldLabel>
                <FieldContent>
                  <Input
                    id="auditor"
                    {...form.register('auditor')}
                    placeholder="Auditor name"
                    disabled={isLoading}
                    aria-invalid={form.formState.errors.auditor ? 'true' : 'false'}
                  />
                </FieldContent>
                <FieldError>{form.formState.errors.auditor?.message}</FieldError>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="notes">Notes</FieldLabel>
              <FieldContent>
                <Textarea
                  id="notes"
                  {...form.register('notes')}
                  placeholder="Additional notes or observations..."
                  rows={3}
                  className="resize-none"
                  disabled={isLoading}
                  aria-invalid={form.formState.errors.notes ? 'true' : 'false'}
                />
              </FieldContent>
              <FieldError>{form.formState.errors.notes?.message}</FieldError>
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
                  Adding...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Add Audit
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}


'use client'

import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CheckCircle2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/shadcn-io/spinner'

interface AuditHistoryManagerProps {
  assetId: string
  assetTagId: string
}

export function AuditHistoryManager({ assetId }: AuditHistoryManagerProps) {
  const queryClient = useQueryClient()
  const [isAdding, setIsAdding] = useState(false)

  // Fetch audit history
  const { data: auditData, isLoading } = useQuery({
    queryKey: ['auditHistory', assetId],
    queryFn: async () => {
      const response = await fetch(`/api/assets/${assetId}/audit`)
      if (!response.ok) throw new Error('Failed to fetch audit history')
      return response.json()
    },
  })

  const audits = auditData?.audits || []

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (auditId: string) => {
      const response = await fetch(`/api/assets/audit/${auditId}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete audit')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auditHistory', assetId] })
      toast.success('Audit record deleted')
    },
    onError: () => {
      toast.error('Failed to delete audit record')
    },
  })
  
  // Add mutation
  const addMutation = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/assets/${assetId}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error('Failed to create audit')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auditHistory', assetId] })
      setIsAdding(false)
      toast.success('Audit record created')
    },
    onError: () => {
      toast.error('Failed to create audit record')
    },
  })

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    const auditData = {
      auditType: formData.get('auditType') as string,
      auditDate: formData.get('auditDate') as string,
      auditor: formData.get('auditor') as string || null,
      status: formData.get('status') as string || 'Completed',
      notes: formData.get('notes') as string || null,
    }

    addMutation.mutate(auditData)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {audits.length} audit record{audits.length !== 1 ? 's' : ''}
        </div>
        {!isAdding && (
          <Button onClick={() => setIsAdding(true)} size="sm" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Add Audit Record
          </Button>
        )}
      </div>

      {/* Add Form */}
      {isAdding && (
        <Card className="border-2 border-primary/20 bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              New Audit Record
            </CardTitle>
            <CardDescription>Fill in the details for this audit</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="auditType" className="text-sm font-medium">
                    Audit Type <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="auditType"
                    name="auditType"
                    required
                    placeholder="e.g., October Audit, Annual Audit"
                    className="w-full"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="auditDate" className="text-sm font-medium">
                    Audit Date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="auditDate"
                    name="auditDate"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="status" className="text-sm font-medium">Status</Label>
                  <Select name="status" defaultValue="Completed">
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="auditor" className="text-sm font-medium">Auditor</Label>
                  <Input
                    id="auditor"
                    name="auditor"
                    placeholder="Auditor name"
                    className="w-full"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="Additional notes or observations..."
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAdding(false)}
                  className="min-w-[100px]"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={addMutation.isPending} className="min-w-[100px]">
                  {addMutation.isPending ? (
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
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Audit List */}
      <ScrollArea className="h-[450px] pr-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Spinner className="h-8 w-8 mb-2" />
            <p className="text-sm text-muted-foreground">Loading audit history...</p>
          </div>
        ) : audits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-3 mb-4">
              <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No audit records yet</p>
            <p className="text-xs text-muted-foreground">Add your first audit record to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {audits.map((audit: any) => {
              const auditDate = audit.auditDate ? new Date(audit.auditDate) : null
              const formattedDate = auditDate ? auditDate.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              }) : '-'
              
              return (
                <Card key={audit.id} className="hover:bg-accent/50 transition-colors border-border/50 py-2">
                  <CardContent className="py-2.5 px-4">
                    <div className="flex justify-between items-start gap-3">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="font-medium text-xs">
                            {audit.auditType}
                          </Badge>
                          {audit.status && (
                            <Badge
                              variant={
                                audit.status === 'Completed'
                                  ? 'default'
                                  : audit.status === 'Pending'
                                  ? 'secondary'
                                  : audit.status === 'In Progress'
                                  ? 'outline'
                                  : 'destructive'
                              }
                              className="font-medium text-xs"
                            >
                              {audit.status}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-sm">
                            <div className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                            <span className="text-muted-foreground text-xs">Date:</span>
                            <span className="text-foreground text-sm">{formattedDate}</span>
                          </div>
                          
                          {audit.auditor && (
                            <div className="flex items-center gap-1.5 text-sm">
                              <div className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                              <span className="text-muted-foreground text-xs">Auditor:</span>
                              <span className="text-foreground text-sm">{audit.auditor}</span>
                            </div>
                          )}
                          
                          {audit.notes && (
                            <div className="pt-1 mt-1 border-t border-border/50">
                              <p className="text-sm text-foreground leading-snug">{audit.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`Delete audit record "${audit.auditType}"?`)) {
                            deleteMutation.mutate(audit.id)
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="shrink-0 text-muted-foreground hover:text-destructive h-7 w-7"
                      >
                        {deleteMutation.isPending ? (
                          <Spinner className="h-3.5 w-3.5" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}


'use client'

import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowRight, Calendar, CheckCircle, Clock, UserPlus, UserCircle, Edit2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/shadcn-io/spinner'

interface CheckoutManagerProps {
  assetId: string
  assetTagId: string
  invalidateQueryKey?: string[] // Optional query key to invalidate after updates
}

export function CheckoutManager({ assetId, invalidateQueryKey = ['assets'] }: CheckoutManagerProps) {
  const queryClient = useQueryClient()
  const [editingCheckoutId, setEditingCheckoutId] = useState<string | null>(null)
  const [employeeSearch, setEmployeeSearch] = useState<Record<string, string>>({})

  // Fetch checkout records
  const { data: checkoutData, isLoading } = useQuery({
    queryKey: ['checkoutHistory', assetId],
    queryFn: async () => {
      const response = await fetch(`/api/assets/${assetId}/checkout`)
      if (!response.ok) throw new Error('Failed to fetch checkout history')
      return response.json()
    },
  })

  const checkouts = checkoutData?.checkouts || []

  // Fetch employees
  const { data: employees = [] } = useQuery({
    queryKey: ['employees', 'checkout-manager'],
    queryFn: async () => {
      const response = await fetch('/api/employees')
      if (!response.ok) throw new Error('Failed to fetch employees')
      const data = await response.json()
      return data.employees || []
    },
  })

  // Update checkout mutation
  const updateMutation = useMutation({
    mutationFn: async ({ checkoutId, employeeUserId }: { checkoutId: string; employeeUserId: string | null }) => {
      const response = await fetch(`/api/assets/checkout/${checkoutId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeUserId }),
      })
      if (!response.ok) throw new Error('Failed to update checkout')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkoutHistory', assetId] })
      // Invalidate the provided query key or default to 'assets'
      queryClient.invalidateQueries({ queryKey: invalidateQueryKey })
      setEditingCheckoutId(null)
      toast.success('Employee assigned successfully')
    },
    onError: () => {
      toast.error('Failed to assign employee')
    },
  })

  const handleAssignEmployee = (checkoutId: string, employeeUserId: string | null) => {
    updateMutation.mutate({ checkoutId, employeeUserId })
  }

  // Filter employees based on search
  const getFilteredEmployees = (checkoutId: string) => {
    const searchTerm = employeeSearch[checkoutId]?.toLowerCase() || ''
    if (!searchTerm) return employees
    return employees.filter((emp: { id: string; name: string; email: string; department?: string | null }) =>
      emp.name.toLowerCase().includes(searchTerm) || 
      emp.email.toLowerCase().includes(searchTerm) ||
      (emp.department && emp.department.toLowerCase().includes(searchTerm))
    )
  }

  // Sort checkouts: active first, then by date
  const sortedCheckouts = [...checkouts].sort((a, b) => {
    const aCheckedIn = a.checkins.length > 0
    const bCheckedIn = b.checkins.length > 0
    if (aCheckedIn !== bCheckedIn) return aCheckedIn ? 1 : -1
    return new Date(b.checkoutDate).getTime() - new Date(a.checkoutDate).getTime()
  })

  return (
    <div className="flex flex-col gap-4">
      {checkouts.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <div className="text-sm text-muted-foreground">
            {checkouts.length} checkout record{checkouts.length !== 1 ? 's' : ''}
            {sortedCheckouts.filter(c => !c.checkins.length && !c.employeeUser).length > 0 && (
              <span className="ml-2 text-yellow-600 dark:text-yellow-500 font-medium">
                ({sortedCheckouts.filter(c => !c.checkins.length && !c.employeeUser).length} need assignment)
              </span>
            )}
          </div>
        </div>
      )}

      <ScrollArea className="max-h-[450px]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Spinner className="h-8 w-8 mb-3" />
            <p className="text-sm text-muted-foreground">Loading checkout history...</p>
          </div>
        ) : checkouts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ArrowRight className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="font-medium text-base mb-1">No checkout records found</p>
            <p className="text-sm">Checkout records will appear here when assets are checked out</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedCheckouts.map((checkout: {
              id: string
              checkoutDate: string
              expectedReturnDate: string | null
              employeeUser: { id: string; name: string; email: string; department: string | null } | null
              checkins: Array<{ id: string }>
            }) => {
              const checkoutDate = checkout.checkoutDate ? new Date(checkout.checkoutDate) : null
              const formattedDate = checkoutDate ? checkoutDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              }) : '-'
              
              const expectedReturnDate = checkout.expectedReturnDate ? new Date(checkout.expectedReturnDate) : null
              const formattedReturnDate = expectedReturnDate ? expectedReturnDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              }) : '-'

              const isCheckedIn = checkout.checkins.length > 0
              const needsAssignment = !checkout.employeeUser && !isCheckedIn
              const isEditing = editingCheckoutId === checkout.id
              const filteredEmployees = getFilteredEmployees(checkout.id)

              return (
                <Card 
                  key={checkout.id} 
                  className={`hover:bg-accent/50 transition-all border-2 ${
                    needsAssignment 
                      ? 'border-yellow-500/60 bg-yellow-50/30 dark:bg-yellow-950/20 shadow-sm' 
                      : isCheckedIn
                      ? 'border-border/40 bg-muted/20'
                      : 'border-border/50'
                  }`}
                >
                  <CardContent className="p-5 relative">
                    <div className="space-y-4">
                      {/* Header: Status badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="font-medium text-xs gap-1.5 px-2.5 py-1">
                            <Calendar className="h-3 w-3" />
                            {formattedDate}
                          </Badge>
                          {isCheckedIn ? (
                            <Badge variant="default" className="text-xs gap-1 px-2.5 py-1">
                              <CheckCircle className="h-3 w-3" />
                              Checked In
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs gap-1 px-2.5 py-1">
                              <Clock className="h-3 w-3" />
                              Active
                            </Badge>
                          )}
                          {needsAssignment && (
                            <Badge variant="secondary" className="text-xs gap-1 px-2.5 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700">
                              <UserPlus className="h-3 w-3" />
                              Needs Assignment
                            </Badge>
                          )}
                        {!isCheckedIn && !isEditing && checkout.employeeUser && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 shrink-0 ml-auto"
                            onClick={() => {
                              setEditingCheckoutId(checkout.id)
                              setEmployeeSearch(prev => ({ ...prev, [checkout.id]: '' }))
                            }}
                            disabled={updateMutation.isPending}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {isEditing && checkout.employeeUser && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 shrink-0 ml-auto"
                            onClick={() => {
                              setEditingCheckoutId(null)
                              setEmployeeSearch(prev => ({ ...prev, [checkout.id]: '' }))
                            }}
                            disabled={updateMutation.isPending}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        </div>
                        
                      
                      {/* Divider */}
                      <div className="h-px bg-border/50" />
                      
                      {/* Details Section */}
                      <div className="space-y-3">
                        {/* Expected Return Date */}
                          {expectedReturnDate && (
                          <div className="flex items-center gap-3 text-sm">
                            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted/50 shrink-0">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1">
                              <div className="text-xs text-muted-foreground mb-0.5">Expected Return</div>
                              <div className="font-medium text-foreground">{formattedReturnDate}</div>
                            </div>
                            </div>
                          )}

                          {/* Employee Assignment */}
                        <div className="flex items-start gap-3 text-sm pt-1 relative">
                          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted/50 shrink-0">
                            {checkout.employeeUser ? (
                              <UserCircle className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <UserPlus className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            {checkout.employeeUser && !isEditing ? (
                              <>
                                <div className="text-xs text-muted-foreground mb-2">
                                  Assigned to: {checkout.employeeUser.name}
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="outline" className="gap-1.5 px-2.5 py-1">
                                    {checkout.employeeUser.email}
                                    {checkout.employeeUser.department && (
                                      <span className="text-muted-foreground"> - {checkout.employeeUser.department}</span>
                                    )}
                                  </Badge>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="text-xs text-muted-foreground mb-2">
                                  {checkout.employeeUser ? 'Change assignment' : 'Assign employee'}
                                </div>
                                <Select
                                  value={checkout.employeeUser?.id || ""}
                                  onValueChange={(value) => {
                                    handleAssignEmployee(checkout.id, value === 'none' || value === '' ? null : value)
                                    if (value === 'none' || value === '') {
                                      setEditingCheckoutId(null)
                                    }
                                  }}
                                  disabled={updateMutation.isPending || isCheckedIn}
                                  onOpenChange={(open) => {
                                    if (!open && isEditing) {
                                      setEditingCheckoutId(null)
                                    }
                                  }}
                                >
                                  <SelectTrigger className="h-12 w-full">
                                    <SelectValue placeholder={checkout.employeeUser ? "Change employee..." : "Select an employee..."} />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-[300px] w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)]" position="popper">
                                    {employees.length === 0 ? (
                                      <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                                        No employees found
                                      </div>
                                    ) : (
                                      <>
                                        <div className="sticky -top-1 z-50 -mx-1 -mt-1 px-3 py-1.5 bg-popover border-b border-border mb-1 backdrop-blur-sm">
                                          <Input
                                            placeholder="Search employees..."
                                            value={employeeSearch[checkout.id] || ''}
                                            onChange={(e) => setEmployeeSearch(prev => ({ ...prev, [checkout.id]: e.target.value }))}
                                            className="h-8"
                                            onClick={(e) => e.stopPropagation()}
                                            onKeyDown={(e) => e.stopPropagation()}
                                          />
                                        </div>
                                        <SelectItem value="none" className="cursor-pointer">
                                          <div className="flex items-center gap-2">
                                            <X className="h-4 w-4 text-muted-foreground" />
                                            <span>Unassign employee</span>
                                          </div>
                                        </SelectItem>
                                        {filteredEmployees.length === 0 ? (
                                          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                                            No employees match your search
                                          </div>
                                        ) : (
                                          filteredEmployees.map((emp: { id: string; name: string; email: string; department?: string | null }) => (
                                            <SelectItem key={emp.id} value={emp.id} className="cursor-pointer">
                                              <div className="flex flex-col gap-0.5 min-w-0 w-full">
                                                <span className="font-medium text-sm truncate text-left">{emp.name}</span>
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                  <span className="truncate">{emp.email}</span>
                                                  {emp.department && (
                                                    <>
                                                      <span className="shrink-0">•</span>
                                                      <span className="truncate">{emp.department}</span>
                                                    </>
                                                  )}
                                                </div>
                                              </div>
                                            </SelectItem>
                                          ))
                                        )}
                                      </>
                                    )}
                                  </SelectContent>
                                </Select>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
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


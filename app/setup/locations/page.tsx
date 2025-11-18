'use client'

import { useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { MoreHorizontal, Trash2, Edit, Plus, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { BulkDeleteDialog } from '@/components/bulk-delete-dialog'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { usePermissions } from '@/hooks/use-permissions'
import { useQueryClient } from '@tanstack/react-query'
import { 
  useLocations, 
  useCreateLocation, 
  useUpdateLocation, 
  useDeleteLocation,
  type Location,
} from '@/hooks/use-locations'
import { LocationDialog } from '@/components/location-dialog'
import { useIsMobile } from '@/hooks/use-mobile'

export default function LocationsPage() {
  const queryClient = useQueryClient()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const canManageSetup = hasPermission('canManageSetup')
  const isMobile = useIsMobile()
  
  const { data: locations = [], isLoading: locationsLoading, error: locationsError } = useLocations()
  const createLocationMutation = useCreateLocation()
  const updateLocationMutation = useUpdateLocation()
  const deleteLocationMutation = useDeleteLocation()

  // Dialog states
  const [isCreateLocationDialogOpen, setIsCreateLocationDialogOpen] = useState(false)
  const [isEditLocationDialogOpen, setIsEditLocationDialogOpen] = useState(false)
  const [isDeleteLocationDialogOpen, setIsDeleteLocationDialogOpen] = useState(false)
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false)
  
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [selectedLocations, setSelectedLocations] = useState<Set<string>>(new Set())
  const [isSelectionMode, setIsSelectionMode] = useState(false)

  // Location handlers
  const handleCreateLocation = async (data: { name: string; description?: string }) => {
    if (!canManageSetup) {
      toast.error('You do not have permission to manage locations')
      return
    }

    try {
      await createLocationMutation.mutateAsync(data)
      setIsCreateLocationDialogOpen(false)
      toast.success('Location created successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create location')
    }
  }

  const handleEditLocation = (location: Location) => {
    if (!canManageSetup) {
      toast.error('You do not have permission to manage locations')
      return
    }
    setSelectedLocation(location)
    setIsEditLocationDialogOpen(true)
  }

  const handleUpdateLocation = async (data: { name: string; description?: string }) => {
    if (!selectedLocation || !canManageSetup) return

    try {
      await updateLocationMutation.mutateAsync({
        id: selectedLocation.id,
        ...data,
      })
      setIsEditLocationDialogOpen(false)
      setSelectedLocation(null)
      toast.success('Location updated successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update location')
    }
  }

  const handleDeleteLocation = (location: Location) => {
    if (!canManageSetup) {
      toast.error('You do not have permission to manage locations')
      return
    }
    
    setSelectedLocation(location)
    setIsDeleteLocationDialogOpen(true)
  }

  const confirmDeleteLocation = async () => {
    if (!selectedLocation) return

    try {
      await deleteLocationMutation.mutateAsync(selectedLocation.id)
      setIsDeleteLocationDialogOpen(false)
      setSelectedLocation(null)
      toast.success('Location deleted successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete location')
    }
  }

  // Handle checkbox selection
  const handleLocationSelect = (e: React.MouseEvent, locationId: string) => {
    e.stopPropagation()
    toggleLocationSelection(locationId)
  }

  // Toggle location selection
  const toggleLocationSelection = (locationId: string) => {
    setSelectedLocations(prev => {
      const newSet = new Set(prev)
      if (newSet.has(locationId)) {
        newSet.delete(locationId)
      } else {
        newSet.add(locationId)
      }
      return newSet
    })
  }

  // Handle card click in selection mode
  const handleCardClick = (locationId: string) => {
    if (isSelectionMode) {
      toggleLocationSelection(locationId)
    }
  }

  // Toggle selection mode
  const handleToggleSelectionMode = () => {
    setIsSelectionMode(prev => !prev)
    if (isSelectionMode) {
      // Clear selections when exiting selection mode
      setSelectedLocations(new Set())
    }
  }

  // Handle select/deselect all
  const handleToggleSelectAll = () => {
    if (selectedLocations.size === locations.length) {
      setSelectedLocations(new Set())
    } else {
      setSelectedLocations(new Set(locations.map(loc => loc.id)))
    }
  }

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (selectedLocations.size === 0) return
    
    const selectedArray = Array.from(selectedLocations)
    
    try {
      // Delete locations one by one (since we need to check for associated assets)
      for (const locationId of selectedArray) {
        await deleteLocationMutation.mutateAsync(locationId)
      }
      
      toast.success(`Successfully deleted ${selectedArray.length} location(s)`)
      setSelectedLocations(new Set())
      setIsBulkDeleteDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ['locations'] })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete locations')
      setIsBulkDeleteDialogOpen(false)
    }
  }

  if (permissionsLoading || locationsLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Spinner className="h-8 w-8" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (locationsError) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Locations</CardTitle>
            <CardDescription>Manage asset locations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MapPin className="h-12 w-12 text-destructive mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error Loading Locations</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {locationsError instanceof Error ? locationsError.message : 'Failed to load locations'}
              </p>
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!canManageSetup) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Locations</CardTitle>
            <CardDescription>Manage asset locations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
              <p className="text-sm text-muted-foreground">
                You do not have permission to manage locations. Please contact an administrator.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Locations</h1>
            <p className="text-muted-foreground">
              Manage asset locations
            </p>
          </div>
          {/* Desktop: All controls on right */}
          {!isMobile && (
            <div className="flex items-center gap-2">
              {isSelectionMode && (
                <div className="flex items-center gap-2 px-2">
                  <Checkbox
                    id="select-all-locations"
                    checked={selectedLocations.size === locations.length && locations.length > 0}
                    onCheckedChange={handleToggleSelectAll}
                    disabled={locations.length === 0}
                    title={selectedLocations.size === locations.length && locations.length > 0
                      ? 'Deselect All'
                      : 'Select All'}
                    className='cursor-pointer'
                  />
                  <span className="text-sm text-muted-foreground">
                    {selectedLocations.size} selected
                  </span>
                </div>
              )}
              <Button
                variant={isSelectionMode ? "default" : "outline"}
                size="sm"
                onClick={handleToggleSelectionMode}
              >
                {isSelectionMode ? "Cancel" : "Select"}
              </Button>
              {isSelectionMode && selectedLocations.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setIsBulkDeleteDialogOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete ({selectedLocations.size})
                </Button>
              )}
              <Button onClick={() => setIsCreateLocationDialogOpen(true)} size='sm'>
                <Plus className="mr-2 h-4 w-4" />
                Add Location
              </Button>
            </div>
          )}
        </div>
        {/* Mobile: Selection controls when selection mode is active */}
        {isMobile && isSelectionMode && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <div className="flex items-center gap-2 px-2">
              <Checkbox
                id="select-all-locations-mobile"
                checked={selectedLocations.size === locations.length && locations.length > 0}
                onCheckedChange={handleToggleSelectAll}
                disabled={locations.length === 0}
                title={selectedLocations.size === locations.length && locations.length > 0
                  ? 'Deselect All'
                  : 'Select All'}
                className='cursor-pointer'
              />
              <span className="text-sm text-muted-foreground">
                {selectedLocations.size} selected
              </span>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={handleToggleSelectionMode}
            >
              Cancel
            </Button>
            {selectedLocations.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsBulkDeleteDialogOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete ({selectedLocations.size})
              </Button>
            )}
          </div>
        )}
        {/* Mobile: Select and Add Location buttons when selection mode is NOT active */}
        {isMobile && !isSelectionMode && (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleSelectionMode}
            >
              Select
            </Button>
            <Button onClick={() => setIsCreateLocationDialogOpen(true)} size='sm'>
              <Plus className="mr-2 h-4 w-4" />
              Add Location
            </Button>
          </div>
        )}
      </div>

      {locations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Locations</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Get started by creating your first location
            </p>
            <Button onClick={() => setIsCreateLocationDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Location
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.map((location) => (
            <Card 
              key={location.id} 
              className={`flex flex-col h-full group relative transition-all ${
                isSelectionMode ? 'cursor-pointer' : ''
              } ${
                selectedLocations.has(location.id)
                  ? 'border-primary'
                  : ''
              }`}
              onClick={() => handleCardClick(location.id)}
            >
              {/* Checkbox - visible when in selection mode */}
              {isSelectionMode && (
                <div 
                  className="absolute top-3 left-3 z-20"
                  onClick={(e) => handleLocationSelect(e, location.id)}
                >
                  <Checkbox
                    checked={selectedLocations.has(location.id)}
                    onCheckedChange={() => toggleLocationSelection(location.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="border-white data-[state=checked]:bg-white data-[state=checked]:text-black cursor-pointer"
                  />
                </div>
              )}
              
              {/* Selection overlay */}
              {selectedLocations.has(location.id) && (
                <div className="absolute inset-0 bg-primary/10 border-2 border-primary rounded-lg pointer-events-none z-10" />
              )}
              
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className={`flex items-start gap-2 flex-1 min-w-0 pr-1 ${isSelectionMode ? 'pl-8' : ''}`}>
                    <MapPin className="h-5 w-5 mt-0.5 shrink-0 text-primary" />
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <CardTitle className="text-base leading-tight line-clamp-2">{location.name}</CardTitle>
                      {location.description && (
                        <CardDescription className="mt-1 line-clamp-2 text-xs">
                          {location.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  {canManageSetup && !isSelectionMode && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          className="h-8 w-8 p-0 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditLocation(location)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteLocation(location)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Create Location Dialog */}
      <LocationDialog
        open={isCreateLocationDialogOpen}
        onOpenChange={setIsCreateLocationDialogOpen}
        onSubmit={handleCreateLocation}
        mode="create"
        isLoading={createLocationMutation.isPending}
      />

      {/* Edit Location Dialog */}
      <LocationDialog
        open={isEditLocationDialogOpen}
        onOpenChange={setIsEditLocationDialogOpen}
        onSubmit={handleUpdateLocation}
        mode="edit"
        initialData={selectedLocation ? {
          name: selectedLocation.name,
          description: selectedLocation.description || undefined,
        } : undefined}
        isLoading={updateLocationMutation.isPending}
      />

      {/* Delete Location Confirmation */}
      <DeleteConfirmationDialog
        open={isDeleteLocationDialogOpen}
        onOpenChange={setIsDeleteLocationDialogOpen}
        onConfirm={confirmDeleteLocation}
        title="Delete Location"
        description={`Are you sure you want to delete location "${selectedLocation?.name}"? This action cannot be undone.`}
        isLoading={deleteLocationMutation.isPending}
      />

      {/* Bulk Delete Confirmation */}
      <BulkDeleteDialog
        open={isBulkDeleteDialogOpen}
        onOpenChange={setIsBulkDeleteDialogOpen}
        onConfirm={handleBulkDelete}
        itemCount={selectedLocations.size}
        itemName="Location"
        isLoading={deleteLocationMutation.isPending}
        title={`Delete ${selectedLocations.size} Location(s)?`}
        description={`Are you sure you want to permanently delete ${selectedLocations.size} selected location(s)? This action cannot be undone.`}
        confirmLabel={`Delete ${selectedLocations.size} Location(s)`}
      />
    </div>
  )
}


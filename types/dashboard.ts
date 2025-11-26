export type DashboardStats = {
  assetValueByCategory: Array<{ name: string; value: number }>
  activeCheckouts: Array<{
    id: string
    checkoutDate: string
    expectedReturnDate: string | null
    asset: {
      id: string
      assetTagId: string
      description: string
    }
    employeeUser: {
      id: string
      name: string
      email: string
    } | null
  }>
  recentCheckins: Array<{
    id: string
    checkinDate: string
    asset: {
      id: string
      assetTagId: string
      description: string
    }
    checkout: {
      employeeUser: {
        id: string
        name: string
        email: string
      }
    }
  }>
  assetsUnderRepair: Array<{
    id: string
    dueDate: string | null
    status: string
    maintenanceBy: string | null
    asset: {
      id: string
      assetTagId: string
      description: string
    }
  }>
  recentMoves: Array<{
    id: string
    moveDate: string
    newLocation: string | null
    asset: {
      id: string
      assetTagId: string
      description: string
    }
    employeeUser: {
      id: string
      name: string
      email: string
    } | null
  }>
  recentReserves: Array<{
    id: string
    reservationDate: string
    reservationType: string
    asset: {
      id: string
      assetTagId: string
      description: string
    }
    employeeUser: {
      id: string
      name: string
      email: string
    } | null
  }>
  recentLeases: Array<{
    id: string
    leaseStartDate: string
    leaseEndDate: string | null
    lessee: string
    asset: {
      id: string
      assetTagId: string
      description: string
    }
  }>
  recentReturns: Array<{
    id: string
    returnDate: string
    asset: {
      id: string
      assetTagId: string
      description: string
    }
    lease: {
      id: string
      lessee: string
    }
  }>
  recentDisposes: Array<{
    id: string
    disposeDate: string
    disposalMethod: string | null
    asset: {
      id: string
      assetTagId: string
      description: string
    }
  }>
  feedCounts: {
    totalActiveCheckouts: number
    totalCheckins: number
    totalAssetsUnderRepair: number
    totalMoves: number
    totalReserves: number
    totalLeases: number
    totalReturns: number
    totalDisposes: number
  }
  summary: {
    totalActiveAssets: number
    totalValue: number
    purchasesInFiscalYear: number
    checkedOutCount: number
    availableCount: number
    checkedOutAndAvailable: number
  }
  calendar: {
    leasesExpiring: Array<{
      id: string
      leaseEndDate: string | null
      lessee: string
      asset: {
        id: string
        assetTagId: string
        description: string
      }
    }>
    maintenanceDue: Array<{
      id: string
      dueDate: string | null
      title: string
      asset: {
        id: string
        assetTagId: string
        description: string
      }
    }>
  }
}


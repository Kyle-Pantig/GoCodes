'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import { MobileDock } from '@/components/ui/mobile-dock'
import { useIsMobile } from '@/hooks/use-mobile'

interface MobileDockContextType {
  setDockContent: (content: ReactNode | null) => void
  isDockVisible: boolean
}

const MobileDockContext = createContext<MobileDockContextType | null>(null)

export function useMobileDock() {
  const context = useContext(MobileDockContext)
  if (!context) {
    throw new Error('useMobileDock must be used within MobileDockProvider')
  }
  return context
}

export function MobileDockProvider({ children }: { children: ReactNode }) {
  const [dockContent, setDockContent] = useState<ReactNode | null>(null)
  const isMobile = useIsMobile()
  const isDockVisible = isMobile && dockContent !== null

  return (
    <MobileDockContext.Provider value={{ setDockContent, isDockVisible }}>
      {children}
      {isDockVisible && (
        <MobileDock>
          {dockContent}
        </MobileDock>
      )}
    </MobileDockContext.Provider>
  )
}


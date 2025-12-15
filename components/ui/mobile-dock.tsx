'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface MobileDockProps {
  children: ReactNode
  className?: string
}

export function MobileDock({ children, className }: MobileDockProps) {
  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'md:hidden', // Only visible on mobile
        'bg-white/10 dark:bg-white/5',
        'bg-clip-padding',
        'backdrop-filter backdrop-blur-md',
        'border-t border-t-black/20',
        'shadow-xl',
        'rounded-t-2xl',
        'px-4 py-3',
        'safe-area-inset-bottom', // For devices with notches
        className
      )}
    >
      <div className="flex items-center justify-between w-full">
        {children}
      </div>
    </div>
  )
}


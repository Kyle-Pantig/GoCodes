"use client"

import { usePathname } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { MobileDockProvider, useMobileDock } from "@/components/mobile-dock-provider"

function AppLayoutContent({ 
  children,
}: { 
  children: React.ReactNode
}) {
  const { isDockVisible } = useMobileDock()

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <AppHeader />
        <div className={cn("flex flex-1 flex-col gap-4 p-4 pt-0 md:p-6 min-w-0 overflow-x-auto", isDockVisible && "pb-20")}>
          <div className="min-w-0 w-full max-w-full">
          {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export function AppLayout({ 
  children,
}: { 
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isLoginPage = pathname?.startsWith('/login')
  const isSignupPage = pathname?.startsWith('/signup')
  const isResetPasswordPage = pathname?.startsWith('/reset-password')
  // Don't show sidebar on login, signup, or reset password pages
  if (isLoginPage || isSignupPage || isResetPasswordPage) {
    return <>{children}</>
  }

  return (
    <MobileDockProvider>
      <AppLayoutContent>
          {children}
      </AppLayoutContent>
    </MobileDockProvider>
  )
}


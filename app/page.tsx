'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Spinner } from '@/components/ui/shadcn-io/spinner'

function HomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Check if there's a code parameter (from password reset email)
    const code = searchParams.get('code')
    if (code) {
      // Redirect to reset password page with the code
      router.replace(`/reset-password?code=${code}`)
      return
    }

    // If no code, check if user is authenticated
    // If authenticated, redirect to dashboard
    // If not, redirect to login (handled by middleware)
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me')
        if (response.ok) {
          router.replace('/dashboard')
        } else {
          router.replace('/login')
        }
      } catch {
        router.replace('/login')
      }
    }
    checkAuth()
  }, [searchParams, router])

  // Show loading state while redirecting
  return (
    <div className="flex min-h-svh items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <Spinner className="h-6 w-6" />
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex min-h-svh items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <Spinner className="h-6 w-6" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  )
}

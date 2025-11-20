'use client'

import { useLayoutEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/ui/shadcn-io/spinner'

export default function SetupPage() {
  const router = useRouter()
  
  useLayoutEffect(() => {
    // Redirect immediately if user visits /setup without a sub-route
    router.replace('/setup/categories')
  }, [router])
  
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Spinner />
    </div>
  )
}


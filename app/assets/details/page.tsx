'use client'

import { useLayoutEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/ui/shadcn-io/spinner'

export default function AssetsDetailsPage() {
  const router = useRouter()
  
  useLayoutEffect(() => {
    // Redirect immediately if user visits /assets/details without an ID
    router.replace('/assets')
  }, [router])
  
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Spinner />
    </div>
  )
}


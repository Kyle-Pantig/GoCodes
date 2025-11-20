'use client'

import { useLayoutEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/ui/shadcn-io/spinner'

export default function ListsPage() {
  const router = useRouter()
  
  useLayoutEffect(() => {
    // Redirect immediately if user visits /lists without a sub-route
    router.replace('/lists/assets')
  }, [router])
  
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Spinner />
    </div>
  )
}


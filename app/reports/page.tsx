'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/ui/shadcn-io/spinner'

export default function ReportsPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/reports/assets')
  }, [router])
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Spinner />
    </div>
  )
}


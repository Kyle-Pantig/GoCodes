import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default function AccountabilityFormLoading() {
  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="mb-4 md:mb-6">
        <Skeleton className="h-10 w-[300px] mb-2" />
        <Skeleton className="h-5 w-[400px]" />
      </div>

      {/* Employee Selection Card Skeleton */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            <Skeleton className="h-6 w-[200px]" />
          </CardTitle>
          <CardDescription className="text-xs">
            <Skeleton className="h-4 w-[250px] mt-1" />
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2 pb-4">
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>

      {/* Form Details Card Skeleton */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            <Skeleton className="h-6 w-[150px]" />
          </CardTitle>
          <CardDescription className="text-xs">
            <Skeleton className="h-4 w-[200px] mt-1" />
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2 pb-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-[180px]" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Mobile Phone Details Card Skeleton */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            <Skeleton className="h-6 w-[220px]" />
          </CardTitle>
          <CardDescription className="text-xs">
            <Skeleton className="h-4 w-[300px] mt-1" />
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-[150px]" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Asset Selection Card Skeleton */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            <Skeleton className="h-6 w-[200px]" />
          </CardTitle>
          <CardDescription className="text-xs">
            <Skeleton className="h-4 w-[300px] mt-1" />
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2 pb-4 space-y-4">
          <div className="flex gap-2">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-10 w-10" />
          </div>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>

      {/* Replacement Items Card Skeleton */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            <Skeleton className="h-6 w-[200px]" />
          </CardTitle>
          <CardDescription className="text-xs">
            <Skeleton className="h-4 w-[280px] mt-1" />
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2 pb-4">
          <Skeleton className="h-[150px] w-full" />
        </CardContent>
      </Card>

      {/* Form Preview Card Skeleton */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            <Skeleton className="h-6 w-[180px]" />
          </CardTitle>
          <CardDescription className="text-xs">
            <Skeleton className="h-4 w-[250px] mt-1" />
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2 pb-4">
          <Skeleton className="h-[600px] w-full" />
        </CardContent>
      </Card>

      {/* Action Buttons Skeleton */}
      <div className="flex gap-2 justify-end mb-6">
        <Skeleton className="h-10 w-[120px]" />
        <Skeleton className="h-10 w-[150px]" />
      </div>
    </div>
  )
}


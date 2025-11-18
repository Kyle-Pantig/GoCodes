import { Suspense } from "react"
import { LoginForm } from "@/components/login-form"

function LoginFormWrapper() {
  return <LoginForm />
}

export default function LoginPage() {
  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Suspense fallback={
          <div className="flex flex-col gap-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary animate-pulse" />
              <h1 className="text-xl font-bold">Welcome to Asset Dog</h1>
              <p className="text-sm text-muted-foreground">Your comprehensive asset management solution</p>
            </div>
            <div className="h-10 bg-muted animate-pulse rounded-md" />
            <div className="h-10 bg-muted animate-pulse rounded-md" />
            <div className="h-10 bg-muted animate-pulse rounded-md" />
          </div>
        }>
          <LoginFormWrapper />
        </Suspense>
      </div>
    </div>
  )
}

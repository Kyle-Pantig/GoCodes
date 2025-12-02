'use client'

import { Suspense } from "react"
import { motion } from "framer-motion"
import { ResetPasswordForm } from "@/components/forms/reset-password-form"

function ResetPasswordFormWrapper() {
  return <ResetPasswordForm />
}

export default function ResetPasswordPage() {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10"
    >
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="w-full max-w-sm"
      >
        <Suspense fallback={
          <div className="flex flex-col gap-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary animate-pulse" />
              <h1 className="text-xl font-bold">Reset Password</h1>
              <p className="text-sm text-muted-foreground">Please enter your new password</p>
            </div>
            <div className="h-10 bg-muted animate-pulse rounded-md" />
            <div className="h-10 bg-muted animate-pulse rounded-md" />
            <div className="h-10 bg-muted animate-pulse rounded-md" />
          </div>
        }>
          <ResetPasswordFormWrapper />
        </Suspense>
      </motion.div>
    </motion.div>
  )
}


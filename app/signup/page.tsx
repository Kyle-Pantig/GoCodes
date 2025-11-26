'use client'

import { motion } from "framer-motion"
import { SignUpForm } from "@/components/signup-form"

export default function SignUpPage() {
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
        <SignUpForm />
      </motion.div>
    </motion.div>
  )
}


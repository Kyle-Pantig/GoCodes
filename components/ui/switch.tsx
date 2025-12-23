"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

interface SwitchProps extends React.ComponentProps<typeof SwitchPrimitive.Root> {
  loading?: boolean
}

function Switch({
  className,
  loading,
  disabled,
  checked,
  ...props
}: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      disabled={disabled || loading}
      checked={checked}
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 shadow-sm transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=unchecked]:bg-muted-foreground/30 data-[state=unchecked]:border-muted-foreground/50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none flex items-center justify-center h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200"
        style={{
          transform: checked ? 'translateX(16px)' : 'translateX(0px)',
        }}
      >
        {loading && (
          <Loader2 className="h-2.5 w-2.5 animate-spin text-muted-foreground" />
        )}
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  )
}

export { Switch }

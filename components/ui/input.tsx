import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  // Check if it's a date-related input for iOS-specific styling
  const isDateInput = type === 'date' || type === 'datetime-local' || type === 'time'
  
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        // iOS date input fixes - prevent overflow and ensure proper sizing
        isDateInput && "[&::-webkit-date-and-time-value]:text-left [&::-webkit-datetime-edit]:w-full [&::-webkit-datetime-edit-fields-wrapper]:w-full [&::-webkit-calendar-picker-indicator]:opacity-100 max-w-full overflow-hidden text-ellipsis",
        className
      )}
      {...props}
    />
  )
}

export { Input }

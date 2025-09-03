import * as React from "react"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

export interface CheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, onCheckedChange, checked, ...props }, ref) => {
    return (
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only"
          ref={ref}
          checked={checked}
          onChange={(e) => {
            onCheckedChange?.(e.target.checked)
            props.onChange?.(e)
          }}
          {...props}
        />
        <div
          className={cn(
            "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
            checked 
              ? "bg-primary text-primary-foreground border-primary" 
              : "border-input bg-background",
            className
          )}
          onClick={() => onCheckedChange?.(!checked)}
        >
          {checked && (
            <Check className="h-3 w-3 text-current mx-auto" />
          )}
        </div>
      </div>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
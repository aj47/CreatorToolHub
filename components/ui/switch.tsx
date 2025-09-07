import * as React from "react";
import { twMerge } from "tailwind-merge";

export type SwitchProps = React.InputHTMLAttributes<HTMLInputElement> & {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <input
        ref={ref}
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
        {...props}
      />
      <span
        className={twMerge(
          "h-5 w-9 rounded-full bg-muted relative transition-colors peer-checked:bg-primary",
          className
        )}
      >
        <span className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  )
);
Switch.displayName = "Switch";


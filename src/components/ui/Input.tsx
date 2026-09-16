import { forwardRef, type InputHTMLAttributes } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink
          placeholder:text-light focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent
          disabled:opacity-50 ${className}`}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

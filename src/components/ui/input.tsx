import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onFocus, onBlur, onWheel, onChange, value, defaultValue, ...props }, ref) => {
    const isNumber = type === "number";
    const isZeroValue = value === 0 || value === "0";
    const [isFocused, setIsFocused] = React.useState(false);
    const [draftValue, setDraftValue] = React.useState<string | null>(null);

    const displayValue = !isNumber || value === undefined
      ? value
      : isFocused
        ? draftValue ?? (isZeroValue ? "" : String(value))
        : isZeroValue
          ? ""
          : value;

    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-xl border border-input bg-muted/40 px-4 py-3.5 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/50 focus-visible:bg-card disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
          // Esconde as setinhas (spin buttons) dos inputs numéricos para evitar valor "sobreposto"
          isNumber && "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 [&::-webkit-outer-spin-button]:m-0",
          className,
        )}
        ref={ref}
        {...(value !== undefined ? { value: displayValue } : defaultValue !== undefined ? { defaultValue } : {})}
        onFocus={(e) => {
          setIsFocused(true);
          // Em campos numéricos, seleciona tudo ao focar — assim digitar substitui o "0" em vez de concatenar
          if (isNumber) {
            const el = e.currentTarget;
            setDraftValue(el.value === "0" ? "" : el.value);
            // setTimeout garante que funciona em mobile/iOS
            setTimeout(() => {
              try {
                if (el.value === "0") {
                  el.setSelectionRange(0, 0);
                } else {
                  el.select();
                }
              } catch { /* noop */ }
            }, 0);
          }
          onFocus?.(e);
        }}
        onChange={(e) => {
          if (isNumber && value !== undefined) {
            setDraftValue(e.target.value);
          }
          onChange?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          setDraftValue(null);
          onBlur?.(e);
        }}
        onWheel={(e) => {
          // Evita que o scroll do mouse altere acidentalmente o valor numérico
          if (isNumber && document.activeElement === e.currentTarget) {
            e.currentTarget.blur();
          }
          onWheel?.(e);
        }}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
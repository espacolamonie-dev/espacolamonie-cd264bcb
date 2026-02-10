import React, { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface NumericInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  selectOnFocus?: boolean;
  min?: number;
  max?: number;
}

export function NumericInput({
  value,
  onChange,
  placeholder = "Digite o valor",
  className,
  selectOnFocus = false,
  min,
  max,
}: NumericInputProps) {
  const [display, setDisplay] = useState<string>(() =>
    value === 0 ? "" : String(value)
  );
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(true);
    if (selectOnFocus && value !== 0) {
      // Show the value and select all
      setDisplay(String(value));
      setTimeout(() => e.target.select(), 0);
    } else if (value === 0) {
      setDisplay("");
    }
  };

  const handleBlur = () => {
    setFocused(false);
    if (display === "" || display === "-") {
      onChange(0);
      setDisplay("");
    } else {
      const parsed = parseFloat(display);
      const clamped = isNaN(parsed) ? 0 : parsed;
      onChange(clamped);
      setDisplay(clamped === 0 ? "" : String(clamped));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow empty, digits, one dot, and optional leading minus
    if (raw === "" || /^-?\d*\.?\d*$/.test(raw)) {
      setDisplay(raw);
      const parsed = parseFloat(raw);
      if (!isNaN(parsed)) {
        onChange(parsed);
      }
    }
  };

  // Sync external value changes when not focused
  React.useEffect(() => {
    if (!focused) {
      setDisplay(value === 0 ? "" : String(value));
    }
  }, [value, focused]);

  return (
    <Input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={cn("[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none", className)}
    />
  );
}

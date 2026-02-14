import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
}

export function CurrencyInput({ value, onChange, placeholder = "R$ 0,00", className }: CurrencyInputProps) {
  const formatCurrency = (v: number) => {
    if (v === 0) return "";
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const [display, setDisplay] = useState(() => formatCurrency(value));
  const [focused, setFocused] = useState(false);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(true);
    setDisplay(value === 0 ? "" : String(value));
    setTimeout(() => e.target.select(), 0);
  };

  const handleBlur = () => {
    setFocused(false);
    const cleaned = display.replace(/[^\d,.\-]/g, "").replace(",", ".");
    const parsed = parseFloat(cleaned) || 0;
    onChange(parsed);
    setDisplay(formatCurrency(parsed));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === "" || /^-?[\d.,]*$/.test(raw)) {
      setDisplay(raw);
      const parsed = parseFloat(raw.replace(",", "."));
      if (!isNaN(parsed)) onChange(parsed);
    }
  };

  React.useEffect(() => {
    if (!focused) {
      setDisplay(formatCurrency(value));
    }
  }, [value, focused]);

  return (
    <Input
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

export function PercentInput({ value, onChange, placeholder = "30%", className }: CurrencyInputProps) {
  const formatPercent = (v: number) => (v === 0 ? "" : `${v}%`);

  const [display, setDisplay] = useState(() => formatPercent(value));
  const [focused, setFocused] = useState(false);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(true);
    setDisplay(value === 0 ? "" : String(value));
    setTimeout(() => e.target.select(), 0);
  };

  const handleBlur = () => {
    setFocused(false);
    const parsed = parseFloat(display.replace(/[^\d.]/g, "")) || 0;
    const clamped = Math.min(100, Math.max(0, parsed));
    onChange(clamped);
    setDisplay(formatPercent(clamped));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === "" || /^\d*\.?\d*$/.test(raw)) {
      setDisplay(raw);
      const parsed = parseFloat(raw);
      if (!isNaN(parsed)) onChange(Math.min(100, parsed));
    }
  };

  React.useEffect(() => {
    if (!focused) {
      setDisplay(formatPercent(value));
    }
  }, [value, focused]);

  return (
    <Input
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

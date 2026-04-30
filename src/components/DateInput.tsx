import * as React from "react";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/lib/dateUtils";

interface DateInputProps {
  /** Value in ISO format YYYY-MM-DD (or empty string) */
  value: string;
  /** Returns ISO format YYYY-MM-DD (or empty string) */
  onChange: (isoValue: string) => void;
  min?: string; // YYYY-MM-DD
  max?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  onBlur?: () => void;
  hasError?: boolean;
}

function isoToBR(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

function brToIso(br: string): string | null {
  // Expects DD/MM/YYYY
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const day = parseInt(dd, 10);
  const month = parseInt(mm, 10);
  const year = parseInt(yyyy, 10);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (year < 1900 || year > 2100) return null;
  // Validate via Date roundtrip
  const dt = new Date(year, month - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) return null;
  return `${yyyy}-${mm}-${dd}`;
}

function maskBR(input: string): string {
  // Keep only digits, then format as DD/MM/YYYY progressively
  const digits = input.replace(/\D/g, "").slice(0, 8);
  const parts: string[] = [];
  if (digits.length > 0) parts.push(digits.slice(0, 2));
  if (digits.length >= 3) parts.push(digits.slice(2, 4));
  if (digits.length >= 5) parts.push(digits.slice(4, 8));
  return parts.join("/");
}

const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ value, onChange, min, max, className, placeholder = "DD/MM/AAAA", disabled, id, onBlur, hasError }, ref) => {
    const [text, setText] = React.useState<string>(isoToBR(value));
    const [open, setOpen] = React.useState(false);

    // Sync external value changes
    React.useEffect(() => {
      setText(isoToBR(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const masked = maskBR(e.target.value);
      setText(masked);
      const iso = brToIso(masked);
      if (iso) {
        onChange(iso);
      } else if (masked === "") {
        onChange("");
      }
    };

    const handleBlur = () => {
      // If invalid on blur, revert to last valid value
      const iso = brToIso(text);
      if (!iso && text !== "") {
        setText(isoToBR(value));
      }
      onBlur?.();
    };

    const selectedDate = value ? parseLocalDate(value) : undefined;

    return (
      <div className={cn("relative", className)}>
        <Input
          id={id}
          ref={ref}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={text}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={cn("pr-10", hasError && "border-red-500 focus-visible:ring-red-500/20 focus-visible:border-red-500")}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
              aria-label="Abrir calendário"
            >
              <CalendarIcon size={16} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => {
                if (d) {
                  const yyyy = d.getFullYear();
                  const mm = String(d.getMonth() + 1).padStart(2, "0");
                  const dd = String(d.getDate()).padStart(2, "0");
                  const iso = `${yyyy}-${mm}-${dd}`;
                  onChange(iso);
                  setText(isoToBR(iso));
                  setOpen(false);
                }
              }}
              disabled={(date) => {
                if (min) {
                  const minDate = parseLocalDate(min);
                  if (date < minDate) return true;
                }
                if (max) {
                  const maxDate = parseLocalDate(max);
                  if (date > maxDate) return true;
                }
                return false;
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  }
);
DateInput.displayName = "DateInput";

export { DateInput };

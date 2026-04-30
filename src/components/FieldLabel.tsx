import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FieldLabelProps extends React.ComponentPropsWithoutRef<typeof Label> {
  required?: boolean;
  error?: string | null;
}

/**
 * Label padronizado com indicador "*" vermelho para campos obrigatórios
 * e exibição de mensagem de erro inline.
 */
export function FieldLabel({ required, error, className, children, ...rest }: FieldLabelProps) {
  return (
    <Label className={cn("text-xs font-medium text-muted-foreground", className)} {...rest}>
      {children}
      {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
    </Label>
  );
}

export function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p className="text-[11px] text-red-500 mt-1 leading-tight" role="alert">
      {message}
    </p>
  );
}

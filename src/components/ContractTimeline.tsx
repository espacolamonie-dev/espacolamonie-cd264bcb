import { Check, Circle } from "lucide-react";
import type { Contract, Document, Payment } from "@/types";

interface Props {
  contract: Contract;
  docs: Document[];
  payments: Payment[];
}

const STEPS = [
  { key: "created", label: "Criado" },
  { key: "contract_generated", label: "Contrato gerado" },
  { key: "sent", label: "Enviado" },
  { key: "signed", label: "Assinado" },
  { key: "deposit_paid", label: "Sinal pago" },
  { key: "paid_full", label: "Pago total" },
] as const;

function getCompletedSteps(contract: Contract, docs: Document[], payments: Payment[]) {
  const completed = new Set<string>();

  // Always created
  completed.add("created");

  // Contract generated if there's a "contrato" type doc
  if (docs.some((d) => d.type === "contrato")) {
    completed.add("contract_generated");
  }

  // Signed
  if (["signed", "confirmed"].includes(contract.status)) {
    completed.add("signed");
    completed.add("contract_generated");
    completed.add("sent");
  }

  // Awaiting signature means it was sent
  if (contract.status === "awaiting_signature") {
    completed.add("sent");
  }

  // Payment statuses
  if (contract.paymentStatus === "deposit_paid") {
    completed.add("deposit_paid");
  }
  if (contract.paymentStatus === "paid_full") {
    completed.add("deposit_paid");
    completed.add("paid_full");
  }

  return completed;
}

export default function ContractTimeline({ contract, docs, payments }: Props) {
  const completed = getCompletedSteps(contract, docs, payments);
  const isCancelled = contract.status === "cancelled";

  return (
    <div className="flex items-center gap-0 overflow-x-auto py-3">
      {STEPS.map((step, i) => {
        const done = completed.has(step.key);
        const isLast = i === STEPS.length - 1;

        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors ${
                  isCancelled
                    ? "border-muted bg-muted"
                    : done
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                {done ? <Check size={12} /> : <Circle size={8} />}
              </div>
              <span
                className={`text-[9px] font-medium text-center whitespace-nowrap max-w-[60px] leading-tight ${
                  done && !isCancelled ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div
                className={`h-0.5 w-6 mx-0.5 mt-[-14px] ${
                  done && !isCancelled ? "bg-primary" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
} from "@/types";
import type { ContractStatus, PaymentStatus } from "@/types";
import { updateContract } from "@/data/store";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/lib/errorSanitizer";
import { triggerGoogleSync, deleteGoogleEvent } from "@/lib/googleSync";


interface ContractStatusSelectProps {
  contractId: string;
  value: ContractStatus;
  onChanged: () => void;
}

export function ContractStatusSelect({ contractId, value, onChanged }: ContractStatusSelectProps) {
  const [loading, setLoading] = useState(false);

  const handleChange = async (newStatus: string) => {
    if (newStatus === value || loading) return;
    setLoading(true);
    try {
      const updates: Record<string, any> = { status: newStatus };
      if (newStatus === "cancelled") {
        updates.cancelledAt = new Date().toISOString();
        updates.cancelledBy = "user";
      }
      await updateContract(contractId, updates);
      toast.success(`Status alterado para "${CONTRACT_STATUS_LABELS[newStatus as ContractStatus]}"`);
      // When cancelled: delete Google event. Otherwise: sync/update it.
      if (newStatus === "cancelled") {
        deleteGoogleEvent(contractId);
      } else {
        triggerGoogleSync(contractId);
      }
      onChanged();
    } catch (e: any) {
      toast.error(getSafeErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const colorClass = CONTRACT_STATUS_COLORS[value];

  return (
    <Select value={value} onValueChange={handleChange} disabled={loading || value === "cancelled"}>
      <SelectTrigger
        className={`inline-flex h-auto w-auto min-w-0 gap-1 border rounded-full px-2.5 py-0.5 text-[10px] font-medium ${colorClass} focus:ring-0 focus:ring-offset-0 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-60`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(CONTRACT_STATUS_LABELS).map(([k, label]) => (
          <SelectItem key={k} value={k}>
            <span className="flex items-center gap-2">
              <span className={`inline-block h-2 w-2 rounded-full ${CONTRACT_STATUS_COLORS[k as ContractStatus].split(" ")[0].replace("/15", "")}`} />
              {label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface PaymentStatusSelectProps {
  contractId: string;
  value: PaymentStatus;
  isCancelled: boolean;
  onChanged: () => void;
}

export function PaymentStatusSelect({ contractId, value, isCancelled, onChanged }: PaymentStatusSelectProps) {
  const [loading, setLoading] = useState(false);

  if (isCancelled) {
    return <span className="text-[10px] text-muted-foreground">—</span>;
  }

  const handleChange = async (newStatus: string) => {
    if (newStatus === value || loading) return;
    setLoading(true);
    try {
      await updateContract(contractId, { paymentStatus: newStatus });
      toast.success(`Pagamento alterado para "${PAYMENT_STATUS_LABELS[newStatus as PaymentStatus]}"`);
      // Trigger Google Calendar sync asynchronously
      triggerGoogleSync(contractId);
      onChanged();
    } catch (e: any) {
      toast.error(getSafeErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const colorClass = PAYMENT_STATUS_COLORS[value];

  return (
    <Select value={value} onValueChange={handleChange} disabled={loading}>
      <SelectTrigger
        className={`inline-flex h-auto w-auto min-w-0 gap-1 border rounded-full px-2.5 py-0.5 text-[10px] font-medium ${colorClass} focus:ring-0 focus:ring-offset-0 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-60`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(PAYMENT_STATUS_LABELS).map(([k, label]) => (
          <SelectItem key={k} value={k}>
            <span className="flex items-center gap-2">
              <span className={`inline-block h-2 w-2 rounded-full ${PAYMENT_STATUS_COLORS[k as PaymentStatus].split(" ")[0].replace("/15", "")}`} />
              {label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

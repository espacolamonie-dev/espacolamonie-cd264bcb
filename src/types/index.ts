export interface Client {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  email: string;
  address: string;
  addressStreet: string;
  addressNumber: string;
  addressComplement: string;
  addressNeighborhood: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
  notes: string;
  createdAt: string;
  utmSource: string;
}

export function formatFullAddress(c: Pick<Client, 'addressStreet' | 'addressNumber' | 'addressComplement' | 'addressNeighborhood' | 'addressCity' | 'addressState' | 'addressZip'>): string {
  const parts: string[] = [];
  const line1 = [c.addressStreet, c.addressNumber].filter(Boolean).join(", ");
  const line1Full = c.addressComplement ? `${line1} – ${c.addressComplement}` : line1;
  if (line1Full) parts.push(line1Full);
  const line2 = [c.addressNeighborhood, c.addressCity].filter(Boolean).join(" – ");
  const line2Full = c.addressState ? `${line2} / ${c.addressState}` : line2;
  if (line2Full) parts.push(line2Full);
  if (c.addressZip) parts.push(`CEP: ${c.addressZip}`);
  return parts.join("\n");
}

export type ContractStatus =
  | "awaiting_documents"
  | "awaiting_signature"
  | "signed"
  | "confirmed"
  | "cancelled"
  | "expired";

export type PaymentStatus = "pending" | "deposit_paid" | "paid_full";

export type EventType =
  | "Aniversário 15 anos"
  | "Aniversário Adulto"
  | "Aniversário Infantil"
  | "Casamento"
  | "Chá de bebê"
  | "Chá de fraldas"
  | "Chá de panela"
  | "Chá de revelação"
  | "Confraternização"
  | "Evento Corporativo"
  | "Recepção de casamento";

export type RentalType = "Locação (1 dia)" | "Locação (2 dias)";

export interface Contract {
  id: string;
  clientId: string;
  visitId?: string | null;
  eventType: EventType;
  eventDate: string;
  eventDateEnd?: string;
  rentalType: RentalType;
  eventTime: string;
  guestCount: number;
  totalValue: number;
  depositPercent: number;
  depositValue: number;
  remainingValue: number;
  status: ContractStatus;
  paymentStatus: PaymentStatus;
  source?: string;
  createdAt: string;
  cancelledAt?: string;
  cancelledBy?: string;
  utmSource?: string;
  utmCampaign?: string;
  utmMedium?: string;
  utmContent?: string;
  utmTerm?: string;
  fbclid?: string;
  metaCampaignId?: string;
  metaAdsetId?: string;
  metaAdId?: string;
  paymentChoice?: string;
  paymentMethodSelected?: string;
  paymentDueDate?: string;
  paymentFollowupRequired?: boolean;
  reservedUntil?: string;
}

export interface Payment {
  id: string;
  contractId: string;
  amount: number;
  date: string;
  description: string;
  createdAt: string;
}

export interface Document {
  id: string;
  contractId: string;
  name: string;
  type: "identidade" | "cnh" | "contrato" | "recibo" | "comprovante_residencia" | "outro";
  fileName: string;
  createdAt: string;
}

export type ExpenseCategory =
  | "Luz"
  | "Água"
  | "Funcionários"
  | "Manutenção"
  | "Compras"
  | "Marketing"
  | "Outros";

export interface Expense {
  id: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  createdAt: string;
}

export type ManualEntryCategory =
  | "Aluguel extra"
  | "Taxa adicional"
  | "Serviço avulso"
  | "Outro";

export type PaymentMethod = "Pix" | "Dinheiro" | "Cartão" | "Transferência";

export interface ManualEntry {
  id: string;
  description: string;
  category: ManualEntryCategory;
  amount: number;
  date: string;
  paymentMethod: PaymentMethod;
  notes: string;
  createdAt: string;
}

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  awaiting_documents: "Aguardando Documentos",
  awaiting_signature: "Aguardando Assinatura",
  signed: "Assinado",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
  expired: "Expirado",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Pendente",
  deposit_paid: "Sinal Pago",
  paid_full: "Pago Total",
};

export const CONTRACT_STATUS_COLORS: Record<ContractStatus, string> = {
  awaiting_documents: "bg-warning/15 text-warning border-warning/30",
  awaiting_signature: "bg-warning/15 text-warning border-warning/30",
  signed: "bg-primary/15 text-primary border-primary/30",
  confirmed: "bg-success/15 text-success border-success/30",
  cancelled: "bg-danger/15 text-danger border-danger/30",
  expired: "bg-muted text-muted-foreground border-muted-foreground/30",
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  pending: "bg-danger/15 text-danger border-danger/30",
  deposit_paid: "bg-warning/15 text-warning border-warning/30",
  paid_full: "bg-success/15 text-success border-success/30",
};

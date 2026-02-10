export interface Client {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  createdAt: string;
}

export type ContractStatus =
  | "awaiting_documents"
  | "awaiting_signature"
  | "signed"
  | "confirmed"
  | "cancelled";

export type PaymentStatus = "pending" | "deposit_paid" | "paid_full";

export type EventType =
  | "Aniversário Infantil"
  | "Casamento"
  | "Debutante"
  | "Formatura"
  | "Confraternização"
  | "Chá de Bebê"
  | "Outro";

export interface Contract {
  id: string;
  clientId: string;
  eventType: EventType;
  eventDate: string;
  eventTime: string;
  guestCount: number;
  totalValue: number;
  depositPercent: number;
  depositValue: number;
  remainingValue: number;
  status: ContractStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  cancelledAt?: string;
  cancelledBy?: string;
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
  type: "rg" | "cpf" | "contract" | "receipt" | "other";
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

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  awaiting_documents: "Aguardando Documentos",
  awaiting_signature: "Aguardando Assinatura",
  signed: "Assinado",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
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
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  pending: "bg-danger/15 text-danger border-danger/30",
  deposit_paid: "bg-warning/15 text-warning border-warning/30",
  paid_full: "bg-success/15 text-success border-success/30",
};

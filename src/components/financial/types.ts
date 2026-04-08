import type { Payment, Expense, ManualEntry, Contract, Client } from "@/types";

export type FinancialTransaction = {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  type: "entrada" | "saida";
  source: "payment" | "manual_entry" | "expense";
};

export interface FinancialData {
  payments: Payment[];
  manualEntries: ManualEntry[];
  expenses: Expense[];
  contracts: Contract[];
  clients: Client[];
  activeContracts: Contract[];
  activePayments: Payment[];
  recebidoNoMes: number;
  despesasDoMes: number;
  lucroDoMes: number;
  empTotalDue: number;
  empTotalPaid: number;
  monthStart: Date;
  monthEnd: Date;
  year: number;
  month: number;
  selectedMonth: string;
  monthLabel: string;
  allEntradas: FinancialTransaction[];
  allSaidas: FinancialTransaction[];
  extrato: FinancialTransaction[];
  monthContracts: Contract[];
  nextMonthContracts: Contract[];
  aReceberMesAtual: number;
  aReceberProximoMes: number;
  contractClientMap: Record<string, string>;
}

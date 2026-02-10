import { Client, Contract, Payment, Document, Expense, ManualEntry } from "@/types";

const get = <T>(key: string): T[] => {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
};

const set = <T>(key: string, data: T[]) => {
  localStorage.setItem(key, JSON.stringify(data));
};

const genId = () => crypto.randomUUID();

// CLIENTS
export const getClients = () => get<Client>("lm_clients");
export const saveClients = (c: Client[]) => set("lm_clients", c);
export const addClient = (c: Omit<Client, "id" | "createdAt">): Client => {
  const clients = getClients();
  const newClient: Client = { ...c, id: genId(), createdAt: new Date().toISOString() };
  clients.push(newClient);
  saveClients(clients);
  return newClient;
};
export const updateClient = (id: string, data: Partial<Client>) => {
  const clients = getClients().map((c) => (c.id === id ? { ...c, ...data } : c));
  saveClients(clients);
};
export const deleteClient = (id: string) => {
  saveClients(getClients().filter((c) => c.id !== id));
};

// CONTRACTS
export const getContracts = () => get<Contract>("lm_contracts");
export const saveContracts = (c: Contract[]) => set("lm_contracts", c);
export const addContract = (c: Omit<Contract, "id" | "createdAt" | "depositValue" | "remainingValue">): Contract => {
  const contracts = getContracts();
  const depositValue = (c.totalValue * c.depositPercent) / 100;
  const newContract: Contract = {
    ...c,
    id: genId(),
    depositValue,
    remainingValue: c.totalValue,
    createdAt: new Date().toISOString(),
  };
  contracts.push(newContract);
  saveContracts(contracts);
  return newContract;
};
export const updateContract = (id: string, data: Partial<Contract>) => {
  const contracts = getContracts().map((c) => (c.id === id ? { ...c, ...data } : c));
  saveContracts(contracts);
};

// PAYMENTS
export const getPayments = () => get<Payment>("lm_payments");
export const savePayments = (p: Payment[]) => set("lm_payments", p);
export const addPayment = (p: Omit<Payment, "id" | "createdAt">): Payment => {
  const payments = getPayments();
  const newPayment: Payment = { ...p, id: genId(), createdAt: new Date().toISOString() };
  payments.push(newPayment);
  savePayments(payments);

  // Update contract remaining value and payment status
  const contracts = getContracts();
  const contract = contracts.find((c) => c.id === p.contractId);
  if (contract) {
    const totalPaid = payments
      .filter((pay) => pay.contractId === p.contractId)
      .reduce((sum, pay) => sum + pay.amount, 0) + p.amount;
    const remaining = Math.max(0, contract.totalValue - totalPaid);
    let paymentStatus: Contract["paymentStatus"] = "pending";
    if (remaining <= 0) paymentStatus = "paid_full";
    else if (totalPaid > 0) paymentStatus = "deposit_paid";
    updateContract(contract.id, { remainingValue: remaining, paymentStatus });
  }

  return newPayment;
};

// DOCUMENTS
export const getDocuments = () => get<Document>("lm_documents");
export const saveDocuments = (d: Document[]) => set("lm_documents", d);
export const addDocument = (d: Omit<Document, "id" | "createdAt">): Document => {
  const docs = getDocuments();
  const newDoc: Document = { ...d, id: genId(), createdAt: new Date().toISOString() };
  docs.push(newDoc);
  saveDocuments(docs);
  return newDoc;
};

// EXPENSES
export const getExpenses = () => get<Expense>("lm_expenses");
export const saveExpenses = (e: Expense[]) => set("lm_expenses", e);
export const addExpense = (e: Omit<Expense, "id" | "createdAt">): Expense => {
  const expenses = getExpenses();
  const newExpense: Expense = { ...e, id: genId(), createdAt: new Date().toISOString() };
  expenses.push(newExpense);
  saveExpenses(expenses);
  return newExpense;
};
export const deleteExpense = (id: string) => {
  saveExpenses(getExpenses().filter((e) => e.id !== id));
};

// MANUAL ENTRIES
export const getManualEntries = () => get<ManualEntry>("lm_manual_entries");
export const saveManualEntries = (e: ManualEntry[]) => set("lm_manual_entries", e);
export const addManualEntry = (e: Omit<ManualEntry, "id" | "createdAt">): ManualEntry => {
  const entries = getManualEntries();
  const newEntry: ManualEntry = { ...e, id: genId(), createdAt: new Date().toISOString() };
  entries.push(newEntry);
  saveManualEntries(entries);
  return newEntry;
};
export const deleteManualEntry = (id: string) => {
  saveManualEntries(getManualEntries().filter((e) => e.id !== id));
};

// FINANCIAL HELPERS
export const getTotalEntries = (): number => {
  const payments = getPayments().reduce((sum, p) => sum + p.amount, 0);
  const manual = getManualEntries().reduce((sum, e) => sum + e.amount, 0);
  return payments + manual;
};
export const getTotalExpenses = (): number => {
  return getExpenses().reduce((sum, e) => sum + e.amount, 0);
};
export const getBalance = (): number => {
  return getTotalEntries() - getTotalExpenses();
};

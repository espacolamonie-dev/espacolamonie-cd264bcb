import { useEffect, useState } from "react";
import { Plus, Search, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { getClients, addClient, updateClient, deleteClient } from "@/data/store";
import { formatFullAddress } from "@/types";
import type { Client } from "@/types";

const emptyForm = {
  name: "", cpf: "", phone: "",
  addressStreet: "", addressNumber: "", addressComplement: "",
  addressNeighborhood: "", addressCity: "", addressState: "", addressZip: "",
  notes: "",
};

function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCEP(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loadingCep, setLoadingCep] = useState(false);

  const load = async () => {
    try { setClients(await getClients()); } catch {}
  };
  useEffect(() => { load(); }, []);

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.cpf.includes(search) ||
      c.phone.includes(search)
  );

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (c: Client) => {
    setEditing(c);
    setForm({
      name: c.name, cpf: c.cpf, phone: c.phone,
      addressStreet: c.addressStreet, addressNumber: c.addressNumber,
      addressComplement: c.addressComplement, addressNeighborhood: c.addressNeighborhood,
      addressCity: c.addressCity, addressState: c.addressState, addressZip: c.addressZip,
      notes: c.notes,
    });
    setOpen(true);
  };

  const handleCepLookup = async (cepValue: string) => {
    const digits = cepValue.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setLoadingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data.erro) { toast.error("CEP não encontrado"); return; }
      setForm((p) => ({
        ...p,
        addressStreet: data.logradouro || "",
        addressNeighborhood: data.bairro || "",
        addressCity: data.localidade || "",
        addressState: data.uf || "",
        addressZip: data.cep || p.addressZip,
      }));
      toast.success("Endereço preenchido automaticamente!");
    } catch { toast.error("Erro ao buscar CEP"); }
    finally { setLoadingCep(false); }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Preencha o nome do cliente"); return; }
    const cpfDigits = form.cpf.replace(/\D/g, "");
    if (cpfDigits.length > 0 && cpfDigits.length !== 11) { toast.error("CPF deve ter 11 dígitos"); return; }
    const phoneDigits = form.phone.replace(/\D/g, "");
    if (phoneDigits.length > 0 && phoneDigits.length < 10) { toast.error("Telefone deve ter pelo menos 10 dígitos"); return; }

    const fullAddress = formatFullAddress({
      addressStreet: form.addressStreet, addressNumber: form.addressNumber,
      addressComplement: form.addressComplement, addressNeighborhood: form.addressNeighborhood,
      addressCity: form.addressCity, addressState: form.addressState, addressZip: form.addressZip,
    }).replace(/\n/g, ", ");

    try {
      const payload = {
        name: form.name, cpf: form.cpf, phone: form.phone, email: "",
        address: fullAddress, notes: form.notes,
        address_street: form.addressStreet, address_number: form.addressNumber,
        address_complement: form.addressComplement, address_neighborhood: form.addressNeighborhood,
        address_city: form.addressCity, address_state: form.addressState, address_zip: form.addressZip,
      };
      if (editing) { await updateClient(editing.id, payload); toast.success("Informações salvas com sucesso"); }
      else { await addClient(payload as any); toast.success("Cliente cadastrado com sucesso"); }
      setOpen(false); await load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    try { await deleteClient(id); toast.success("Cliente removido"); await load(); }
    catch (e: any) { toast.error(e.message); }
  };

  const set = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const getDisplayAddress = (c: Client) => {
    if (c.addressStreet) {
      return formatFullAddress(c).replace(/\n/g, ", ");
    }
    return c.address || "—";
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">{clients.length} clientes cadastrados</p>
        </div>
        <Button onClick={openNew} size="sm" className="gap-2 h-9">
          <Plus size={15} /> Novo cliente
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar por nome, CPF ou telefone" className="pl-9 h-9 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="rounded-lg border border-border/60 bg-card overflow-x-auto">
        <table className="table-premium">
          <thead>
            <tr>
              <th>Nome</th>
              <th className="hidden sm:table-cell">CPF</th>
              <th className="hidden md:table-cell">Telefone</th>
              <th className="hidden lg:table-cell">Endereço</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="!py-10 text-center text-muted-foreground">Nenhum registro encontrado</td></tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.name}</td>
                  <td className="hidden sm:table-cell text-muted-foreground">{c.cpf || "—"}</td>
                  <td className="hidden md:table-cell text-muted-foreground">{c.phone || "—"}</td>
                  <td className="hidden lg:table-cell text-muted-foreground max-w-[250px] truncate">{getDisplayAddress(c)}</td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                        <Pencil size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(c.id)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Nome completo *</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">CPF</Label>
                <Input value={form.cpf} onChange={(e) => set("cpf", formatCPF(e.target.value))} placeholder="000.000.000-00" maxLength={14} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Telefone</Label>
                <Input value={form.phone} onChange={(e) => set("phone", formatPhone(e.target.value))} placeholder="(00) 00000-0000" maxLength={15} />
              </div>
            </div>

            {/* Address section */}
            <div className="space-y-3 rounded-md border border-border/60 bg-muted/10 p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Endereço</p>

              <div className="grid grid-cols-[140px_1fr] gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">CEP</Label>
                  <div className="flex gap-1.5 items-center">
                    <Input
                      value={form.addressZip}
                      onChange={(e) => {
                        const formatted = formatCEP(e.target.value);
                        set("addressZip", formatted);
                        if (formatted.replace(/\D/g, "").length === 8) handleCepLookup(formatted);
                      }}
                      placeholder="00000-000"
                      maxLength={9}
                    />
                    {loadingCep && <Loader2 size={14} className="animate-spin text-muted-foreground shrink-0" />}
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Logradouro</Label>
                  <Input value={form.addressStreet} onChange={(e) => set("addressStreet", e.target.value)} placeholder="Rua, Avenida..." />
                </div>
              </div>

              <div className="grid grid-cols-[100px_1fr] gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Número</Label>
                  <Input value={form.addressNumber} onChange={(e) => set("addressNumber", e.target.value)} placeholder="Nº" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Complemento</Label>
                  <Input value={form.addressComplement} onChange={(e) => set("addressComplement", e.target.value)} placeholder="Apto, bloco... (opcional)" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Bairro</Label>
                  <Input value={form.addressNeighborhood} onChange={(e) => set("addressNeighborhood", e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Cidade</Label>
                  <Input value={form.addressCity} onChange={(e) => set("addressCity", e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Estado</Label>
                  <Input value={form.addressState} onChange={(e) => set("addressState", e.target.value)} placeholder="UF" maxLength={2} />
                </div>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Observações</Label>
              <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} />
            </div>
            <Button onClick={handleSave} className="mt-2">{editing ? "Salvar alterações" : "Cadastrar cliente"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

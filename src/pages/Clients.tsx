import { useEffect, useState } from "react";
import { Plus, Search, Pencil, Trash2, Loader2, Phone, Users, Megaphone } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/lib/errorSanitizer";
import { getClients, addClient, updateClient, deleteClient, getContractsByClient } from "@/data/store";
import { formatFullAddress } from "@/types";
import type { Client } from "@/types";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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
  const isMobile = useIsMobile();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loadingCep, setLoadingCep] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);

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
      toast.success("Endereço preenchido automaticamente");
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
      if (editing) { await updateClient(editing.id, payload); toast.success("Cliente salvo com sucesso"); }
      else { await addClient(payload as any); toast.success("Cliente cadastrado com sucesso"); }
      setOpen(false); await load();
    } catch (e: any) { toast.error(getSafeErrorMessage(e)); }
  };

  const handleDeleteRequest = async (c: Client) => {
    try {
      const contracts = await getContractsByClient(c.id);
      if (contracts.length > 0) {
        toast.error(`Este cliente possui ${contracts.length} contrato(s). Exclua os contratos primeiro.`);
        return;
      }
      setDeleteTarget(c);
    } catch (e: any) { toast.error(getSafeErrorMessage(e)); }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try { await deleteClient(deleteTarget.id); toast.success("Cliente removido"); setDeleteTarget(null); await load(); }
    catch (e: any) { toast.error(getSafeErrorMessage(e)); }
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
          {!isMobile && (
            <>
              <h1 className="text-3xl font-display font-semibold tracking-tight">Clientes</h1>
              <p className="text-sm text-muted-foreground mt-1">{clients.length} cliente{clients.length !== 1 ? "s" : ""} cadastrado{clients.length !== 1 ? "s" : ""}</p>
            </>
          )}
        </div>
        {!isMobile && (
          <Button onClick={openNew} size="sm" className="gap-2 h-9 rounded-lg">
            <Plus size={15} /> Novo cliente
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar por nome, CPF ou telefone" className="pl-9 h-9 text-sm rounded-lg" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isMobile ? (
        <div className="space-y-3 stagger-fade-in">
          {filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-16 text-sm">
              <Users size={40} className="mx-auto mb-3 text-muted-foreground/30" />
              <p>Nenhum cliente encontrado</p>
            </div>
          ) : (
            filtered.map((c) => (
              <div key={c.id} className="rounded-2xl border bg-card shadow-sm overflow-hidden transition-all duration-200">
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                     <div className="flex-1 min-w-0">
                       <p className="font-display font-semibold text-base truncate">{c.name}</p>
                       {c.cpf && <p className="text-xs text-muted-foreground tabular-nums mt-0.5">CPF: {c.cpf}</p>}
                     </div>
                     {c.utmSource && (
                       <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.utmSource === "Tráfego Pago" ? "bg-primary/15 text-primary" : "bg-success/15 text-success"}`}>
                         <Megaphone size={10} /> {c.utmSource}
                       </span>
                     )}
                   </div>
                   {c.phone && (
                     <a href={`tel:${c.phone.replace(/\D/g, "")}`} className="text-sm text-primary flex items-center gap-1.5 mb-2">
                       <Phone size={14} /> {c.phone}
                     </a>
                   )}
                   {(c.addressStreet || c.address) && (
                     <p className="text-xs text-muted-foreground line-clamp-1">{getDisplayAddress(c)}</p>
                   )}
                </div>
                <div className="flex border-t border-border">
                  <button
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
                    onClick={() => openEdit(c)}
                  >
                    <Pencil size={15} /> Editar
                  </button>
                  <button
                    className="flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors border-l border-border"
                    onClick={() => handleDeleteRequest(c)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="table-premium">
            <thead>
              <tr>
                <th>Nome</th>
                <th className="hidden sm:table-cell">CPF</th>
                <th className="hidden md:table-cell">Telefone</th>
                <th className="hidden lg:table-cell">Origem</th>
                <th className="hidden xl:table-cell">Endereço</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="!py-12 text-center text-muted-foreground">Nenhum cliente encontrado</td></tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium">{c.name}</td>
                    <td className="hidden sm:table-cell text-muted-foreground tabular-nums">{c.cpf || "—"}</td>
                    <td className="hidden md:table-cell text-muted-foreground">{c.phone || "—"}</td>
                    <td className="hidden lg:table-cell">
                      {c.utmSource ? (
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${c.utmSource === "Tráfego Pago" ? "bg-primary/15 text-primary" : "bg-success/15 text-success"}`}>
                          {c.utmSource}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">Não definido</span>
                      )}
                    </td>
                    <td className="hidden xl:table-cell text-muted-foreground max-w-[250px] truncate">{getDisplayAddress(c)}</td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => openEdit(c)}>
                          <Pencil size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:text-destructive" onClick={() => handleDeleteRequest(c)}>
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
      )}

      {/* Mobile FAB */}
      {isMobile && (
        <button
          onClick={openNew}
          className="fixed z-40 bottom-[calc(var(--safe-bottom)+var(--mobile-bottom-h)+16px)] right-4 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        >
          <Plus size={28} strokeWidth={2.5} />
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent hideClose={isMobile} className={isMobile ? "max-w-[100vw] w-full h-[100dvh] max-h-[100dvh] rounded-none border-0 flex flex-col p-0" : "max-w-lg max-h-[90vh] overflow-y-auto"}>
          {isMobile && (
            <div className="shrink-0 flex items-center justify-between border-b border-border px-4" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)", paddingBottom: "12px" }}>
              <div>
                <h2 className="text-lg font-display font-semibold">{editing ? "Editar cliente" : "Novo cliente"}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{editing ? "Atualize as informações" : "Preencha os dados"}</p>
              </div>
              <button onClick={() => setOpen(false)} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-muted" aria-label="Fechar">
                <Plus size={20} className="rotate-45" />
              </button>
            </div>
          )}
          {!isMobile && (
            <DialogHeader>
              <DialogTitle className="font-display text-xl">{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">{editing ? "Atualize as informações do cliente" : "Preencha os dados para cadastrar um novo cliente"}</p>
            </DialogHeader>
          )}
          <div className={isMobile ? "flex-1 overflow-y-auto px-4 py-5" : ""}>
          <div className="grid gap-5 py-3">
            {/* Personal info */}
            <div className="space-y-4">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Dados pessoais</p>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Nome completo *</Label>
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} className="rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">CPF</Label>
                  <Input value={form.cpf} onChange={(e) => set("cpf", formatCPF(e.target.value))} placeholder="000.000.000-00" maxLength={14} className="rounded-lg tabular-nums" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Telefone</Label>
                  <Input value={form.phone} onChange={(e) => set("phone", formatPhone(e.target.value))} placeholder="(00) 00000-0000" maxLength={15} className="rounded-lg tabular-nums" />
                </div>
              </div>
            </div>

            {/* Address section */}
            <div className="space-y-4 rounded-xl border border-border bg-secondary/30 p-4">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Endereço</p>

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
                      className="rounded-lg tabular-nums"
                    />
                    {loadingCep && <Loader2 size={14} className="animate-spin text-muted-foreground shrink-0" />}
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Logradouro</Label>
                  <Input value={form.addressStreet} onChange={(e) => set("addressStreet", e.target.value)} placeholder="Rua, Avenida..." className="rounded-lg" />
                </div>
              </div>

              <div className="grid grid-cols-[100px_1fr] gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Número</Label>
                  <Input value={form.addressNumber} onChange={(e) => set("addressNumber", e.target.value)} placeholder="Nº" className="rounded-lg" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Complemento</Label>
                  <Input value={form.addressComplement} onChange={(e) => set("addressComplement", e.target.value)} placeholder="Apto, bloco... (opcional)" className="rounded-lg" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Bairro</Label>
                  <Input value={form.addressNeighborhood} onChange={(e) => set("addressNeighborhood", e.target.value)} className="rounded-lg" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Cidade</Label>
                  <Input value={form.addressCity} onChange={(e) => set("addressCity", e.target.value)} className="rounded-lg" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Estado</Label>
                  <Input value={form.addressState} onChange={(e) => set("addressState", e.target.value)} placeholder="UF" maxLength={2} className="rounded-lg" />
                </div>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Observações</Label>
              <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} className="rounded-lg" placeholder="Informações adicionais sobre o cliente (opcional)" />
            </div>
            {isMobile ? null : <Button onClick={handleSave} className="mt-1 rounded-lg h-10">{editing ? "Salvar cliente" : "Cadastrar cliente"}</Button>}
          </div>
          </div>
          {isMobile && (
            <div className="shrink-0 flex flex-col gap-2 px-4 pt-3 border-t border-border bg-background" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}>
              <Button onClick={handleSave} className="h-12 w-full font-semibold rounded-lg">{editing ? "Salvar cliente" : "Cadastrar cliente"}</Button>
              <Button variant="outline" className="h-12 w-full rounded-lg" onClick={() => setOpen(false)}>Cancelar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Excluir cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>? Esta ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDeleteConfirm}>
              Excluir cliente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

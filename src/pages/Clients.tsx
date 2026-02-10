import { useEffect, useState } from "react";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { getClients, addClient, updateClient, deleteClient } from "@/data/store";
import type { Client } from "@/types";

const emptyForm = { name: "", cpf: "", phone: "", email: "", address: "", notes: "" };

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = () => setClients(getClients());
  useEffect(load, []);

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.cpf.includes(search) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (c: Client) => {
    setEditing(c);
    setForm({ name: c.name, cpf: c.cpf, phone: c.phone, email: c.email, address: c.address, notes: c.notes });
    setOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error("Preencha o nome do cliente"); return; }
    if (editing) { updateClient(editing.id, form); toast.success("Informações salvas com sucesso"); }
    else { addClient(form); toast.success("Cliente cadastrado com sucesso"); }
    setOpen(false); load();
  };

  const handleDelete = (id: string) => { deleteClient(id); toast.success("Cliente removido"); load(); };
  const set = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

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
        <Input placeholder="Buscar por nome, e-mail ou CPF" className="pl-9 h-9 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="rounded-lg border border-border/60 bg-card overflow-x-auto">
        <table className="table-premium">
          <thead>
            <tr>
              <th>Nome</th>
              <th className="hidden sm:table-cell">CPF</th>
              <th className="hidden md:table-cell">Telefone</th>
              <th className="hidden lg:table-cell">E-mail</th>
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
                  <td className="hidden lg:table-cell text-muted-foreground">{c.email || "—"}</td>
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
        <DialogContent className="max-w-lg">
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
                <Input value={form.cpf} onChange={(e) => set("cpf", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Telefone</Label>
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">E-mail</Label>
              <Input value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Endereço</Label>
              <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
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

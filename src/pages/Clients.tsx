import { useEffect, useState } from "react";
import { Plus, Search, Pencil, Trash2, X } from "lucide-react";
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

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (c: Client) => {
    setEditing(c);
    setForm({ name: c.name, cpf: c.cpf, phone: c.phone, email: c.email, address: c.address, notes: c.notes });
    setOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (editing) {
      updateClient(editing.id, form);
      toast.success("Cliente atualizado!");
    } else {
      addClient(form);
      toast.success("Cliente cadastrado!");
    }
    setOpen(false);
    load();
  };

  const handleDelete = (id: string) => {
    deleteClient(id);
    toast.success("Cliente excluído");
    load();
  };

  const set = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display">Clientes</h1>
          <p className="text-sm text-muted-foreground">{clients.length} clientes cadastrados</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus size={16} /> Novo Cliente
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, CPF ou e-mail..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nome</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">CPF</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Telefone</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">E-mail</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum cliente encontrado
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">{c.cpf || "—"}</td>
                  <td className="px-4 py-3 hidden md:table-cell">{c.phone || "—"}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">{c.email || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Pencil size={15} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                        <Trash2 size={15} className="text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Nome completo *</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>CPF</Label>
                <Input value={form.cpf} onChange={(e) => set("cpf", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>E-mail</Label>
              <Input value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Endereço</Label>
              <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} />
            </div>
            <Button onClick={handleSave} className="mt-2">
              {editing ? "Salvar Alterações" : "Cadastrar Cliente"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

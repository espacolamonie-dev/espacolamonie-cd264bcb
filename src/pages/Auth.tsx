import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";
import { Lock, Mail } from "lucide-react";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[520px] flex-col items-center justify-center sidebar-gradient relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-white/[0.04]" />
        <div className="absolute -bottom-40 -right-20 w-96 h-96 rounded-full bg-white/[0.03]" />
        <div className="absolute top-1/4 right-10 w-48 h-48 rounded-full bg-white/[0.02]" />

        <div className="relative z-10 flex flex-col items-center text-center px-12">
          <img
            src={logo}
            alt="Espaço Lamoniê"
            className="h-28 w-28 rounded-full object-cover ring-4 ring-white/10 shadow-2xl mb-8"
          />
          <h1 className="text-3xl font-display font-bold text-white tracking-tight">
            Espaço Lamoniê
          </h1>
          <p className="mt-3 text-white/50 text-sm leading-relaxed max-w-[280px]" style={{ fontFamily: "var(--font-body)" }}>
            Gestão inteligente do seu espaço de eventos
          </p>
          <div className="mt-10 flex items-center gap-3">
            <div className="h-px w-12 bg-white/15" />
            <span className="text-[10px] text-white/25 uppercase tracking-[0.2em]" style={{ fontFamily: "var(--font-body)" }}>
              CRM Profissional
            </span>
            <div className="h-px w-12 bg-white/15" />
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="flex flex-col items-center mb-10 lg:hidden">
            <img
              src={logo}
              alt="Espaço Lamoniê"
              className="h-16 w-16 rounded-full object-cover ring-2 ring-border mb-4"
            />
            <h1 className="text-xl font-display font-bold tracking-tight">Espaço Lamoniê</h1>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-display font-bold tracking-tight">Bem-vindo de volta</h2>
            <p className="text-muted-foreground text-sm mt-1.5" style={{ fontFamily: "var(--font-body)" }}>
              Entre na sua conta para continuar
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                E-mail
              </Label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-11 h-12 text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Senha
              </Label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-11 h-12 text-sm"
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full h-12 text-sm font-semibold rounded-xl mt-2"
              disabled={loading}
            >
              {loading ? "Aguarde..." : "Entrar"}
            </Button>
          </form>

          <p className="text-center text-[11px] text-muted-foreground/40 mt-10" style={{ fontFamily: "var(--font-body)" }}>
            Espaço Lamoniê © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}

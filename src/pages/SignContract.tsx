import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle, FileText, Loader2, AlertTriangle, ShieldCheck } from "lucide-react";

const fmt = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR");
}

interface SignatureData {
  id: string;
  contract_id: string;
  token: string;
  client_name: string;
  client_cpf: string;
  client_phone: string;
  event_date: string;
  event_type: string;
  total_value: number;
  deposit_percent: number;
  status: string;
  signed_at: string | null;
}

export default function SignContract() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [data, setData] = useState<SignatureData | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [error, setError] = useState("");

  const FUNC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sign-contract`;

  useEffect(() => {
    if (!token) { setError("Link inválido"); setLoading(false); return; }
    fetch(`${FUNC_URL}?token=${token}`, {
      headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); }
        else {
          setData(d);
          if (d.status === "signed") setSigned(true);
        }
      })
      .catch(() => setError("Erro ao carregar contrato"))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSign = async () => {
    if (!token) return;
    setSigning(true);
    try {
      const res = await fetch(FUNC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ token }),
      });
      const result = await res.json();
      if (result.error) { setError(result.error); }
      else { setSigned(true); }
    } catch { setError("Erro ao assinar contrato"); }
    finally { setSigning(false); }
  };

  const depositValue = data ? (Number(data.total_value) * Number(data.deposit_percent)) / 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <img src="/images/logo-lamonie.png" alt="Espaço Lamoniê" className="h-16 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-800">Assinatura de Contrato</h1>
          <p className="text-sm text-gray-500">Espaço Lamoniê</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
            </div>
          )}

          {error && !data && !loading && (
            <div className="p-8 text-center">
              <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-3" />
              <p className="text-red-600 font-medium">{error}</p>
            </div>
          )}

          {signed && (
            <div className="p-8 text-center">
              <div className="bg-green-50 rounded-full h-20 w-20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-10 w-10 text-green-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Contrato Assinado!</h2>
              <p className="text-sm text-gray-500 mb-4">
                Sua assinatura foi registrada com sucesso. O Espaço Lamoniê entrará em contato para confirmar os detalhes do seu evento.
              </p>
              {data && (
                <div className="bg-gray-50 rounded-xl p-4 text-left space-y-1 text-sm">
                  <p><span className="text-gray-500">Evento:</span> <span className="font-medium">{data.event_type}</span></p>
                  <p><span className="text-gray-500">Data:</span> <span className="font-medium">{formatDate(data.event_date)}</span></p>
                </div>
              )}
            </div>
          )}

          {data && !signed && !loading && (
            <div>
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-2 text-amber-700 bg-amber-50 rounded-lg px-3 py-2 text-sm">
                  <FileText size={16} />
                  <span className="font-medium">Contrato de Locação – Espaço Lamoniê</span>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Dados do Contrato</h3>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                    <Row label="Cliente" value={data.client_name} />
                    {data.client_cpf && <Row label="CPF" value={data.client_cpf} />}
                    <Row label="Evento" value={data.event_type} />
                    <Row label="Data" value={formatDate(data.event_date)} />
                    <hr className="border-gray-200" />
                    <Row label="Valor Total" value={fmt(data.total_value)} bold />
                    <Row label={`Sinal (${data.deposit_percent}%)`} value={fmt(depositValue)} />
                    <Row label="Restante" value={fmt(Number(data.total_value) - depositValue)} />
                  </div>
                </div>

                <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700 flex items-start gap-2">
                  <ShieldCheck size={16} className="shrink-0 mt-0.5" />
                  <span>
                    Ao assinar, você declara que leu, compreendeu e aceita todas as 10 cláusulas do contrato de locação do Espaço Lamoniê conforme apresentado.
                  </span>
                </div>
              </div>

              <div className="p-6 pt-0">
                <Button
                  onClick={handleSign}
                  disabled={signing}
                  className="w-full h-12 text-base font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-xl gap-2"
                >
                  {signing ? (
                    <><Loader2 className="h-5 w-5 animate-spin" /> Assinando...</>
                  ) : (
                    <><CheckCircle size={18} /> Assinar Contrato</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Espaço Lamoniê • Rua Cascadura, 380 • Ribeirão das Neves – MG
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={bold ? "font-bold text-gray-800" : "font-medium text-gray-700"}>{value}</span>
    </div>
  );
}

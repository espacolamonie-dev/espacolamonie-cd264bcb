import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { MessageCircle, Users, Calendar, Sparkles, PartyPopper } from "lucide-react";
import { getBudgetByToken, getBudgetItems, Budget, BudgetItem } from "@/data/budgetStore";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string | null) => {
  if (!d) return "—";
  const date = new Date(d + "T12:00:00");
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
};

const LAMONIE_PHONE = "5531997111502";

export default function BudgetPublicView() {
  const { token } = useParams<{ token: string }>();
  const [budget, setBudget] = useState<Budget | null>(null);
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!token) { setNotFound(true); setLoading(false); return; }
      const b = await getBudgetByToken(token);
      if (!b) { setNotFound(true); setLoading(false); return; }
      setBudget(b);
      setItems(await getBudgetItems(b.id));
      setLoading(false);
    };
    load();
  }, [token]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(180deg, #F6F7FB 0%, #EEF0F4 100%)" }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-[#1F4D3A] border-t-transparent animate-spin" />
        <p style={{ fontFamily: "'Poppins', sans-serif", color: "#6B7280", fontSize: "14px" }}>Carregando orçamento...</p>
      </div>
    </div>
  );

  if (notFound || !budget) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(180deg, #F6F7FB 0%, #EEF0F4 100%)" }}>
      <div className="text-center px-6">
        <div className="w-16 h-16 rounded-full bg-[#1F4D3A]/10 flex items-center justify-center mx-auto mb-4">
          <Sparkles size={28} style={{ color: "#1F4D3A" }} />
        </div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "24px", fontWeight: 700, color: "#111827" }}>Orçamento não encontrado</h1>
        <p style={{ fontFamily: "'Poppins', sans-serif", color: "#6B7280", fontSize: "14px", marginTop: "8px" }}>O link pode ter expirado ou estar incorreto.</p>
      </div>
    </div>
  );

  const confirmWhatsApp = () => {
    const eventDateFormatted = fmtDate(budget.eventDate);
    const msg = encodeURIComponent(
      `Olá! Vi o orçamento do Espaço Lamoniê e concordo com o valor apresentado.\n\n` +
      `Nome: ${budget.clientName}\n` +
      `Evento: ${budget.eventType || "—"}\n` +
      `Data: ${eventDateFormatted}\n` +
      `Valor final: ${fmt(budget.finalTotal)}\n\n` +
      `Quero continuar com o atendimento para seguirmos com a reserva.`
    );
    window.open(`https://wa.me/${LAMONIE_PHONE}?text=${msg}`, "_blank");
  };

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #F6F7FB 0%, #EEF0F4 50%, #F6F7FB 100%)" }}>
      {/* Decorative top bar */}
      <div style={{ height: "4px", background: "linear-gradient(90deg, #1F4D3A 0%, #2D7A50 50%, #1F4D3A 100%)" }} />

      <div className="max-w-2xl mx-auto px-5 py-8 sm:py-14">

        {/* Logo & Title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-5" style={{ background: "linear-gradient(135deg, #1F4D3A 0%, #2D7A50 100%)", boxShadow: "0 8px 32px rgba(31, 77, 58, 0.25)" }}>
            <img src="/images/logo-lamonie.png" alt="Lamoniê" className="h-12 w-12 object-contain" style={{ filter: "brightness(10)" }} />
          </div>
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "11px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#1F4D3A", marginBottom: "6px" }}>
            Espaço Lamoniê
          </p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "32px", fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>
            Proposta Comercial
          </h1>
          <div className="flex items-center justify-center gap-2 mt-3">
            <div style={{ width: "40px", height: "1px", background: "#1F4D3A", opacity: 0.3 }} />
            <Sparkles size={14} style={{ color: "#1F4D3A", opacity: 0.5 }} />
            <div style={{ width: "40px", height: "1px", background: "#1F4D3A", opacity: 0.3 }} />
          </div>
        </div>

        {/* Client & Event Info */}
        <div className="rounded-2xl overflow-hidden mb-6" style={{ background: "#FFFFFF", boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}>
          <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F0F0F0" }}>
            <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#9CA3AF", marginBottom: "4px" }}>
              Preparado para
            </p>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "22px", fontWeight: 600, color: "#111827" }}>
              {budget.clientName}
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0" }}>
            <div style={{ padding: "16px 24px", borderRight: "1px solid #F0F0F0" }}>
              <div className="flex items-center gap-1.5 mb-1">
                <PartyPopper size={12} style={{ color: "#1F4D3A" }} />
                <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "9px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9CA3AF" }}>Evento</p>
              </div>
              <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "13px", fontWeight: 600, color: "#111827" }}>{budget.eventType || "—"}</p>
            </div>
            <div style={{ padding: "16px 24px", borderRight: "1px solid #F0F0F0" }}>
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar size={12} style={{ color: "#1F4D3A" }} />
                <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "9px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9CA3AF" }}>Data</p>
              </div>
              <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "13px", fontWeight: 600, color: "#111827" }}>{fmtDate(budget.eventDate)}</p>
            </div>
            <div style={{ padding: "16px 24px" }}>
              <div className="flex items-center gap-1.5 mb-1">
                <Users size={12} style={{ color: "#1F4D3A" }} />
                <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "9px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9CA3AF" }}>Pessoas</p>
              </div>
              <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "13px", fontWeight: 600, color: "#111827" }}>{budget.guestCount}</p>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="rounded-2xl overflow-hidden mb-6" style={{ background: "#FFFFFF", boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}>
          <div style={{ padding: "18px 24px", borderBottom: "1px solid #F0F0F0" }}>
            <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#9CA3AF" }}>
              Itens inclusos
            </p>
          </div>
          <div>
            {items.map((item, idx) => (
              <div
                key={item.id}
                style={{
                  padding: "16px 24px",
                  borderBottom: idx < items.length - 1 ? "1px solid #F8F8F8" : "none",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "14px", fontWeight: 500, color: "#111827" }}>
                    {item.name}
                  </p>
                  <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "12px", color: "#9CA3AF", marginTop: "2px" }}>
                    {item.quantity} {item.unitLabel} × {fmt(item.unitPrice)}
                  </p>
                </div>
                <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "15px", fontWeight: 600, color: "#1F4D3A", marginLeft: "16px", whiteSpace: "nowrap" }}>
                  {fmt(item.finalValue)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Financial Summary */}
        <div className="rounded-2xl overflow-hidden mb-6" style={{ background: "linear-gradient(135deg, #1F4D3A 0%, #2A6B4A 100%)", boxShadow: "0 8px 32px rgba(31, 77, 58, 0.2)" }}>
          <div style={{ padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>Subtotal</p>
              <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "15px", fontWeight: 500, color: "rgba(255,255,255,0.9)" }}>{fmt(budget.subtotal)}</p>
            </div>
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: "16px", marginTop: "4px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "16px", fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>Total Final</p>
              <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "28px", fontWeight: 700, color: "#FFFFFF" }}>{fmt(budget.finalTotal)}</p>
            </div>
          </div>
        </div>

        {/* Notes */}
        {budget.notes && (
          <div className="rounded-2xl overflow-hidden mb-8" style={{ background: "#FFFFFF", boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}>
            <div style={{ padding: "20px 24px" }}>
              <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#9CA3AF", marginBottom: "8px" }}>
                Observações
              </p>
              <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "13px", color: "#6B7280", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                {budget.notes}
              </p>
            </div>
          </div>
        )}

        {/* CTA Button */}
        <div className="text-center mb-10">
          <button
            onClick={confirmWhatsApp}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              width: "100%",
              maxWidth: "420px",
              padding: "18px 32px",
              borderRadius: "16px",
              border: "none",
              cursor: "pointer",
              background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
              color: "#FFFFFF",
              fontFamily: "'Poppins', sans-serif",
              fontSize: "15px",
              fontWeight: 600,
              letterSpacing: "0.02em",
              boxShadow: "0 4px 20px rgba(37, 211, 102, 0.35), 0 2px 8px rgba(0,0,0,0.1)",
              transition: "transform 0.2s, box-shadow 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 30px rgba(37, 211, 102, 0.4), 0 4px 12px rgba(0,0,0,0.12)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(37, 211, 102, 0.35), 0 2px 8px rgba(0,0,0,0.1)"; }}
          >
            <MessageCircle size={20} />
            Concordo com o orçamento e quero continuar
          </button>
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "11px", color: "#9CA3AF", marginTop: "12px" }}>
            Você será direcionado para o WhatsApp do Espaço Lamoniê
          </p>
        </div>

        {/* Footer */}
        <div className="text-center" style={{ paddingBottom: "32px" }}>
          <div className="flex items-center justify-center gap-2 mb-3">
            <div style={{ width: "30px", height: "1px", background: "#D1D5DB" }} />
            <img src="/images/logo-lamonie.png" alt="Lamoniê" className="h-6 w-6 object-contain" style={{ opacity: 0.4 }} />
            <div style={{ width: "30px", height: "1px", background: "#D1D5DB" }} />
          </div>
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "10px", color: "#9CA3AF", letterSpacing: "0.1em" }}>
            Espaço Lamoniê © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}

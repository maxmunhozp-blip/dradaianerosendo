import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { ShieldCheck, Lock, Clock, AlertCircle, CheckCircle, ChevronLeft, Minus, Plus, MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Toaster as Sonner } from "@/components/ui/sonner";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const publicSupabase = createClient(supabaseUrl, supabaseAnonKey);

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function getCaseTypeLabel(caseType?: string) {
  if (!caseType) return "Dados da outra parte";
  const t = caseType.toLowerCase();
  if (t.includes("divórcio") || t.includes("divorcio")) return "Dados do cônjuge";
  if (t.includes("alimento")) return "Dados do alimentante";
  if (t.includes("guarda")) return "Dados do outro responsável";
  return "Dados da outra parte";
}

function validateCpf(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11 || /^(\d)\1+$/.test(clean)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(clean[i]) * (10 - i);
  let r = (sum * 10) % 11; if (r === 10) r = 0;
  if (r !== parseInt(clean[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(clean[i]) * (11 - i);
  r = (sum * 10) % 11; if (r === 10) r = 0;
  return r === parseInt(clean[10]);
}

function maskCep(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d;
}

function maskCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

// ─── Styles ───
const s = {
  page: { minHeight: "100vh", background: "var(--wizard-bg)", fontFamily: "var(--wizard-font-body)" } as React.CSSProperties,
  display: { fontFamily: "var(--wizard-font-display)" } as React.CSSProperties,
  btn: {
    width: "100%", minHeight: 64, fontSize: 18, fontWeight: 700, border: "none", borderRadius: 12,
    background: "var(--wizard-primary)", color: "#fff", cursor: "pointer", transition: "opacity .2s",
    fontFamily: "var(--wizard-font-body)",
  } as React.CSSProperties,
  btnDisabled: { opacity: 0.5, cursor: "not-allowed" } as React.CSSProperties,
  input: {
    width: "100%", minHeight: 56, fontSize: 16, padding: "12px 16px", borderRadius: 10,
    border: "1.5px solid #D1D5DB", background: "#fff", outline: "none", fontFamily: "var(--wizard-font-body)",
    transition: "border-color .2s",
  } as React.CSSProperties,
  inputFocus: { borderColor: "var(--wizard-accent)" } as React.CSSProperties,
  label: { display: "block", fontSize: 14, fontWeight: 600, marginBottom: 6, color: "var(--wizard-primary)" } as React.CSSProperties,
  error: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--wizard-error)", marginTop: 6 } as React.CSSProperties,
  subtle: { fontSize: 13, color: "#6B7280", textAlign: "center" as const, marginTop: 8 },
  card: { background: "#fff", borderRadius: 16, padding: "32px 24px", boxShadow: "0 2px 16px rgba(0,0,0,.06)" } as React.CSSProperties,
};

interface ChildEntry { name: string; day: string; month: string; year: string; }

// ─── Component ───
export default function PublicDataRequest() {
  const { token } = useParams<{ token: string }>();

  // State
  const [pageState, setPageState] = useState<"loading" | "error" | "wizard" | "completed">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [requestData, setRequestData] = useState<{ fields_requested: string[]; client_id: string; case_id: string | null } | null>(null);
  const [clientName, setClientName] = useState("");
  const [caseType, setCaseType] = useState("");

  // Steps
  const [currentStep, setCurrentStep] = useState(0); // 0 = welcome
  const [steps, setSteps] = useState<string[]>([]);

  // Form data
  const [cep, setCep] = useState("");
  const [addressData, setAddressData] = useState({ street: "", number: "", complement: "", neighborhood: "", city: "", state: "" });
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState(false);
  const [showManualAddress, setShowManualAddress] = useState(false);
  const [addressConfirmed, setAddressConfirmed] = useState(false);

  const [hasChildren, setHasChildren] = useState<boolean | null>(null);
  const [childCount, setChildCount] = useState(1);
  const [children, setChildren] = useState<ChildEntry[]>([{ name: "", day: "", month: "", year: "" }]);

  const [opposingName, setOpposingName] = useState("");
  const [opposingCpf, setOpposingCpf] = useState("");
  const [opposingAddress, setOpposingAddress] = useState("");
  const [skipCpf, setSkipCpf] = useState(false);
  const [cpfError, setCpfError] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const numberRef = useRef<HTMLInputElement>(null);

  // Load request
  useEffect(() => {
    loadRequest();
  }, [token]);

  // Restore progress from localStorage
  useEffect(() => {
    if (!token) return;
    const saved = localStorage.getItem(`wizard-${token}`);
    if (saved) {
      try {
        const d = JSON.parse(saved);
        if (d.cep) setCep(d.cep);
        if (d.addressData) setAddressData(d.addressData);
        if (d.children) setChildren(d.children);
        if (d.childCount) setChildCount(d.childCount);
        if (d.hasChildren !== undefined) setHasChildren(d.hasChildren);
        if (d.opposingName) setOpposingName(d.opposingName);
        if (d.opposingCpf) setOpposingCpf(d.opposingCpf);
        if (d.opposingAddress) setOpposingAddress(d.opposingAddress);
        if (d.currentStep) setCurrentStep(d.currentStep);
      } catch { /* ignore */ }
    }
  }, [token]);

  // Save progress to localStorage on changes
  const saveLocal = useCallback(() => {
    if (!token) return;
    localStorage.setItem(`wizard-${token}`, JSON.stringify({
      cep, addressData, children, childCount, hasChildren, opposingName, opposingCpf, opposingAddress, currentStep,
    }));
  }, [token, cep, addressData, children, childCount, hasChildren, opposingName, opposingCpf, opposingAddress, currentStep]);

  useEffect(() => { saveLocal(); }, [saveLocal]);

  const loadRequest = async () => {
    try {
      const { data, error } = await publicSupabase
        .from("data_requests")
        .select("fields_requested, client_id, case_id, status, expires_at")
        .eq("token", token!)
        .maybeSingle();

      if (error || !data) { setErrorMsg("Link inválido. Verifique se o endereço está correto."); setPageState("error"); return; }
      if (data.status === "completed") { setPageState("completed"); return; }
      if (new Date(data.expires_at) < new Date()) { setErrorMsg("Link expirado — entre em contato com seu advogado para solicitar um novo."); setPageState("error"); return; }

      setRequestData(data as any);

      // Build steps
      const fields = data.fields_requested as string[];
      const builtSteps: string[] = [];
      if (fields.includes("address")) builtSteps.push("cep", "address_confirm");
      if (fields.includes("children")) builtSteps.push("children_ask", "children_data");
      if (fields.includes("opposing_party")) builtSteps.push("opposing");
      setSteps(builtSteps);

      // Try to get client name via edge function context (won't work for anon, graceful fallback)
      setClientName("");
      setCaseType("");
      setPageState("wizard");
    } catch {
      setErrorMsg("Erro ao carregar formulário.");
      setPageState("error");
    }
  };

  const totalVisibleSteps = steps.filter(s => {
    if (s === "address_confirm" && !addressConfirmed && !showManualAddress && !cepError) return false;
    if (s === "children_data" && hasChildren !== true) return false;
    return true;
  }).length;

  const currentVisibleStep = (() => {
    const currentStepName = steps[currentStep - 1]; // -1 because step 0 is welcome
    if (!currentStepName) return 0;
    let count = 0;
    for (let i = 0; i < steps.length; i++) {
      const st = steps[i];
      if (st === "address_confirm" && !addressConfirmed && !showManualAddress && !cepError) continue;
      if (st === "children_data" && hasChildren !== true) continue;
      count++;
      if (i === currentStep - 1) return count;
    }
    return count;
  })();

  // ─── CEP Lookup ───
  const handleCepChange = async (val: string) => {
    const masked = maskCep(val);
    setCep(masked);
    setCepError(false);
    setShowManualAddress(false);

    const clean = masked.replace(/\D/g, "");
    if (clean.length === 8) {
      setCepLoading(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
        const data = await res.json();
        if (data.erro) {
          setCepError(true);
          setShowManualAddress(true);
        } else {
          setAddressData({
            street: data.logradouro || "",
            number: "",
            complement: "",
            neighborhood: data.bairro || "",
            city: data.localidade || "",
            state: data.uf || "",
          });
          setAddressConfirmed(true);
          // Auto-advance to confirm screen
          const cepIdx = steps.indexOf("cep");
          setCurrentStep(cepIdx + 2); // +1 for welcome offset, goes to address_confirm
          setTimeout(() => numberRef.current?.focus(), 300);
        }
      } catch {
        setCepError(true);
        setShowManualAddress(true);
      } finally {
        setCepLoading(false);
      }
    }
  };

  // ─── Navigation ───
  const goNext = () => {
    let nextStep = currentStep + 1;
    // Skip children_data if no children
    while (nextStep - 1 < steps.length) {
      const stepName = steps[nextStep - 1];
      if (stepName === "children_data" && hasChildren !== true) { nextStep++; continue; }
      if (stepName === "address_confirm" && !addressConfirmed && !showManualAddress) { nextStep++; continue; }
      break;
    }
    if (nextStep - 1 >= steps.length) {
      handleSubmit();
    } else {
      setCurrentStep(nextStep);
    }
  };

  const goBack = () => {
    if (currentStep <= 0) return;
    let prevStep = currentStep - 1;
    while (prevStep > 0) {
      const stepName = steps[prevStep - 1];
      if (stepName === "children_data" && hasChildren !== true) { prevStep--; continue; }
      if (stepName === "address_confirm" && !addressConfirmed && !showManualAddress) { prevStep--; continue; }
      break;
    }
    setCurrentStep(prevStep);
  };

  // ─── Save partial progress ───
  const savePartial = async () => {
    try {
      const formData: Record<string, unknown> = {};
      if (addressData.street) {
        formData.address_street = addressData.street;
        formData.address_number = addressData.number;
        formData.address_complement = addressData.complement;
        formData.address_neighborhood = addressData.neighborhood;
        formData.address_city = addressData.city;
        formData.address_state = addressData.state;
        formData.address_zip = cep.replace(/\D/g, "");
      }
      if (hasChildren === true) {
        formData.children = children.filter(c => c.name.trim()).map(c => ({
          name: c.name,
          birthdate: c.year && c.month && c.day ? `${c.year}-${String(MONTHS.indexOf(c.month) + 1).padStart(2, "0")}-${c.day.padStart(2, "0")}` : "",
        }));
      }
      if (opposingName) formData.opposing_party_name = opposingName;
      if (opposingCpf && !skipCpf) formData.opposing_party_cpf = opposingCpf;
      if (opposingAddress) formData.opposing_party_address = opposingAddress;

      await fetch(`${supabaseUrl}/functions/v1/submit-data-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: supabaseAnonKey },
        body: JSON.stringify({ token, data: formData }),
      });
    } catch { /* silent */ }
  };

  const handleFillLater = async () => {
    await savePartial();
    toast.success("Tudo bem! Seu progresso foi salvo. Use o mesmo link para continuar depois.");
  };

  // ─── Submit ───
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const formData: Record<string, unknown> = {};

      if (steps.includes("cep") && addressData.street) {
        formData.address_street = addressData.street;
        formData.address_number = addressData.number;
        formData.address_complement = addressData.complement;
        formData.address_neighborhood = addressData.neighborhood;
        formData.address_city = addressData.city;
        formData.address_state = addressData.state;
        formData.address_zip = cep.replace(/\D/g, "");
      }

      if (steps.includes("children_ask")) {
        if (hasChildren === true) {
          formData.children = children.filter(c => c.name.trim()).map(c => ({
            name: c.name,
            birthdate: c.year && c.month && c.day
              ? `${c.year}-${String(MONTHS.indexOf(c.month) + 1).padStart(2, "0")}-${c.day.padStart(2, "0")}`
              : "",
          }));
        } else {
          formData.children = [];
        }
      }

      if (steps.includes("opposing")) {
        if (opposingName) formData.opposing_party_name = opposingName;
        if (opposingCpf && !skipCpf) formData.opposing_party_cpf = opposingCpf;
        if (opposingAddress) formData.opposing_party_address = opposingAddress;
      }

      const res = await fetch(`${supabaseUrl}/functions/v1/submit-data-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: supabaseAnonKey },
        body: JSON.stringify({ token, data: formData }),
      });

      if (!res.ok) throw new Error("fail");
      localStorage.removeItem(`wizard-${token}`);
      setPageState("completed");
    } catch {
      toast.error("Parece que a internet falhou. Seus dados estão salvos — tente de novo quando tiver sinal.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Children helpers ───
  const updateChildCount = (n: number) => {
    const clamped = Math.max(1, Math.min(10, n));
    setChildCount(clamped);
    setChildren(prev => {
      if (clamped > prev.length) {
        return [...prev, ...Array(clamped - prev.length).fill(null).map(() => ({ name: "", day: "", month: "", year: "" }))];
      }
      return prev.slice(0, clamped);
    });
  };

  const updateChild = (idx: number, field: keyof ChildEntry, val: string) => {
    setChildren(prev => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c));
  };

  // ─── Render current step ───
  const currentStepName = currentStep === 0 ? "welcome" : steps[currentStep - 1] || "done";

  // Progress bar
  const ProgressBar = () => (
    currentStep > 0 && currentStepName !== "done" ? (
      <div style={{ padding: "16px 24px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <button onClick={goBack} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "var(--wizard-primary)", fontSize: 14, fontWeight: 600, fontFamily: "var(--wizard-font-body)" }}>
            <ChevronLeft size={18} /> Voltar
          </button>
          <span style={{ ...s.display, fontSize: 14, fontWeight: 600, color: "var(--wizard-primary)" }}>
            Passo {currentVisibleStep} de {totalVisibleSteps}
          </span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: "#E5E7EB", overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 2, transition: "width .4s ease",
            width: `${(currentVisibleStep / totalVisibleSteps) * 100}%`,
            background: `linear-gradient(90deg, var(--wizard-primary), var(--wizard-accent))`,
          }} />
        </div>
      </div>
    ) : null
  );

  const FillLater = () => (
    currentStep > 0 && currentStepName !== "done" ? (
      <button onClick={handleFillLater} style={{ display: "block", margin: "16px auto 0", background: "none", border: "none", fontSize: 13, color: "#9CA3AF", cursor: "pointer", textDecoration: "underline", fontFamily: "var(--wizard-font-body)" }}>
        Preencher depois
      </button>
    ) : null
  );

  // ─── LOADING ───
  if (pageState === "loading") {
    return (
      <div style={{ ...s.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 className="animate-spin" size={32} color="var(--wizard-primary)" />
      </div>
    );
  }

  // ─── ERROR ───
  if (pageState === "error") {
    return (
      <div style={{ ...s.page, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Sonner />
        <div style={{ ...s.card, maxWidth: 400, textAlign: "center" }}>
          <AlertCircle size={48} color="var(--wizard-error)" style={{ margin: "0 auto 16px" }} />
          <p style={{ ...s.display, fontSize: 20, fontWeight: 600, color: "var(--wizard-primary)", marginBottom: 8 }}>Link indisponível</p>
          <p style={{ fontSize: 15, color: "#6B7280" }}>{errorMsg}</p>
        </div>
      </div>
    );
  }

  // ─── COMPLETED ───
  if (pageState === "completed") {
    return (
      <div style={{ ...s.page, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Sonner />
        <div style={{ ...s.card, maxWidth: 400, textAlign: "center" }}>
          <div style={{ animation: "pulse 1s ease-in-out" }}>
            <CheckCircle size={64} color="var(--wizard-accent)" style={{ margin: "0 auto 16px" }} />
          </div>
          <p style={{ ...s.display, fontSize: 22, fontWeight: 600, color: "var(--wizard-primary)", marginBottom: 8 }}>
            Informações enviadas!
          </p>
          <p style={{ fontSize: 15, color: "#6B7280", marginBottom: 24 }}>
            A Dra. Daiane já vai receber seus dados e dará continuidade ao processo.
          </p>
          <button
            onClick={() => window.open("https://wa.me/5500000000000", "_blank")}
            style={{ ...s.btn, background: "var(--wizard-accent)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            <MessageSquare size={20} /> Falar com meu escritório no WhatsApp
          </button>
        </div>
        <style>{`@keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }`}</style>
      </div>
    );
  }

  // ─── WIZARD ───
  return (
    <div style={s.page}>
      <Sonner />
      <div style={{ maxWidth: 440, margin: "0 auto", padding: "0 16px 32px" }}>
        <ProgressBar />

        <div style={{ ...s.card, marginTop: currentStep === 0 ? 48 : 24 }}>

          {/* ── Welcome ── */}
          {currentStepName === "welcome" && (
            <div style={{ textAlign: "center" }}>
              <ShieldCheck size={48} color="var(--wizard-accent)" style={{ margin: "0 auto 20px" }} />
              <h1 style={{ ...s.display, fontSize: 26, fontWeight: 600, color: "var(--wizard-primary)", marginBottom: 8 }}>
                Olá{clientName ? `, ${clientName}` : ""}!
              </h1>
              <p style={{ fontSize: 16, color: "#4B5563", marginBottom: 24, lineHeight: 1.5 }}>
                A Dra. Daiane precisa de algumas informações para seu processo.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28, alignItems: "center" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#6B7280" }}>
                  <Lock size={16} color="var(--wizard-accent)" /> Dados protegidos por criptografia
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#6B7280" }}>
                  <Clock size={16} color="var(--wizard-accent)" /> Menos de 3 minutos
                </span>
              </div>
              <button onClick={() => setCurrentStep(1)} style={s.btn}>Começar</button>
            </div>
          )}

          {/* ── CEP ── */}
          {currentStepName === "cep" && (
            <div>
              <label style={s.label}>Qual é o seu CEP?</label>
              <input
                value={cep}
                onChange={e => handleCepChange(e.target.value)}
                inputMode="numeric"
                style={{ ...s.input, fontSize: 24, letterSpacing: 2, textAlign: "center" }}
                placeholder="00000-000"
                maxLength={9}
              />
              {cepLoading && (
                <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
                  <Loader2 className="animate-spin" size={20} color="var(--wizard-accent)" />
                </div>
              )}
              {cepError && (
                <div style={s.error}>
                  <AlertCircle size={14} /> Não achei esse CEP. Pode preencher o endereço manualmente abaixo?
                </div>
              )}
              <p style={s.subtle}>Não sabe o CEP? Digite só o bairro e cidade</p>
              {showManualAddress && (
                <div style={{ marginTop: 16 }}>
                  <button onClick={() => { setShowManualAddress(true); setAddressConfirmed(true); goNext(); }} style={{ ...s.btn, background: "var(--wizard-accent)" }}>
                    Preencher manualmente
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Address Confirm ── */}
          {currentStepName === "address_confirm" && (
            <div>
              <p style={{ ...s.display, fontSize: 18, fontWeight: 600, color: "var(--wizard-primary)", marginBottom: 16 }}>
                Este é seu endereço?
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={s.label}>Rua</label>
                  <input value={addressData.street} onChange={e => setAddressData(p => ({ ...p, street: e.target.value }))} style={s.input} autoCapitalize="words" />
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={s.label}>Número</label>
                    <input ref={numberRef} value={addressData.number} onChange={e => setAddressData(p => ({ ...p, number: e.target.value }))} style={s.input} inputMode="numeric" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={s.label}>Complemento <span style={{ fontWeight: 400, color: "#9CA3AF" }}>(Opcional)</span></label>
                    <input value={addressData.complement} onChange={e => setAddressData(p => ({ ...p, complement: e.target.value }))} style={s.input} />
                  </div>
                </div>
                <div>
                  <label style={s.label}>Bairro</label>
                  <input value={addressData.neighborhood} onChange={e => setAddressData(p => ({ ...p, neighborhood: e.target.value }))} style={s.input} autoCapitalize="words" />
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 2 }}>
                    <label style={s.label}>Cidade</label>
                    <input value={addressData.city} onChange={e => setAddressData(p => ({ ...p, city: e.target.value }))} style={s.input} autoCapitalize="words" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={s.label}>Estado</label>
                    <input value={addressData.state} onChange={e => setAddressData(p => ({ ...p, state: e.target.value }))} style={s.input} maxLength={2} autoCapitalize="characters" />
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 20 }}>
                <button onClick={goNext} disabled={!addressData.street || !addressData.number} style={{ ...s.btn, ...(!addressData.street || !addressData.number ? s.btnDisabled : {}) }}>
                  Continuar
                </button>
              </div>
            </div>
          )}

          {/* ── Children Ask ── */}
          {currentStepName === "children_ask" && (
            <div>
              <p style={{ ...s.display, fontSize: 20, fontWeight: 600, color: "var(--wizard-primary)", marginBottom: 20 }}>
                Vocês têm filhos em comum?
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { val: true, label: "Sim, temos filhos" },
                  { val: false, label: "Não temos filhos" },
                ].map(opt => (
                  <button
                    key={String(opt.val)}
                    onClick={() => {
                      setHasChildren(opt.val);
                      setTimeout(() => goNext(), 300);
                    }}
                    style={{
                      minHeight: 80, border: `2px solid ${hasChildren === opt.val ? "var(--wizard-accent)" : "#E5E7EB"}`,
                      borderRadius: 12, background: hasChildren === opt.val ? "rgba(43,158,143,.08)" : "#fff",
                      cursor: "pointer", fontSize: 16, fontWeight: 600, fontFamily: "var(--wizard-font-body)",
                      color: "var(--wizard-primary)", transition: "all .2s",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Children Data ── */}
          {currentStepName === "children_data" && (
            <div>
              <p style={{ ...s.display, fontSize: 18, fontWeight: 600, color: "var(--wizard-primary)", marginBottom: 16 }}>
                Quantos filhos?
              </p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginBottom: 24 }}>
                <button onClick={() => updateChildCount(childCount - 1)} style={{ width: 48, height: 48, borderRadius: "50%", border: "2px solid #E5E7EB", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Minus size={20} color="var(--wizard-primary)" />
                </button>
                <span style={{ fontSize: 32, fontWeight: 700, color: "var(--wizard-primary)", fontFamily: "var(--wizard-font-display)" }}>{childCount}</span>
                <button onClick={() => updateChildCount(childCount + 1)} style={{ width: 48, height: 48, borderRadius: "50%", border: "2px solid #E5E7EB", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Plus size={20} color="var(--wizard-primary)" />
                </button>
              </div>

              {children.map((child, i) => (
                <div key={i} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: i < children.length - 1 ? "1px solid #E5E7EB" : "none" }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--wizard-primary)", marginBottom: 12 }}>Filho(a) {i + 1}</p>
                  <div style={{ marginBottom: 12 }}>
                    <label style={s.label}>Nome completo</label>
                    <input value={child.name} onChange={e => updateChild(i, "name", e.target.value)} style={s.input} autoCapitalize="words" />
                  </div>
                  <label style={s.label}>Data de nascimento</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <select value={child.day} onChange={e => updateChild(i, "day", e.target.value)} style={{ ...s.input, flex: 1, appearance: "auto" as any }}>
                      <option value="">Dia</option>
                      {Array.from({ length: 31 }, (_, j) => <option key={j + 1} value={String(j + 1)}>{j + 1}</option>)}
                    </select>
                    <select value={child.month} onChange={e => updateChild(i, "month", e.target.value)} style={{ ...s.input, flex: 2, appearance: "auto" as any }}>
                      <option value="">Mês</option>
                      {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <select value={child.year} onChange={e => updateChild(i, "year", e.target.value)} style={{ ...s.input, flex: 1, appearance: "auto" as any }}>
                      <option value="">Ano</option>
                      {Array.from({ length: 30 }, (_, j) => {
                        const y = new Date().getFullYear() - j;
                        return <option key={y} value={String(y)}>{y}</option>;
                      })}
                    </select>
                  </div>
                </div>
              ))}

              <button onClick={goNext} disabled={!children.some(c => c.name.trim())} style={{ ...s.btn, ...(!children.some(c => c.name.trim()) ? s.btnDisabled : {}) }}>
                Continuar
              </button>
            </div>
          )}

          {/* ── Opposing Party ── */}
          {currentStepName === "opposing" && (
            <div>
              <p style={{ ...s.display, fontSize: 20, fontWeight: 600, color: "var(--wizard-primary)", marginBottom: 20 }}>
                {getCaseTypeLabel(caseType)}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={s.label}>Nome completo</label>
                  <input value={opposingName} onChange={e => setOpposingName(e.target.value)} style={s.input} autoCapitalize="words" />
                </div>
                <div>
                  <label style={s.label}>
                    CPF <span style={{ fontWeight: 400, color: "#9CA3AF" }}>(Opcional — não se preocupe se não souber)</span>
                  </label>
                  {!skipCpf && (
                    <input
                      value={opposingCpf}
                      onChange={e => { setOpposingCpf(maskCpf(e.target.value)); setCpfError(false); }}
                      style={s.input}
                      inputMode="numeric"
                      disabled={skipCpf}
                    />
                  )}
                  {cpfError && (
                    <div style={s.error}>
                      <AlertCircle size={14} /> Este CPF não parece válido. Quer tentar de novo ou pular por enquanto?
                    </div>
                  )}
                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 14, color: "#6B7280", cursor: "pointer" }}>
                    <input type="checkbox" checked={skipCpf} onChange={e => { setSkipCpf(e.target.checked); setCpfError(false); }} style={{ width: 18, height: 18 }} />
                    Não sei o CPF
                  </label>
                </div>
                <div>
                  <label style={s.label}>
                    Endereço <span style={{ fontWeight: 400, color: "#9CA3AF" }}>(Opcional — não se preocupe se não souber)</span>
                  </label>
                  <input value={opposingAddress} onChange={e => setOpposingAddress(e.target.value)} style={s.input} autoCapitalize="words" />
                </div>
              </div>
              <div style={{ marginTop: 20 }}>
                <button
                  onClick={() => {
                    if (opposingCpf && !skipCpf && !validateCpf(opposingCpf)) {
                      setCpfError(true);
                      return;
                    }
                    handleSubmit();
                  }}
                  disabled={!opposingName.trim() || submitting}
                  style={{ ...s.btn, ...(!opposingName.trim() || submitting ? s.btnDisabled : {}), display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  {submitting && <Loader2 className="animate-spin" size={20} />}
                  Enviar
                </button>
              </div>
            </div>
          )}
        </div>

        <FillLater />
      </div>
    </div>
  );
}

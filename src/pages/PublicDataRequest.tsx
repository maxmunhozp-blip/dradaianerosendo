
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Loader2, AlertCircle, Scale } from "lucide-react";
import { toast } from "sonner";
import { Toaster as Sonner } from "@/components/ui/sonner";

// Use anon client for public access
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const publicSupabase = createClient(supabaseUrl, supabaseAnonKey);

interface FieldConfig {
  key: string;
  label: string;
  fields: { name: string; label: string; type: string; options?: string[] }[];
}

const FIELD_CONFIGS: Record<string, FieldConfig> = {
  address: {
    key: "address",
    label: "Endereço completo",
    fields: [
      { name: "address_zip", label: "CEP", type: "cep" },
      { name: "address_street", label: "Rua", type: "text" },
      { name: "address_number", label: "Número", type: "text" },
      { name: "address_complement", label: "Complemento", type: "text" },
      { name: "address_neighborhood", label: "Bairro", type: "text" },
      { name: "address_city", label: "Cidade", type: "text" },
      { name: "address_state", label: "Estado", type: "text" },
    ],
  },
  rg: {
    key: "rg",
    label: "RG",
    fields: [{ name: "rg", label: "RG (com órgão emissor)", type: "text" }],
  },
  marital_status: {
    key: "marital_status",
    label: "Estado civil",
    fields: [{
      name: "marital_status", label: "Estado civil", type: "select",
      options: ["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "União estável"],
    }],
  },
  profession: {
    key: "profession",
    label: "Profissão",
    fields: [{ name: "profession", label: "Profissão", type: "text" }],
  },
  nationality: {
    key: "nationality",
    label: "Nacionalidade",
    fields: [{ name: "nationality", label: "Nacionalidade", type: "text" }],
  },
  children: {
    key: "children",
    label: "Filhos",
    fields: [{ name: "children", label: "Filhos", type: "children" }],
  },
  opposing_party: {
    key: "opposing_party",
    label: "Parte contrária",
    fields: [
      { name: "opposing_party_name", label: "Nome completo", type: "text" },
      { name: "opposing_party_cpf", label: "CPF", type: "text" },
      { name: "opposing_party_address", label: "Endereço", type: "text" },
    ],
  },
};

interface ChildEntry {
  name: string;
  birthdate: string;
}

export default function PublicDataRequest() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestData, setRequestData] = useState<{ fields_requested: string[]; client_id: string } | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [children, setChildren] = useState<ChildEntry[]>([{ name: "", birthdate: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [clientName, setClientName] = useState("");

  useEffect(() => {
    loadRequest();
  }, [token]);

  const loadRequest = async () => {
    try {
      const { data, error: fetchError } = await publicSupabase
        .from("data_requests")
        .select("fields_requested, client_id")
        .eq("token", token!)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .single();

      if (fetchError || !data) {
        setError("Este link expirou ou já foi utilizado.");
        setLoading(false);
        return;
      }

      setRequestData(data as { fields_requested: string[]; client_id: string });

      // Fetch client name (anon can't read clients, so we skip if blocked)
      setClientName("");
      setLoading(false);
    } catch {
      setError("Erro ao carregar formulário.");
      setLoading(false);
    }
  };

  const requestedFields = (requestData?.fields_requested || []) as string[];
  const steps = requestedFields.map((key) => FIELD_CONFIGS[key]).filter(Boolean);
  const currentConfig = steps[currentStep];
  const totalSteps = steps.length;

  const handleCep = async (cep: string) => {
    setFormData((prev) => ({ ...prev, address_zip: cep }));
    const clean = cep.replace(/\D/g, "");
    if (clean.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setFormData((prev) => ({
            ...prev,
            address_street: data.logradouro || prev.address_street || "",
            address_neighborhood: data.bairro || prev.address_neighborhood || "",
            address_city: data.localidade || prev.address_city || "",
            address_state: data.uf || prev.address_state || "",
          }));
        }
      } catch { /* ignore */ }
    }
  };

  const handleNext = () => {
    if (currentStep < totalSteps - 1) setCurrentStep((s) => s + 1);
    else handleSubmit();
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const submitData = { ...formData };
      if (requestedFields.includes("children")) {
        const validChildren = children.filter((c) => c.name.trim());
        if (validChildren.length > 0) {
          (submitData as Record<string, unknown>).children = validChildren;
        }
      }

      const res = await fetch(`${supabaseUrl}/functions/v1/submit-data-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: supabaseAnonKey },
        body: JSON.stringify({ token, data: submitData }),
      });

      if (!res.ok) throw new Error("Submission failed");

      setCompleted(true);
      toast.success("Dados enviados com sucesso!");
    } catch {
      toast.error("Erro ao enviar dados. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Sonner />
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">Link indisponível</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Sonner />
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-lg font-semibold mb-2">Dados enviados! ✅</p>
            <p className="text-sm text-muted-foreground">
              Obrigada por preencher suas informações. Sua advogada já recebeu os dados.
            </p>
            <p className="text-sm text-muted-foreground mt-4">Pode fechar esta página.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <Sonner />
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6 pt-4">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <Scale className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-lg font-semibold">Dra. Daiane Rosendo</h1>
          <p className="text-sm text-muted-foreground mt-1">Preencha suas informações abaixo</p>
        </div>

        {/* Progress */}
        <div className="flex gap-1 mb-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                i <= currentStep ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {currentStep + 1}/{totalSteps} — {currentConfig?.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentConfig?.key === "children" ? (
              <div className="space-y-3">
                {children.map((child, i) => (
                  <div key={i} className="flex gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">Nome</Label>
                      <Input
                        value={child.name}
                        onChange={(e) => {
                          const next = [...children];
                          next[i].name = e.target.value;
                          setChildren(next);
                        }}
                        placeholder="Nome do filho(a)"
                      />
                    </div>
                    <div className="w-36">
                      <Label className="text-xs">Nascimento</Label>
                      <Input
                        type="date"
                        value={child.birthdate}
                        onChange={(e) => {
                          const next = [...children];
                          next[i].birthdate = e.target.value;
                          setChildren(next);
                        }}
                      />
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setChildren([...children, { name: "", birthdate: "" }])}
                >
                  + Adicionar filho(a)
                </Button>
              </div>
            ) : (
              currentConfig?.fields.map((field) => (
                <div key={field.name}>
                  <Label className="text-sm">{field.label}</Label>
                  {field.type === "select" ? (
                    <Select
                      value={formData[field.name] || ""}
                      onValueChange={(v) => setFormData((prev) => ({ ...prev, [field.name]: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options?.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : field.type === "cep" ? (
                    <Input
                      value={formData[field.name] || ""}
                      onChange={(e) => handleCep(e.target.value)}
                      placeholder="00000-000"
                      inputMode="numeric"
                    />
                  ) : (
                    <Input
                      value={formData[field.name] || ""}
                      onChange={(e) => setFormData((prev) => ({ ...prev, [field.name]: e.target.value }))}
                      placeholder={field.label}
                    />
                  )}
                </div>
              ))
            )}

            <div className="flex gap-2 pt-2">
              {currentStep > 0 && (
                <Button variant="outline" onClick={() => setCurrentStep((s) => s - 1)} className="flex-1">
                  Voltar
                </Button>
              )}
              <Button onClick={handleNext} disabled={submitting} className="flex-1">
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                {currentStep === totalSteps - 1 ? "Enviar" : "Próximo"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

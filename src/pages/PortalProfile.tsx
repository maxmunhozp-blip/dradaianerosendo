import { useState } from "react";
import { usePortalSession } from "@/components/ClientPortalLayout";
import { createClient } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, ExternalLink, Phone } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const pub = createClient(supabaseUrl, supabaseAnonKey);

function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid #E5E7EB" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 0", background: "none", border: "none", cursor: "pointer",
          fontSize: 15, fontWeight: 600, color: "var(--wizard-primary)", fontFamily: "var(--wizard-font-body)",
        }}
      >
        {title}
        {open ? <ChevronUp size={18} color="#9CA3AF" /> : <ChevronDown size={18} color="#9CA3AF" />}
      </button>
      {open && <div style={{ paddingBottom: 14 }}>{children}</div>}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <span style={{ fontSize: 12, color: "#9CA3AF", display: "block" }}>{label}</span>
      <span style={{ fontSize: 14, color: value ? "var(--wizard-primary)" : "#D1D5DB" }}>
        {value || "Não informado"}
      </span>
    </div>
  );
}

export default function PortalProfile() {
  const session = usePortalSession();

  const { data: client, isLoading } = useQuery({
    queryKey: ["portal-profile", session?.clientId],
    queryFn: async () => {
      const { data } = await pub.from("clients").select("*").eq("id", session!.clientId).maybeSingle();
      return data;
    },
    enabled: !!session?.clientId,
  });

  const { data: caseData } = useQuery({
    queryKey: ["portal-profile-case", session?.clientId],
    queryFn: async () => {
      const { data } = await pub.from("cases").select("*").eq("client_id", session!.clientId).limit(1).maybeSingle();
      return data;
    },
    enabled: !!session?.clientId,
  });

  const { data: activeRequest } = useQuery({
    queryKey: ["portal-profile-request", session?.clientId],
    queryFn: async () => {
      const { data } = await pub.from("data_requests").select("token").eq("client_id", session!.clientId).eq("status", "pending").limit(1).maybeSingle();
      return data;
    },
    enabled: !!session?.clientId,
  });

  if (isLoading) {
    return (
      <div style={{ maxWidth: 440, margin: "0 auto", padding: "24px 16px" }}>
        <Skeleton className="h-16 w-16 rounded-full mx-auto mb-4" />
        <Skeleton className="h-6 w-40 mx-auto mb-2" />
        <Skeleton className="h-4 w-32 mx-auto" />
      </div>
    );
  }

  const initials = (client?.name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join("");

  const children = caseData?.children as any[] | null;

  return (
    <div style={{ maxWidth: 440, margin: "0 auto", padding: "24px 16px" }}>
      {/* Avatar */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "linear-gradient(135deg, var(--wizard-primary), var(--wizard-accent))",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 12px", color: "#fff",
          fontFamily: "var(--wizard-font-display)", fontSize: 22, fontWeight: 600,
        }}>
          {initials}
        </div>
        <p style={{ fontFamily: "var(--wizard-font-display)", fontSize: 20, fontWeight: 600, color: "var(--wizard-primary)" }}>
          {client?.name}
        </p>
        {client?.phone && (
          <p style={{ fontSize: 14, color: "#6B7280", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4 }}>
            <Phone size={14} /> {client.phone}
          </p>
        )}
      </div>

      {/* Accordion sections */}
      <div style={{ background: "#fff", borderRadius: 14, padding: "0 16px", border: "1px solid #E5E7EB" }}>
        <Accordion title="Meu endereço">
          <InfoRow label="Rua" value={client?.address_street} />
          <InfoRow label="Número" value={client?.address_number} />
          <InfoRow label="Complemento" value={client?.address_complement} />
          <InfoRow label="Bairro" value={client?.address_neighborhood} />
          <InfoRow label="Cidade" value={client?.address_city} />
          <InfoRow label="Estado" value={client?.address_state} />
          <InfoRow label="CEP" value={client?.address_zip} />
        </Accordion>

        <Accordion title="Meu processo">
          <InfoRow label="Tipo" value={caseData?.case_type} />
          <InfoRow label="Status" value={caseData?.status} />
          <InfoRow label="Tribunal" value={caseData?.court} />
          <InfoRow label="Número CNJ" value={caseData?.cnj_number} />
        </Accordion>

        <Accordion title="Dados do cônjuge / parte contrária">
          <InfoRow label="Nome" value={caseData?.opposing_party_name} />
          <InfoRow label="CPF" value={caseData?.opposing_party_cpf} />
          <InfoRow label="Endereço" value={caseData?.opposing_party_address} />
        </Accordion>

        {children && children.length > 0 && (
          <Accordion title="Filhos">
            {children.map((c: any, i: number) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <InfoRow label={`Filho(a) ${i + 1}`} value={c.name} />
                {c.birthdate && <InfoRow label="Nascimento" value={new Date(c.birthdate).toLocaleDateString("pt-BR")} />}
              </div>
            ))}
          </Accordion>
        )}
      </div>

      {/* Update button */}
      <div style={{ marginTop: 20 }}>
        {activeRequest ? (
          <a
            href={`/dados/${activeRequest.token}`}
            style={{
              display: "block", width: "100%", textAlign: "center", minHeight: 48,
              lineHeight: "48px", borderRadius: 12, background: "var(--wizard-primary)",
              color: "#fff", fontSize: 15, fontWeight: 700, textDecoration: "none",
              fontFamily: "var(--wizard-font-body)",
            }}
          >
            Atualizar dados
          </a>
        ) : (
          <p style={{ textAlign: "center", fontSize: 13, color: "#9CA3AF" }}>
            Entre em contato com o escritório para atualizar seus dados.
          </p>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { Loader2, Filter, Mail, Paperclip, Calendar, AlertTriangle, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DEFAULT_SUBJECT_FILTERS = [
  "Intimação",
  "Citação",
  "Despacho",
  "Sentença",
  "Decisão",
  "Mandado",
  "Notificação",
  "Audiência",
  "Prazo",
];

const LIMIT_OPTIONS = [50, 100, 200, 500];

const PERIOD_OPTIONS = [
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "180", label: "6 meses" },
  { value: "365", label: "1 ano" },
];

export interface SyncConfig {
  sync_limit: number;
  sync_subject_filters: string[];
  sync_judicial_only: boolean;
  sync_extra_senders: string;
  sync_attachments: boolean;
  sync_attachments_pdf_only: boolean;
  sync_period_days: number;
  sync_import_all?: boolean;
  sync_financial?: boolean;
  sync_extra_domains?: string;
}

interface SyncConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: SyncConfig) => void;
  saving?: boolean;
  initialConfig?: Partial<SyncConfig>;
  provider?: string;
}

export function SyncConfigModal({ open, onOpenChange, onSave, saving, initialConfig, provider }: SyncConfigModalProps) {
  const isCorporate = provider === "hostinger" || provider === "imap";
  const [importAll, setImportAll] = useState(initialConfig?.sync_import_all ?? isCorporate);
  const [limit, setLimit] = useState(initialConfig?.sync_limit ?? 100);
  const [subjectFilters, setSubjectFilters] = useState<string[]>(
    (initialConfig?.sync_subject_filters as string[]) ?? [...DEFAULT_SUBJECT_FILTERS]
  );
  const [judicialOnly, setJudicialOnly] = useState(initialConfig?.sync_judicial_only ?? !isCorporate);
  const [extraSenders, setExtraSenders] = useState(initialConfig?.sync_extra_senders ?? "");
  const [attachments, setAttachments] = useState(initialConfig?.sync_attachments ?? false);
  const [pdfOnly, setPdfOnly] = useState(initialConfig?.sync_attachments_pdf_only ?? true);
  const [periodDays, setPeriodDays] = useState(String(initialConfig?.sync_period_days ?? 30));
  const [syncFinancial, setSyncFinancial] = useState(initialConfig?.sync_financial ?? false);
  const [extraDomains, setExtraDomains] = useState(initialConfig?.sync_extra_domains ?? "");

  const toggleFilter = (filter: string) => {
    setSubjectFilters((prev) =>
      prev.includes(filter) ? prev.filter((f) => f !== filter) : [...prev, filter]
    );
  };

  const handleSave = () => {
    onSave({
      sync_limit: limit,
      sync_subject_filters: importAll ? [] : subjectFilters,
      sync_judicial_only: importAll ? false : judicialOnly,
      sync_extra_senders: extraSenders,
      sync_attachments: attachments,
      sync_attachments_pdf_only: pdfOnly,
      sync_period_days: parseInt(periodDays),
      sync_import_all: importAll,
      sync_financial: syncFinancial,
      sync_extra_domains: extraDomains,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-amber-600" />
            Configurar importação de e-mails
          </DialogTitle>
          <DialogDescription>
            Defina quais e-mails serão importados e como.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Section 1 - Quantidade */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Quantidade</Label>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Importar os últimos</span>
              <div className="flex gap-1.5">
                {LIMIT_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setLimit(opt)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      limit === opt
                        ? "bg-amber-100 text-amber-800 border border-amber-300"
                        : "bg-muted text-muted-foreground hover:bg-muted/80 border border-transparent"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <span className="text-sm text-muted-foreground">e-mails</span>
            </div>
          </div>

          {/* Section - Importar todos (corporate) */}
          {isCorporate && (
            <div className="space-y-3 bg-muted/50 border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Importar todos os e-mails</p>
                  <p className="text-xs text-muted-foreground">
                    E-mails corporativos não possuem os mesmos filtros do Gmail.
                    Ative para importar tudo sem filtros de assunto ou remetente.
                  </p>
                </div>
                <Switch checked={importAll} onCheckedChange={setImportAll} />
              </div>
            </div>
          )}

          {/* Section 2 - Filtros de assunto */}
          {!importAll && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Filtros de assunto</Label>
              </div>
              <p className="text-xs text-muted-foreground">Quais tipos de e-mails importar:</p>
              <div className="grid grid-cols-3 gap-2">
                {DEFAULT_SUBJECT_FILTERS.map((filter) => (
                  <label
                    key={filter}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <Checkbox
                      checked={subjectFilters.includes(filter)}
                      onCheckedChange={() => toggleFilter(filter)}
                    />
                    {filter}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Section 3 - Filtros de remetente */}
          {!importAll && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Filtros de remetente</Label>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">Apenas remetentes judiciais (@*.jus.br)</p>
                  <p className="text-xs text-muted-foreground">Filtra apenas e-mails de domínios judiciais</p>
                </div>
                <Switch checked={judicialOnly} onCheckedChange={setJudicialOnly} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Remetentes adicionais (separados por vírgula)</Label>
                <Input
                  value={extraSenders}
                  onChange={(e) => setExtraSenders(e.target.value)}
                  placeholder="ex: noreply@pje.jus.br, intimacao@tjsp.jus.br"
                  className="text-sm"
                />
              </div>
            </div>
          )}

          {/* Section - Outros remetentes */}
          {!importAll && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Outros remetentes</Label>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">Importar e-mails financeiros</p>
                  <p className="text-xs text-muted-foreground">Boletos, faturas, honorários, notas fiscais</p>
                </div>
                <Switch checked={syncFinancial} onCheckedChange={setSyncFinancial} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Domínios adicionais permitidos</Label>
                <Input
                  value={extraDomains}
                  onChange={(e) => setExtraDomains(e.target.value)}
                  placeholder="ex: hostinger.com, contabilidade.com.br"
                  className="text-sm"
                />
                <p className="text-[10px] text-muted-foreground">Separados por vírgula. E-mails desses domínios serão importados mesmo com filtro judicial ativo.</p>
              </div>
            </div>
          )}

          {/* Section 4 - Attachments */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Anexos</Label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Importar anexos</p>
                <p className="text-xs text-muted-foreground">Salvar anexos dos e-mails importados</p>
              </div>
              <Switch checked={attachments} onCheckedChange={setAttachments} />
            </div>
            {attachments && (
              <>
                <label className="flex items-center gap-2 text-sm cursor-pointer ml-1">
                  <Checkbox checked={pdfOnly} onCheckedChange={(v) => setPdfOnly(!!v)} />
                  Apenas PDF
                </label>
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md p-2.5 text-xs text-amber-800">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Anexos consomem storage. Recomendamos apenas PDFs judiciais.</span>
                </div>
              </>
            )}
          </div>

          {/* Section 5 - Período */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Período</Label>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">E-mails dos últimos</span>
              <Select value={periodDays} onValueChange={setPeriodDays}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-amber-600 hover:bg-amber-700">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Salvar e sincronizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

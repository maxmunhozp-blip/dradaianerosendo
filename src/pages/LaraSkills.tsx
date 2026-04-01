import { useState, useEffect } from "react";
import { Zap, Lock, Plus, Pencil, Trash2, X, Loader2, ToggleLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

interface Skill {
  id: string;
  name: string;
  description: string | null;
  trigger_keywords: string[];
  system_instructions: string;
  actions_available: string[];
  specialty_tags: string[];
  is_active: boolean;
  is_builtin: boolean;
  user_id: string | null;
}

const SPECIALTIES = ["Família", "Tributário", "Trabalhista", "Criminal", "Civil", "Outro"];
const ACTIONS = [
  { value: "send_whatsapp", label: "Enviar WhatsApp" },
  { value: "create_task", label: "Criar tarefa" },
  { value: "generate_document", label: "Gerar documento" },
  { value: "schedule_reminder", label: "Agendar lembrete" },
  { value: "open_client", label: "Abrir cadastro" },
];

const TAG_COLORS: Record<string, string> = {
  geral: "bg-slate-100 text-slate-700",
  família: "bg-blue-100 text-blue-700",
  divórcio: "bg-purple-100 text-purple-700",
  alimentos: "bg-amber-100 text-amber-700",
  tributário: "bg-green-100 text-green-700",
  trabalhista: "bg-orange-100 text-orange-700",
  criminal: "bg-red-100 text-red-700",
  civil: "bg-teal-100 text-teal-700",
};

export default function LaraSkills() {
  const { user } = useAuth();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [instructions, setInstructions] = useState("");
  const [actions, setActions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadSkills(); }, []);

  const loadSkills = async () => {
    setLoading(true);
    const { data } = await (supabase.from("lara_skills") as any)
      .select("*")
      .order("is_builtin", { ascending: false })
      .order("name");
    setSkills((data as Skill[]) || []);
    setLoading(false);
  };

  const toggleActive = async (skill: Skill) => {
    await (supabase.from("lara_skills") as any)
      .update({ is_active: !skill.is_active })
      .eq("id", skill.id);
    setSkills(prev => prev.map(s => s.id === skill.id ? { ...s, is_active: !s.is_active } : s));
  };

  const openNew = () => {
    setEditingSkill(null);
    setName(""); setDescription(""); setSpecialties([]); setKeywords([]);
    setInstructions(""); setActions([]); setKeywordInput("");
    setModalOpen(true);
  };

  const openEdit = (skill: Skill) => {
    setEditingSkill(skill);
    setName(skill.name);
    setDescription(skill.description || "");
    setSpecialties(skill.specialty_tags || []);
    setKeywords(skill.trigger_keywords || []);
    setInstructions(skill.system_instructions);
    setActions(skill.actions_available || []);
    setKeywordInput("");
    setModalOpen(true);
  };

  const handleCustomize = (skill: Skill) => {
    // Copy builtin as custom
    setEditingSkill(null);
    setName(skill.name + " (Personalizada)");
    setDescription(skill.description || "");
    setSpecialties(skill.specialty_tags || []);
    setKeywords(skill.trigger_keywords || []);
    setInstructions(skill.system_instructions);
    setActions(skill.actions_available || []);
    setKeywordInput("");
    setModalOpen(true);
  };

  const handleDelete = async (skill: Skill) => {
    if (!confirm("Excluir esta habilidade?")) return;
    await (supabase.from("lara_skills") as any).delete().eq("id", skill.id);
    setSkills(prev => prev.filter(s => s.id !== skill.id));
    toast.success("Habilidade excluída");
  };

  const addKeyword = () => {
    const trimmed = keywordInput.trim().toLowerCase();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords(prev => [...prev, trimmed]);
    }
    setKeywordInput("");
  };

  const handleSave = async () => {
    if (!name.trim() || !instructions.trim()) {
      toast.error("Nome e instruções são obrigatórios");
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      trigger_keywords: keywords,
      system_instructions: instructions,
      actions_available: actions,
      specialty_tags: specialties.map(s => s.toLowerCase()),
      user_id: user?.id,
      is_builtin: false,
      updated_at: new Date().toISOString(),
    };

    if (editingSkill && !editingSkill.is_builtin) {
      await (supabase.from("lara_skills") as any).update(payload).eq("id", editingSkill.id);
    } else {
      await (supabase.from("lara_skills") as any).insert(payload);
    }

    toast.success("Habilidade salva!");
    setSaving(false);
    setModalOpen(false);
    loadSkills();
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Habilidades da LARA</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure como a LARA age em cada tipo de caso do seu escritório.
          </p>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Nova Habilidade
        </Button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <Zap className="w-5 h-5 text-primary mt-0.5 shrink-0" />
        <p className="text-sm text-foreground">
          As habilidades ensinam a LARA seus protocolos. Elas já vêm pré-configuradas — você só precisa ativá-las.
        </p>
      </div>

      {/* Skills list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {skills.map(skill => (
            <Card key={skill.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-foreground">{skill.name}</span>
                      {skill.is_builtin ? (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <Lock className="w-2.5 h-2.5" /> Nativa LexAI
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Personalizada</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{skill.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {(skill.specialty_tags || []).map(tag => (
                        <span key={tag} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${TAG_COLORS[tag] || "bg-gray-100 text-gray-600"}`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {skill.is_builtin ? (
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => handleCustomize(skill)}>
                        Personalizar
                      </Button>
                    ) : (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(skill)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(skill)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                    <Switch checked={skill.is_active} onCheckedChange={() => toggleActive(skill)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSkill ? "Editar Habilidade" : "Nova Habilidade"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Protocolo de Inventário" />
            </div>

            <div>
              <Label className="text-xs">Descrição</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Breve descrição do que esta habilidade faz" />
            </div>

            <div>
              <Label className="text-xs mb-2 block">Especialidade</Label>
              <div className="flex flex-wrap gap-2">
                {SPECIALTIES.map(s => (
                  <label key={s} className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Checkbox
                      checked={specialties.includes(s.toLowerCase())}
                      onCheckedChange={checked => {
                        setSpecialties(prev =>
                          checked ? [...prev, s.toLowerCase()] : prev.filter(x => x !== s.toLowerCase())
                        );
                      }}
                    />
                    {s}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs">Gatilhos</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={keywordInput}
                  onChange={e => setKeywordInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
                  placeholder="Digite e pressione Enter"
                  className="flex-1"
                />
                <Button variant="outline" size="sm" onClick={addKeyword} type="button">+</Button>
              </div>
              <p className="text-[11px] text-muted-foreground mb-2">
                Palavras-chave que fazem a LARA usar esta habilidade automaticamente
              </p>
              <div className="flex flex-wrap gap-1.5">
                {keywords.map((kw, i) => (
                  <Badge key={i} variant="secondary" className="text-xs gap-1">
                    {kw}
                    <button onClick={() => setKeywords(prev => prev.filter((_, j) => j !== i))} className="ml-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs">Instruções para a LARA</Label>
              <Textarea
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                placeholder="Explique como a LARA deve agir. Ex: Para inventários, sempre verificar se há testamento, listar herdeiros e calcular meação do cônjuge..."
                className="min-h-[120px]"
              />
            </div>

            <div>
              <Label className="text-xs mb-2 block">Ações disponíveis</Label>
              <div className="flex flex-wrap gap-2">
                {ACTIONS.map(a => (
                  <label key={a.value} className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Checkbox
                      checked={actions.includes(a.value)}
                      onCheckedChange={checked => {
                        setActions(prev =>
                          checked ? [...prev, a.value] : prev.filter(x => x !== a.value)
                        );
                      }}
                    />
                    {a.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Salvar Habilidade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

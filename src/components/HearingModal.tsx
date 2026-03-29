import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCreateHearing } from "@/hooks/use-hearings";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCaseId?: string;
}

export function HearingModal({ open, onOpenChange, defaultCaseId }: Props) {
  const [title, setTitle] = useState("");
  const [caseId, setCaseId] = useState(defaultCaseId || "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [alertWhatsapp, setAlertWhatsapp] = useState(true);

  const createHearing = useCreateHearing();

  const { data: cases = [] } = useQuery({
    queryKey: ["cases-active-for-hearing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("id, case_type, clients(name)")
        .neq("status", "encerrado")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const handleSubmit = async () => {
    if (!title.trim() || !caseId || !date || !time) {
      toast.error("Preencha título, caso, data e hora");
      return;
    }
    try {
      await createHearing.mutateAsync({
        case_id: caseId,
        title: title.trim(),
        date: new Date(`${date}T${time}`).toISOString(),
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
        alert_whatsapp: alertWhatsapp,
      });
      toast.success("Data agendada com sucesso");
      setTitle("");
      setCaseId(defaultCaseId || "");
      setDate("");
      setTime("");
      setLocation("");
      setNotes("");
      setAlertWhatsapp(true);
      onOpenChange(false);
    } catch {
      toast.error("Erro ao agendar data");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova data</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-xs">Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Audiência de Conciliação" className="mt-1" />
          </div>
          {!defaultCaseId && (
            <div>
              <Label className="text-xs">Caso</Label>
              <Select value={caseId} onValueChange={setCaseId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o caso" />
                </SelectTrigger>
                <SelectContent>
                  {cases.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.case_type} — {c.clients?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Hora</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Local (vara/fórum)</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="2ª Vara de Família" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas adicionais..." className="mt-1" rows={2} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Enviar lembrete via WhatsApp</Label>
            <Switch checked={alertWhatsapp} onCheckedChange={setAlertWhatsapp} />
          </div>
          <Button onClick={handleSubmit} disabled={createHearing.isPending} className="w-full">
            {createHearing.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

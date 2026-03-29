import { useState, useMemo } from "react";
import { useHearings, useUpdateHearing, type Hearing } from "@/hooks/use-hearings";
import { HearingModal } from "@/components/HearingModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, List, MapPin, Clock, MessageSquare } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameMonth, isSameDay, startOfWeek, endOfWeek, isToday, isBefore, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  agendado: "bg-amber-100 text-amber-800 border-amber-200",
  realizado: "bg-green-100 text-green-800 border-green-200",
  cancelado: "bg-muted text-muted-foreground border-border",
};

const statusLabels: Record<string, string> = {
  agendado: "Agendado",
  realizado: "Realizado",
  cancelado: "Cancelado",
};

function isOverdue(h: Hearing) {
  return h.status === "agendado" && isBefore(new Date(h.date), new Date());
}

function sendWhatsAppReminder(hearing: Hearing) {
  const clientName = hearing.cases?.clients?.name?.split(" ")[0] || "Cliente";
  const phone = hearing.cases?.clients?.phone?.replace(/\D/g, "") || "";
  const d = new Date(hearing.date);
  const dateStr = format(d, "dd/MM/yyyy");
  const timeStr = format(d, "HH:mm");
  const loc = hearing.location || "local a confirmar";
  const message = `Olá ${clientName}! Lembrando que sua audiência está marcada para ${dateStr} às ${timeStr}h em ${loc}. Qualquer dúvida estou à disposição. Dra. Daiane Rosendo.`;

  if (!phone) {
    toast.error("Cliente não possui telefone cadastrado");
    return;
  }

  supabase.functions.invoke("whatsapp", {
    body: { phone, message },
  }).then(({ error }) => {
    if (error) toast.error("Erro ao enviar lembrete");
    else toast.success("Lembrete enviado via WhatsApp");
  });
}

function HearingItem({ h }: { h: Hearing }) {
  const overdue = isOverdue(h);
  const d = new Date(h.date);
  const hoursUntil = differenceInHours(d, new Date());
  const isSoon = h.status === "agendado" && hoursUntil >= 0 && hoursUntil <= 48;

  return (
    <div className={`flex items-center justify-between px-4 py-3 border-b border-border last:border-b-0 ${overdue ? "bg-destructive/5" : ""}`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="text-center shrink-0 w-12">
          <p className="text-lg font-semibold text-foreground tabular-nums">{format(d, "dd")}</p>
          <p className="text-[10px] uppercase text-muted-foreground">{format(d, "MMM", { locale: ptBR })}</p>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground truncate">{h.title}</p>
            {isSoon && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                {hoursUntil <= 24 ? "Hoje" : "Amanhã"}
              </Badge>
            )}
            {overdue && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Atrasado</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {h.cases?.case_type} — {h.cases?.clients?.name}
          </p>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />{format(d, "HH:mm")}
            </span>
            {h.location && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3" />{h.location}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge className={`${statusColors[h.status]} text-[10px]`}>{statusLabels[h.status]}</Badge>
        {h.status === "agendado" && h.alert_whatsapp && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => sendWhatsAppReminder(h)} title="Enviar lembrete WhatsApp">
            <MessageSquare className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default function Agenda() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [view, setView] = useState<"list" | "calendar">("list");
  const [showModal, setShowModal] = useState(false);
  const { data: hearings = [], isLoading } = useHearings();

  const monthHearings = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return hearings.filter((h) => {
      const d = new Date(h.date);
      return d >= start && d <= end;
    });
  }, [hearings, currentMonth]);

  // Group by week for list view
  const weekGroups = useMemo(() => {
    const groups: Record<string, Hearing[]> = {};
    monthHearings.forEach((h) => {
      const ws = format(startOfWeek(new Date(h.date), { locale: ptBR }), "dd/MM");
      const we = format(endOfWeek(new Date(h.date), { locale: ptBR }), "dd/MM");
      const key = `${ws} — ${we}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(h);
    });
    return groups;
  }, [monthHearings]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { locale: ptBR });
    const end = endOfWeek(endOfMonth(currentMonth), { locale: ptBR });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const hearingsByDay = useMemo(() => {
    const map: Record<string, Hearing[]> = {};
    hearings.forEach((h) => {
      const key = format(new Date(h.date), "yyyy-MM-dd");
      if (!map[key]) map[key] = [];
      map[key].push(h);
    });
    return map;
  }, [hearings]);

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Agenda</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Audiências e prazos</p>
        </div>
        <Button size="sm" onClick={() => setShowModal(true)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Nova data
        </Button>
      </div>

      {/* Month navigation + view toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium text-foreground min-w-[140px] text-center capitalize">
            {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center border border-border rounded-md">
          <Button variant={view === "list" ? "secondary" : "ghost"} size="sm" className="h-7 rounded-r-none" onClick={() => setView("list")}>
            <List className="w-3.5 h-3.5 mr-1" />Lista
          </Button>
          <Button variant={view === "calendar" ? "secondary" : "ghost"} size="sm" className="h-7 rounded-l-none" onClick={() => setView("calendar")}>
            <CalendarIcon className="w-3.5 h-3.5 mr-1" />Calendário
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : view === "list" ? (
        Object.keys(weekGroups).length === 0 ? (
          <EmptyState
            icon={CalendarIcon}
            title="Nenhuma data neste mês"
            description="Adicione audiências e prazos para este período."
            actionLabel="Nova data"
            onAction={() => setShowModal(true)}
          />
        ) : (
          <div className="space-y-4">
            {Object.entries(weekGroups).map(([week, items]) => (
              <div key={week}>
                <p className="text-xs font-medium text-muted-foreground mb-1">Semana {week}</p>
                <div className="border border-border rounded-lg">
                  {items.map((h) => (
                    <HearingItem key={h.id} h={h} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Calendar grid */
        <div className="border border-border rounded-lg">
          <div className="grid grid-cols-7 border-b border-border">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayHearings = hearingsByDay[key] || [];
              const inMonth = isSameMonth(day, currentMonth);
              return (
                <div
                  key={key}
                  className={`min-h-[80px] border-b border-r border-border p-1 ${!inMonth ? "bg-muted/30" : ""} ${isToday(day) ? "bg-accent/30" : ""}`}
                >
                  <p className={`text-xs tabular-nums ${inMonth ? "text-foreground" : "text-muted-foreground/50"} ${isToday(day) ? "font-bold" : ""}`}>
                    {format(day, "d")}
                  </p>
                  {dayHearings.slice(0, 2).map((h) => (
                    <div
                      key={h.id}
                      className={`text-[10px] truncate rounded px-1 py-0.5 mt-0.5 border ${statusColors[h.status]} ${isOverdue(h) ? "!bg-destructive/10 !text-destructive !border-destructive/30" : ""}`}
                    >
                      {format(new Date(h.date), "HH:mm")} {h.title}
                    </div>
                  ))}
                  {dayHearings.length > 2 && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">+{dayHearings.length - 2}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <HearingModal open={showModal} onOpenChange={setShowModal} />
    </div>
  );
}

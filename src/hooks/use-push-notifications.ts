import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { differenceInDays, parseISO } from "date-fns";

export function usePushNotifications() {
  const { user } = useAuth();
  const permissionRef = useRef<NotificationPermission>("default");

  useEffect(() => {
    if (!user) return;
    if (!("Notification" in window)) return;

    // Request permission on mount
    if (Notification.permission === "default") {
      Notification.requestPermission().then((p) => {
        permissionRef.current = p;
      });
    } else {
      permissionRef.current = Notification.permission;
    }

    const channel = supabase
      .channel("intimacoes-push")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "intimacoes" },
        (payload) => {
          const row = payload.new as {
            process_number?: string;
            movement_type?: string;
            deadline_date?: string;
            ai_summary?: string;
          };

          const isUrgent = row.deadline_date
            ? differenceInDays(parseISO(row.deadline_date), new Date()) <= 7
            : false;

          if (permissionRef.current !== "granted") return;

          const title = isUrgent
            ? `⚠️ Intimação URGENTE — ${row.process_number || "Novo processo"}`
            : `Nova intimação — ${row.process_number || "Novo processo"}`;

          const body = [
            row.movement_type && `Tipo: ${row.movement_type}`,
            row.deadline_date &&
              `Prazo: ${new Date(row.deadline_date).toLocaleDateString("pt-BR")}`,
            row.ai_summary,
          ]
            .filter(Boolean)
            .join("\n");

          try {
            new Notification(title, {
              body: body || "Acesse o LexAI para mais detalhes.",
              icon: "/favicon.ico",
              tag: `intimacao-${(payload.new as { id: string }).id}`,
            });
          } catch {
            // Notification constructor may fail in some contexts
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
}

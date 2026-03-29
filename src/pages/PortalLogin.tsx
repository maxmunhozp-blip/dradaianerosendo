import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Loader2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function PortalLogin() {
  const { user, isLoading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user) return <Navigate to="/portal" replace />;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsSending(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/portal`,
      },
    });

    setIsSending(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-lg bg-accent flex items-center justify-center">
            <FileText className="w-6 h-6 text-accent-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Portal do Cliente</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe seu processo e envie documentos
          </p>
        </div>

        {sent ? (
          <div className="text-center space-y-3 border border-border rounded-lg p-6">
            <Mail className="w-8 h-8 mx-auto text-accent" />
            <p className="text-sm font-medium text-foreground">Link enviado!</p>
            <p className="text-xs text-muted-foreground">
              Verifique sua caixa de entrada em <strong>{email}</strong> e clique no link para acessar.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSend} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Seu e-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSending}>
              {isSending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enviar link de acesso
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Enviaremos um link seguro para acessar seu portal.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

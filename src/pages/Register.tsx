import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Navigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

const PROMO_CODE = "max1985";

const planLabels: Record<string, string> = {
  basic: "Básico — R$180/mês",
  pro: "Pro — R$450/mês",
  premium: "Premium — R$500/mês",
};

const planFeatures: Record<string, string[]> = {
  basic: ["Até 30 clientes", "Gestão de casos", "Upload de documentos"],
  pro: ["Clientes ilimitados", "Intimações", "Templates", "LARA IA"],
  premium: ["Tudo do Pro", "E-mails", "Extração IA", "Portal do cliente"],
};

export default function Register() {
  const { user, isLoading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedPlan = searchParams.get("plan") || "premium";

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user) return <Navigate to="/dashboard" replace />;

  const effectivePlan = promoCode.toLowerCase().trim() === PROMO_CODE ? "premium" : selectedPlan;
  const isFree = promoCode.toLowerCase().trim() === PROMO_CODE;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !name.trim()) return;
    setIsSubmitting(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });

    if (error) {
      toast.error(error.message);
      setIsSubmitting(false);
      return;
    }

    // Create plan record
    if (data.user) {
      await supabase.from("user_plans" as any).insert({
        user_id: data.user.id,
        plan: effectivePlan,
        status: isFree ? "active" : "pending",
        promo_code: promoCode.trim() || null,
      } as any);
    }

    setIsSubmitting(false);
    toast.success(
      isFree
        ? "Conta criada com acesso Premium! Verifique seu e-mail para confirmar."
        : "Conta criada! Verifique seu e-mail para confirmar."
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold">LexAI</span>
          </Link>
          <p className="text-sm text-muted-foreground">Crie sua conta de advogado</p>
        </div>

        {/* Selected plan summary */}
        <Card className="bg-muted/30">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Plano selecionado</CardTitle>
              {isFree && <Badge className="bg-primary text-primary-foreground text-[10px]">Grátis</Badge>}
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="font-medium text-sm">
              {isFree ? "Premium — Grátis (código promocional)" : planLabels[effectivePlan] || planLabels.premium}
            </p>
            <ul className="mt-2 space-y-1">
              {(planFeatures[effectivePlan] || planFeatures.premium).map((f) => (
                <li key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Check className="w-3 h-3 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome completo</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dr. João Silva"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="promo">Código promocional (opcional)</Label>
            <Input
              id="promo"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="Insira seu código"
            />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Criar conta
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/login" className="text-foreground underline underline-offset-2 hover:text-primary">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}

import { useAuth } from "@/hooks/use-auth";
import { Navigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Check, Scale, ShieldCheck, Bot, Loader2 } from "lucide-react";

const plans = [
  {
    id: "basic",
    name: "Básico",
    price: "180",
    description: "Para advogados autônomos começando",
    features: [
      "Até 30 clientes",
      "Gestão de casos",
      "Upload de documentos",
      "Agenda de audiências",
    ],
    popular: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "450",
    description: "Para escritórios em crescimento",
    features: [
      "Clientes ilimitados",
      "Gestão de casos",
      "Upload de documentos",
      "Agenda de audiências",
      "Intimações automáticas",
      "Templates de petição",
      "LARA IA assistente",
    ],
    popular: true,
  },
  {
    id: "premium",
    name: "Premium",
    price: "500",
    description: "Acesso completo a todas as funcionalidades",
    features: [
      "Tudo do plano Pro",
      "Sincronização de e-mails",
      "Extração inteligente de documentos",
      "Assinatura digital",
      "Portal do cliente",
      "Suporte prioritário",
      "LARA Skills personalizadas",
    ],
    popular: false,
  },
];

export default function LandingPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold">LexAI</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">Entrar</Button>
            </Link>
            <Link to="/register">
              <Button size="sm">Começar agora</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 sm:py-28 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <Badge variant="secondary" className="text-xs px-3 py-1">
            Gestão jurídica inteligente
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground leading-tight">
            Gerencie seu escritório com
            <span className="text-primary"> inteligência artificial</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Casos, clientes, documentos, intimações e petições — tudo em um só lugar,
            com a IA LARA te auxiliando em cada etapa.
          </p>
          <div className="flex items-center justify-center gap-3 pt-4">
            <Link to="/register">
              <Button size="lg" className="px-8">Criar conta grátis</Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="lg">Já tenho conta</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 border-t border-border bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-12">Tudo que você precisa</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Scale, title: "Gestão de Casos", desc: "Acompanhe todos os processos em um painel unificado" },
              { icon: FileText, title: "Documentos", desc: "Upload, organização e extração inteligente de dados" },
              { icon: Bot, title: "LARA IA", desc: "Assistente jurídica com inteligência artificial" },
              { icon: ShieldCheck, title: "Segurança", desc: "Dados isolados por escritório com criptografia" },
            ].map((f) => (
              <div key={f.title} className="text-center space-y-3 p-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
                  <f.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-medium text-sm">{f.title}</h3>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-4" id="planos">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 space-y-2">
            <h2 className="text-2xl font-semibold">Planos e Preços</h2>
            <p className="text-muted-foreground text-sm">Escolha o plano ideal para seu escritório</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={`relative ${plan.popular ? "border-primary shadow-lg ring-1 ring-primary/20" : ""}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground text-[10px] px-3">
                      Mais popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">{plan.description}</p>
                  <div className="pt-3">
                    <span className="text-3xl font-bold">R${plan.price}</span>
                    <span className="text-sm text-muted-foreground">/mês</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to={`/register?plan=${plan.id}`} className="block">
                    <Button
                      className="w-full"
                      variant={plan.popular ? "default" : "outline"}
                    >
                      Escolher {plan.name}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} LexAI. Todos os direitos reservados.</span>
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5" />
            <span>Gestão Jurídica Inteligente</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

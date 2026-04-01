
## Plano: SaaS Multi-Tenant LexAI

### 1. Landing Page na rota `/` (para visitantes)
- Hero com headline e descrição do sistema
- Seção de 3 planos: **Básico R$180**, **Pro R$450**, **Premium R$500**
- Botão "Cadastrar" em cada plano → vai pro `/register`
- Quem já está logado é redirecionado pro `/dashboard`
- A rota `/` atual (Dashboard) vira `/dashboard`

### 2. Página de Cadastro `/register`
- Formulário: nome, email, senha, plano selecionado
- Campo opcional "Código promocional" → se digitar **max1985**, ganha plano Premium grátis
- Após cadastro, usuário recebe role `advogado` (nova role no enum) automaticamente
- Auto-confirm habilitado para facilitar fluxo inicial

### 3. Isolamento de dados (Multi-Tenant)
- Adicionar coluna `owner_id` nas tabelas: `clients`, `cases`, `documents`, `checklist_items`, `hearings`, `messages`, `case_timeline`, `intimacoes`
- Atualizar RLS: cada advogado vê **somente seus dados** (WHERE owner_id = auth.uid())
- Admin continua vendo tudo
- Dados existentes serão vinculados ao admin atual

### 4. Planos no banco de dados
- Nova tabela `user_plans`: user_id, plan (basic/pro/premium), status (active/trial/cancelled), promo_code, created_at
- Trigger: ao cadastrar, cria registro de plano automaticamente
- Chave **max1985**: plano premium + status active sem cobrança

### 5. "Ver Ambiente do Usuário" (admin)
- Botão na página de Usuários em cada card
- Abre view read-only que filtra os dados pelo user_id selecionado
- Banner fixo no topo: "Visualizando ambiente de [email] — Voltar"

### 6. Ajuste de rotas
- `/` → Landing page (público)
- `/login` → Login existente
- `/register` → Novo cadastro com plano
- `/dashboard` → Painel (protegido)
- Todas as demais rotas permanecem iguais, prefixadas com proteção

### 7. Enum de roles atualizado
- `admin` → vê tudo, gerencia sistema
- `advogado` → vê só seus dados, é o "tenant"
- `client` → cliente do advogado, acessa portal

### Ordem de execução
1. Migração DB (enum, owner_id, user_plans, RLS)
2. Landing page + cadastro
3. Ajuste de rotas
4. Isolamento multi-tenant no frontend
5. Botão "Ver Ambiente" na gestão de usuários

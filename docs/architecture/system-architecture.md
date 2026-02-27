# Arquitetura do Sistema — Agência de Marketing Digital

> Documento gerado em 2026-02-27 por análise do código-fonte (brownfield).
> Versão: 1.0 — carregado automaticamente por agentes para evitar re-análise.

---

## 1. Visão Geral do Sistema

### O que é
Sistema de gestão interna (SaaS interno) para agências de marketing digital. Permite gerenciar clientes, campanhas, equipe, tarefas, financeiro, calendário, relatórios, social media e agentes de IA de forma integrada.

### Quem usa
| Perfil | Descrição |
|--------|-----------|
| ADMIN | Dono ou sócio da agência — acesso total |
| MANAGER | Gerente de projetos — sem delete de financeiro, sem gerenciar usuários |
| MEMBER | Colaborador (designer, copywriter, social media) — acesso restrito às suas tarefas |

### Deployment
- **Desenvolvimento local:** Docker Compose (PostgreSQL) + `npm run dev` (backend porta 3333, frontend porta 3000)
- **Produção:** Railway (backend Node.js + PostgreSQL gerenciado)
- **Frontend:** Pode ser hospedado separadamente (Vercel/Railway), conecta via `NEXT_PUBLIC_API_URL`

### Arquitetura Geral
```
[Browser / Cliente]
        │
        ▼
[Next.js 14 - Frontend :3000]
   App Router + Tailwind + shadcn/ui
        │  HTTPS REST + WebSocket
        ▼
[Express API - Backend :3333]
   JWT Auth + Rate Limit + Helmet
        │
        ▼
[PostgreSQL :5432]
   via Prisma ORM
        │
   [Gemini API] ← Agentes IA (background)
   [Facebook API] ← Social media
```

---

## 2. Decisões Tecnológicas

### Backend
| Tecnologia | Justificativa |
|---|---|
| **Node.js + Express** | Ecosistema amplo, fácil de hospedar no Railway, baixa curva de aprendizado |
| **TypeScript** | Segurança de tipos em toda a aplicação, reduz bugs em runtime |
| **Prisma ORM** | Type-safe, migrations declarativas, geração automática de client, suporte excelente ao PostgreSQL |
| **PostgreSQL** | Banco relacional maduro, suporte a JSON (campo `items` em Budget), transações ACID |
| **JWT** | Autenticação stateless — ideal para SaaS sem estado de sessão no servidor |
| **bcrypt** | Hash seguro de senhas com salt automático |
| **Zod** | Validação de schema em runtime com inferência de tipos TypeScript |
| **Socket.io** | Chat em tempo real com rooms por userId e autenticação JWT |
| **Helmet** | Headers HTTP de segurança (CSP, HSTS, etc.) |
| **express-rate-limit** | Proteção contra brute force e abuso da API |
| **Gemini API** | LLM do Google para geração de conteúdo e agentes IA |

### Frontend
| Tecnologia | Justificativa |
|---|---|
| **Next.js 14 (App Router)** | SSR/CSR híbrido, roteamento baseado em sistema de arquivos, grupos de rotas para layouts |
| **Tailwind CSS** | Utilitário — desenvolvimento rápido, sem CSS customizado, consistência visual |
| **shadcn/ui** | Componentes acessíveis (base Radix UI), customizáveis via Tailwind, sem overhead de lib UI |
| **Axios** | Client HTTP com interceptors para injeção de token e tratamento de 401 automático |

---

## 3. Arquitetura do Backend

### Estrutura de Módulos
Cada funcionalidade é encapsulada em `backend/src/modules/<nome>/` com 4 arquivos:

```
<nome>/
├── <nome>.controller.ts   # Recebe req/res, delega ao service, retorna ApiResponse
├── <nome>.service.ts      # Lógica de negócio, acessa Prisma, valida regras de domínio
├── <nome>.routes.ts       # Declara rotas Express, aplica middlewares, instancia controller
└── <nome>.schema.ts       # Zod schemas para validação de input (body, params, query)
```

### Módulos implementados
`auth` | `dashboard` | `clients` | `campaigns` | `tasks` | `finance` | `reports` | `calendar` | `users` | `social` | `products` | `agents` | `chat` | `notifications`

### Cadeia de Middlewares (por requisição)
```
Request
  │
  ├─ helmet()              — Headers de segurança HTTP
  ├─ cors()                — CORS configurado para FRONTEND_URL + localhost
  ├─ express.json()        — Parse do body JSON (limite 10mb)
  ├─ rateLimit()           — 300 req / 15min (geral)
  │
  ├─ [Router específico]
  │     ├─ authMiddleware  — Verifica JWT no header Authorization: Bearer <token>
  │     ├─ requireRole()   — Verifica role do usuário (ADMIN / MANAGER / MEMBER)
  │     ├─ validate(schema) — Valida body/params com Zod
  │     └─ controller.*()  — Lógica de negócio
  │
  └─ errorHandler          — Middleware global de erros (último na chain)
```

### Middleware de Auth (`src/middlewares/auth.ts`)
- `authMiddleware`: extrai token do header `Authorization: Bearer <token>`, verifica com `jwt.verify()`, popula `req.user = { id, email, role }`
- `requireRole(...roles)`: verifica se `req.user.role` está na lista de roles permitidas, retorna 403 se não

### Middleware de Validação (`src/middlewares/validate.ts`)
Aplica `schema.parse(req.body)` via Zod. Em caso de `ZodError`, retorna 400 com lista de erros formatados.

### Padrão de Controller
```typescript
// Sempre: async, try/catch, delega ao service, retorna ApiResponse
export async function createClient(req: Request, res: Response) {
  try {
    const data = clientSchema.parse(req.body)
    const result = await clientService.create(data, req.user.id)
    return ApiResponse.success(res, result, 201)
  } catch (error) {
    return ApiResponse.error(res, error)
  }
}
```

### Agentes IA (`src/agents/`)
O backend possui um subsistema de agentes IA que roda em background:
- `scheduler.agent.ts` — Orquestrador que inicia todos os agentes ao subir o servidor (`startAllAgents()`)
- `gemini.ts` — Wrapper para a Gemini API com rotação de API keys
- `content-creator.agent.ts` — Geração de posts de conteúdo
- `content-strategist.agent.ts` — Estratégia de conteúdo
- `copywriter.agent.ts` — Redação de textos
- `metrics-analyzer.agent.ts` — Análise de métricas de social media
- `growth-analyst.agent.ts` — Insights de crescimento
- `trending-topics.agent.ts` — Pesquisa de tendências
- `comment-responder.agent.ts` — Resposta automática a comentários
- `product-orchestrator.agent.ts` — Orquestrador de campanhas de produto (TikTok Shop)
- `product-post-creator.agent.ts` — Criação de posts de produtos
- `tiktok-researcher.agent.ts` — Pesquisa de produtos TikTok
- `link-analyzer.agent.ts` — Análise de links de produtos
- `token-monitor.agent.ts` — Monitoramento de tokens de API
- `agent-logger.ts` — Logger de comunicação entre agentes (via Socket.io + `AgentLog` no banco)

### Socket.io (Chat em Tempo Real)
- Servidor HTTP compartilhado com Express
- Autenticação via token no `handshake.auth.token`
- Cada usuário entra em uma room `user:{userId}`
- Evento `chat:message` persiste no banco e emite para sender + receiver
- Agent logs são emitidos via Socket.io pelo `agent-logger`

---

## 4. Arquitetura do Frontend

### Grupos de Rotas (App Router)
```
src/app/
├── layout.tsx              # Root layout (HTML base, fontes, providers globais)
├── page.tsx                # Redireciona para /dashboard ou /login
├── (auth)/                 # Grupo sem sidebar — páginas públicas
│   ├── login/page.tsx
│   └── register/page.tsx
└── (dashboard)/            # Grupo protegido — layout com Sidebar + Header
    ├── layout.tsx          # DashboardLayout (verifica token, monta estrutura)
    ├── dashboard/page.tsx
    ├── clients/
    ├── campaigns/
    ├── tasks/
    ├── finance/
    ├── reports/
    ├── calendar/
    ├── team/
    ├── social/
    ├── products/
    ├── agents/
    ├── chat/
    └── settings/
```

### Hierarquia de Layouts
```
RootLayout (layout.tsx)
  └── DashboardLayout ((dashboard)/layout.tsx)   — 'use client', verifica token
        ├── Sidebar (componente)
        ├── Header (componente)
        └── {children}  — página específica
```

### Proteção de Rotas — Dupla Camada
O sistema usa duas camadas de proteção:

1. **Next.js Middleware** (`src/middleware.ts`) — Edge Runtime, executa em todas as requisições:
   - Lê token do **cookie** `token`
   - Redireciona `/` → `/dashboard` (autenticado) ou `/login` (não autenticado)
   - Bloqueia rotas protegidas sem token → redireciona para `/login`
   - Redireciona autenticado que acessa `/login` ou `/register` → `/dashboard`

2. **DashboardLayout** (`(dashboard)/layout.tsx`) — Client Component, executa no browser:
   - Lê token do **localStorage**
   - Redireciona para `/login` se não houver token
   - Exibe loading spinner enquanto verifica

> **Inconsistência detectada (dívida técnica):** O middleware usa cookie, o layout usa localStorage. O token precisa estar nos dois para a proteção funcionar corretamente. Ver seção Dívida Técnica.

### API Client (`src/lib/api.ts`)
- Instância Axios centralizada apontando para `NEXT_PUBLIC_API_URL`
- **Request interceptor:** injeta `Authorization: Bearer <token>` do localStorage automaticamente
- **Response interceptor:** em erro 401 (exceto login/register), limpa localStorage e redireciona para `/login`
- Usado em todos os hooks e componentes — nunca fazer fetch direto

### Padrão de Custom Hooks
```typescript
// src/hooks/use<Módulo>.ts
export function useClients() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchClients = useCallback(async () => {
    try {
      const res = await api.get('/clients')
      setClients(res.data.data)
    } catch (err) {
      setError('Erro ao carregar clientes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchClients() }, [fetchClients])
  return { clients, loading, error, refetch: fetchClients }
}
```

---

## 5. Arquitetura do Banco de Dados

### Modelos e Relacionamentos

```
User ──────────────────────────────────────────┐
  │                                             │
  ├─ tasks[]          (Task.assigneeId)         │
  ├─ calendarEvents[] (CalendarEvent.userId)    │
  ├─ sentMessages[]   (Message.senderId)        │
  ├─ receivedMessages[] (Message.receiverId)    │
  └─ notifications[]  (Notification.userId)     │
                                                │
Client ──────────────────────────────────────┐ │
  ├─ campaigns[]  (Campaign.clientId)         │ │
  ├─ budgets[]    (Budget.clientId)           │ │
  └─ invoices[]   (Invoice.clientId)          │ │
                                              │ │
Campaign ────────────────────────────────┐   │ │
  ├─ tasks[]       (Task.campaignId)     │   │ │
  ├─ budgets[]     (Budget.campaignId)   │   │ │
  └─ calendarEvents[] (CalendarEvent.campaignId) │ │
                                         │   │ │
Budget ──────────────────────────────┐   │   │ │
  └─ invoices[]  (Invoice.budgetId)  │   │   │ │
                                     │   │   │ │
Task ────────────────────────────────┘   │   │ │
  ├─ assignee (User?)                    │   │ │
  └─ campaign (Campaign?)                │   │ │
```

### Enums
| Enum | Valores |
|------|---------|
| `Role` | ADMIN, MANAGER, MEMBER |
| `ClientStatus` | ACTIVE, INACTIVE, LEAD |
| `CampaignStatus` | PLANNING, ACTIVE, PAUSED, COMPLETED, CANCELLED |
| `TaskStatus` | TODO, IN_PROGRESS, DONE |
| `TaskPriority` | LOW, MEDIUM, HIGH, URGENT |
| `BudgetStatus` | DRAFT, SENT, APPROVED, REJECTED |
| `InvoiceStatus` | PENDING, PAID, OVERDUE, CANCELLED |
| `EventType` | MEETING, DEADLINE, DELIVERY, OTHER |
| `ScheduledPostStatus` | PENDING, APPROVED, REJECTED, PUBLISHED, FAILED |
| `ProductCampaignStatus` | PENDING, SCHEDULED, PUBLISHED, PAUSED |

### Modelos de Negócio Core
| Modelo | Tabela | Notas |
|--------|--------|-------|
| `User` | `users` | id CUID, role padrão MEMBER |
| `Client` | `clients` | CRM básico, email opcional |
| `Campaign` | `campaigns` | Sempre vinculada a Client (Cascade delete) |
| `Task` | `tasks` | assignee e campaign opcionais (SetNull on delete) |
| `Budget` | `budgets` | items como JSON array, total Float |
| `Invoice` | `invoices` | vinculada a Client obrigatório, Budget opcional |
| `CalendarEvent` | `calendar_events` | description já implementada no schema |

### Modelos de Agentes IA (adicionados posteriormente)
| Modelo | Tabela | Propósito |
|--------|--------|-----------|
| `ScheduledPost` | `scheduled_posts` | Posts agendados para redes sociais |
| `CommentLog` | `comment_logs` | Log de respostas automáticas a comentários |
| `MetricsReport` | `metrics_reports` | Relatórios de métricas gerados por IA |
| `ProductCampaign` | `product_campaigns` | Campanhas de produtos (TikTok Shop) |
| `AgentLog` | `agent_logs` | Log de comunicação entre agentes IA |

### Convenções do Banco
- IDs: `cuid()` em todos os modelos
- Timestamps: `createdAt @default(now())`, `updatedAt @updatedAt` em todos
- Delete behavior: `Cascade` para dependência forte, `SetNull` para dependência fraca
- Nomes de tabela: snake_case via `@@map()`

---

## 6. Design da API

### Convenções REST
- Prefixo global: `/api`
- Recursos no plural: `/api/clients`, `/api/campaigns`
- Sub-recursos: `/api/finance/budgets`, `/api/finance/invoices`
- Ações específicas via PATCH + sufixo: `PATCH /api/tasks/:id/status`
- Health check: `GET /api/health`

### Cabeçalhos de Autenticação
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Formato Padrão de Resposta (`ApiResponse`)
```typescript
// Sucesso
{ success: true, message: "Success", data: <payload> }

// Criado (201)
{ success: true, message: "Created successfully", data: <payload> }

// Erro
{ success: false, message: "mensagem de erro", error: <detalhes | null> }

// HTTP Status codes usados:
// 200 — OK
// 201 — Created
// 400 — Bad Request (validação Zod)
// 401 — Unauthorized (sem token ou token inválido)
// 403 — Forbidden (role insuficiente)
// 404 — Not Found
// 500 — Internal Server Error
```

### Rate Limits
| Rota | Limite |
|------|--------|
| Global | 300 req / 15 min |
| `POST /api/auth/login` | 10 req / 15 min |
| `POST /api/auth/register` | 5 req / hora |

---

## 7. Arquitetura de Segurança

### Fluxo JWT Completo
```
1. POST /api/auth/login { email, password }
   └─ bcrypt.compare(password, hash)
   └─ jwt.sign({ id, email, role }, JWT_SECRET, { expiresIn: '7d' })
   └─ Retorna { token, user }

2. Frontend armazena token em localStorage (e deveria salvar também em cookie)

3. Cada requisição:
   └─ axios interceptor injeta: Authorization: Bearer <token>
   └─ authMiddleware verifica e popula req.user

4. Em 401:
   └─ axios interceptor limpa localStorage → redireciona para /login
```

### Controle de Acesso por Role (RBAC)
```typescript
// Exemplo de rota com RBAC
router.delete('/:id', requireRole('ADMIN'), controller.delete)
router.post('/', requireRole('ADMIN', 'MANAGER'), controller.create)
router.get('/', authMiddleware, controller.findAll)  // todos autenticados
```

| Ação | ADMIN | MANAGER | MEMBER |
|------|-------|---------|--------|
| Delete de qualquer recurso | ✅ | ❌ | ❌ |
| Criar/editar clientes, campanhas | ✅ | ✅ | ❌ |
| Atualizar status de tarefa | ✅ | ✅ | ✅ |
| Ver financeiro | ✅ | ✅ | ❌ |
| Gerenciar usuários | ✅ | ❌ | ❌ |
| Ver lista de usuários | ✅ | ✅ | ❌ |
| Publicar posts sociais | ✅ | ✅ | ❌ |
| Rodar agentes IA | ✅ | ✅ | ❌ |

### Headers de Segurança
Helmet configura automaticamente:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security`
- `Content-Security-Policy` (padrão Helmet)

### CORS
Origens permitidas explicitamente: `FRONTEND_URL` (env), `http://localhost:3000`, `http://localhost:3001`
Credenciais: habilitadas (`credentials: true`)

---

## 8. Estado Atual da Implementação

### Implementado e funcionando
- [x] Autenticação completa (register, login, JWT, bcrypt, me, updateProfile)
- [x] CRUD completo: Clients, Campaigns, Tasks, Finance (Budgets + Invoices), Calendar, Users
- [x] Dashboard com KPIs agregados
- [x] Relatórios (receita, performance de campanhas, ranking de clientes)
- [x] Chat em tempo real (Socket.io, persist no banco, rooms por userId)
- [x] Notificações (modelo no banco, rotas REST)
- [x] Social media dashboard (Facebook API: página, insights, posts, comentários, agendamento)
- [x] Módulo Produtos IA (CRUD de ProductCampaign, análise de links)
- [x] Agentes IA completos (15 agentes: content, metrics, TikTok Shop, trending, etc.)
- [x] Sistema de rate limit (global + específico para login/register)
- [x] Middleware de validação Zod centralizado
- [x] Middleware de RBAC por role
- [x] Schema Prisma completo com todos os modelos
- [x] Socket.io com autenticação JWT

### Possivelmente incompleto ou não verificado
- [ ] Frontend: páginas de `social/`, `products/`, `agents/`, `chat/`, `settings/` (não verificadas)
- [ ] Exportação de relatórios em PDF/CSV (PRD menciona como futuro)
- [ ] Drag-and-drop no Kanban (PRD menciona, requer verificação no frontend)
- [ ] Upload de mídia (`upload` middleware existe nas rotas de agentes)
- [ ] Página de detalhe de cliente com histórico de campanhas e faturas (PRD exige)

---

## 9. Dívida Técnica

### Alta Prioridade

**1. Inconsistência de armazenamento do token (cookie vs localStorage)**
- `middleware.ts` lê token do **cookie**
- `DashboardLayout` lê token do **localStorage**
- `api.ts` lê token do **localStorage**
- **Problema:** Se o token só está no localStorage (comportamento padrão do login), o Next.js middleware Edge sempre vai redirecionar como se o usuário não estivesse autenticado
- **Solução:** No login, salvar token tanto no localStorage quanto em cookie (`document.cookie`), ou migrar tudo para cookies HttpOnly

**2. `(req as any)` generalizado nos módulos social e agents**
- Vários controllers fazem cast `req as any` para contornar tipagem
- Indica que o tipo `AuthRequest` não está sendo importado/estendido corretamente nesses módulos
- **Solução:** Importar e usar `AuthRequest` de `src/types` consistentemente

**3. Validação de role no controller em vez do middleware (alguns módulos)**
- Módulo `clients`: não usa `requireRole` na rota — delega a verificação para o controller ou service
- **Risco:** Lógica de permissão dispersa e menos visível
- **Solução:** Padronizar `requireRole()` sempre nas rotas, não nos controllers

### Média Prioridade

**4. `JWT_SECRET` lido duas vezes**
- `server.ts` e `middlewares/auth.ts` leem `process.env.JWT_SECRET` independentemente
- Sem problema funcional, mas `server.ts` já valida a existência no boot

**5. `prisma` importado em `server.ts` para o Socket.io**
- O handler de Socket.io no `server.ts` acessa o Prisma diretamente em vez de usar um service
- Viola a separação controller → service → Prisma

**6. Ausência de refresh token**
- Token JWT com expiração de 7 dias, sem mecanismo de refresh
- Usuário é deslogado abruptamente após 7 dias
- **Solução futura:** Implementar refresh token com rotação

### Baixa Prioridade

**7. `console.error` direto no Socket.io**
- `[Socket] chat:message error:` logado diretamente, sem estruturação
- Deveria usar um logger estruturado (Winston/Pino)

**8. Sem testes automatizados**
- Não foram encontrados arquivos de teste (`.spec.ts`, `.test.ts`)
- Sistema crítico sem cobertura de testes

---

## 10. Log de Decisões Arquiteturais

| # | Decisão | Motivo | Consequência |
|---|---------|--------|--------------|
| ADR-01 | Módulos por domínio (controller/service/routes/schema) | Separação de responsabilidades, fácil de localizar código | Adicionar módulo = criar 4 arquivos padrão |
| ADR-02 | ApiResponse como classe estática | Consistência de resposta em todos os endpoints | Todos os controllers devem importar e usar ApiResponse |
| ADR-03 | Prisma singleton em `database.ts` | Evitar múltiplas conexões ao PostgreSQL | Nunca instanciar PrismaClient diretamente nos módulos |
| ADR-04 | Zod para validação de input | Type-safe em runtime, integra com TypeScript | Schemas Zod devem existir para todos os inputs críticos |
| ADR-05 | JWT stateless (sem blacklist) | Simplicidade, sem necessidade de Redis | Tokens não podem ser invalidados antes da expiração |
| ADR-06 | Socket.io no mesmo processo Express | Simplicidade de deploy | Escalar horizontalmente requer sticky sessions ou Redis adapter |
| ADR-07 | Agentes IA como background tasks no mesmo processo | Evitar infraestrutura de filas (BullMQ/Redis) | Agentes consomem CPU/memória do mesmo servidor da API |
| ADR-08 | Gemini com rotação de API keys | Contornar rate limits da API do Google | Complexidade na gestão de keys, implementado em `gemini.ts` |
| ADR-09 | App Router do Next.js com grupos `(auth)` e `(dashboard)` | Layouts diferentes por grupo de rotas sem impactar URL | Layout do dashboard é Client Component (precisa verificar localStorage) |
| ADR-10 | RBAC via middleware `requireRole` nas rotas | Centralizar permissões na camada de roteamento | Deve ser aplicado consistentemente (ver dívida técnica #3) |
| ADR-11 | `Budget.items` como campo JSON | Itens de orçamento têm estrutura variável sem modelo próprio | Sem validação de schema nos itens no banco; validar via Zod no service |
| ADR-12 | Railway para deploy de produção | PaaS simples, suporte nativo a Node.js e PostgreSQL | Sem controle de infraestrutura, limitações de plano free |

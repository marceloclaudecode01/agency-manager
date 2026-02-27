# Source Tree — Agência de Marketing Digital

## Raiz do Projeto
```
test/
├── backend/           # API Node.js + Express + Prisma
├── frontend/          # Next.js 14 App Router
├── docs/              # Documentação AIOS
│   ├── framework/     # tech-stack, coding-standards, source-tree (este arquivo)
│   ├── prd/           # Product Requirements (sharded)
│   ├── architecture/  # Decisões de arquitetura
│   ├── stories/       # User stories (epicN.storyN.story.md)
│   └── qa/            # Relatórios de QA
├── .aios-core/        # Framework AIOS v2.1.0
├── .aios/             # Estado live do projeto AIOS
├── .claude/           # Configurações Claude Code (rules, commands)
├── docker-compose.yml # PostgreSQL local
├── PRD.md             # PRD original do projeto
└── CLAUDE.md          # Instruções para Claude Code
```

---

## Backend (`backend/`)
```
backend/
├── prisma/
│   └── schema.prisma          # Schema do banco (modelos, relações, enums)
├── src/
│   ├── server.ts              # Entry point Express
│   ├── config/
│   │   └── database.ts        # Prisma client singleton
│   ├── middlewares/
│   │   └── auth.ts            # JWT authenticate middleware
│   ├── utils/
│   │   └── api-response.ts    # ApiResponse.success() / .error()
│   ├── types/                 # Tipos TypeScript globais
│   └── modules/
│       ├── auth/              # Login, register, JWT
│       ├── dashboard/         # KPIs e agregações
│       ├── clients/           # CRM de clientes
│       ├── campaigns/         # Gestão de campanhas
│       ├── tasks/             # Kanban de tarefas
│       ├── finance/           # Orçamentos e faturas
│       ├── reports/           # Relatórios e métricas
│       ├── calendar/          # Eventos e agenda
│       ├── users/             # Gestão de equipe
│       ├── social/            # Dashboard social media
│       ├── products/          # Módulo Produtos IA
│       ├── chat/              # Chat interno
│       ├── notifications/     # Sistema de notificações
│       └── agents/            # Agentes IA (TikTok Shop, etc.)
└── package.json
```

---

## Frontend (`frontend/`)
```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx               # Root layout
│   │   ├── page.tsx                 # Redirect para dashboard
│   │   ├── (auth)/                  # Grupo sem sidebar
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   └── (dashboard)/             # Grupo com layout sidebar+header
│   │       ├── layout.tsx           # Sidebar + Header compartilhados
│   │       ├── dashboard/page.tsx   # KPIs e visão geral
│   │       ├── clients/             # CRM
│   │       ├── campaigns/           # Campanhas
│   │       ├── tasks/               # Kanban
│   │       ├── finance/             # Financeiro
│   │       ├── reports/             # Relatórios
│   │       ├── calendar/            # Calendário
│   │       ├── team/                # Equipe
│   │       ├── social/              # Social media dashboard
│   │       ├── products/            # Produtos IA
│   │       ├── agents/              # Agentes IA
│   │       ├── chat/                # Chat
│   │       └── settings/            # Configurações
│   ├── components/
│   │   ├── ui/                      # shadcn/ui base
│   │   └── <módulo>/                # Componentes por módulo
│   ├── hooks/                       # Custom hooks (useClients, useCampaigns, etc.)
│   ├── contexts/                    # Contextos React (AuthContext, etc.)
│   ├── lib/
│   │   └── api.ts                   # API client centralizado (axios/fetch)
│   ├── types/                       # Interfaces TypeScript
│   └── middleware.ts                # Next.js middleware (auth redirect)
└── package.json
```

---

## Modelos do Banco (Prisma)

Principais entidades:
- `User` — com roles: ADMIN | MANAGER | MEMBER
- `Client` — status: ACTIVE | INACTIVE | LEAD
- `Campaign` — status: PLANNING | ACTIVE | PAUSED | COMPLETED | CANCELLED
- `Task` — status: TODO | IN_PROGRESS | DONE | priority: LOW | MEDIUM | HIGH | URGENT
- `Budget` — status: DRAFT | SENT | APPROVED | REJECTED
- `Invoice` — status: PENDING | PAID | OVERDUE | CANCELLED
- `CalendarEvent` — tipo: MEETING | DEADLINE | DELIVERY | OTHER

---

## Arquivos Críticos (não modificar sem story)

| Arquivo | Motivo |
|---|---|
| `backend/prisma/schema.prisma` | Qualquer alteração requer migration |
| `backend/src/config/database.ts` | Singleton do Prisma — deve ser único |
| `backend/src/utils/api-response.ts` | Padrão de resposta usado em todos os módulos |
| `frontend/src/lib/api.ts` | Client centralizado — alterações afetam todo o frontend |
| `frontend/src/middleware.ts` | Controle de auth/redirect do Next.js |

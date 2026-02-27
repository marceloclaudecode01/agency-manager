# CLAUDE.md — Agência de Marketing Digital

## Projeto
Sistema de gestão para agência de marketing digital.
Stack: Node.js + Express + TypeScript + Prisma + PostgreSQL (backend) | Next.js 14 + Tailwind + shadcn/ui (frontend)

---

<!-- AIOS-MANAGED-START: core-framework -->
## Framework AIOS

Este projeto usa **Synkra AIOS v2.1.0** para orquestrar o desenvolvimento via agentes.

### Ativar agentes
```
@aios-master   Orquestrador geral (sem restrições)
@analyst       Pesquisa e análise de mercado
@architect     Arquitetura de sistema
@data-engineer Banco de dados / Prisma / migrações
@dev           Implementação full stack
@devops        Git push, CI/CD, PRs (EXCLUSIVO para push)
@pm            Product Manager / PRD / épicos
@po            Product Owner / validação de stories
@qa            QA / testes / gates de qualidade
@sm            Scrum Master / criação de stories
@ux-design-expert UX/UI / design system
```

Comandos usam prefixo `*` (ex: `@dev *develop story-001`)

### Fluxo padrão para cada feature
```
@sm *draft → @po *validate-story-draft → @dev *develop {id} → @qa *gate {id} → @devops *push
```
<!-- AIOS-MANAGED-END: core-framework -->

---

## Arquivos carregados automaticamente pelo @dev

O agente `@dev` carrega estes 3 arquivos ao iniciar — nunca precisa reexplicar a stack:
- `docs/framework/tech-stack.md`
- `docs/framework/coding-standards.md`
- `docs/framework/source-tree.md`

---

## Estrutura de Documentação

```
docs/
├── framework/      # tech-stack, coding-standards, source-tree
├── prd/            # PRD sharded por épico
├── architecture/   # Decisões de arquitetura
├── stories/        # Stories (epicN.storyN.story.md)
└── qa/             # Relatórios QA
```

---

## Padrões de Código

### Backend
- Módulos em `src/modules/<nome>/` com: controller, service, routes, schema
- Controllers: recebem req/res, chamam service, retornam ApiResponse
- Services: lógica de negócio, chamam Prisma
- Schemas: validação Zod para input
- Prisma client singleton em `src/config/database.ts`
- Respostas via `src/utils/api-response.ts`

### Frontend
- App Router do Next.js 14
- Grupo `(auth)` para login/register
- Grupo `(dashboard)` com layout compartilhado (sidebar + header)
- Componentes em `src/components/<módulo>/`
- API client centralizado em `src/lib/api.ts`
- Custom hooks em `src/hooks/`

---

## Regras de Autoridade dos Agentes

| Operação | Agente |
|---|---|
| `git push`, criar PR | `@devops` EXCLUSIVO |
| Criar stories | `@sm` EXCLUSIVO |
| Validar stories (Draft→Ready) | `@po` EXCLUSIVO |
| Criar épicos / PRD | `@pm` EXCLUSIVO |
| Arquitetura de sistema | `@architect` |
| Schema / migrações Prisma | `@data-engineer` |
| Implementação de código | `@dev` |

---

## Economia de Tokens

- Agentes NÃO carregam arquivos ao iniciar — só sob demanda via comando
- Knowledge base pesada (`*kb`) só carrega se você digitar `*kb`
- Os 3 arquivos de `docs/framework/` eliminam re-explicação de stack a cada sessão
- Stories definem escopo exato — `@dev` não inventa ou extrapola

---

## Variáveis de Ambiente

### Backend (`backend/.env`)
```
DATABASE_URL=postgresql://agency:agency123@localhost:5432/agency_db
JWT_SECRET=super-secret-key-change-in-production
PORT=3333
```

### Frontend (`frontend/.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:3333/api
```

---

## Comandos Úteis

```bash
# Docker (PostgreSQL)
docker compose up -d

# Backend
cd backend && npm run dev      # porta 3333

# Frontend
cd frontend && npm run dev     # porta 3000
```

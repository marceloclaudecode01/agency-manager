# CLAUDE.md — Guia para Claude Code

## Projeto
Sistema de gestão para agência de marketing digital.

## Stack
- **Backend:** Node.js + Express + TypeScript + Prisma + PostgreSQL
- **Frontend:** Next.js 14 (App Router) + Tailwind CSS + shadcn/ui
- **Auth:** JWT + bcrypt
- **Validação:** Zod
- **Banco:** PostgreSQL via Docker

## Comandos Úteis

```bash
# Backend
cd backend && npm install
npx prisma generate
npx prisma db push
npm run dev          # porta 3333

# Frontend
cd frontend && npm install
npm run dev          # porta 3000

# Docker (PostgreSQL)
docker compose up -d
```

## Padrões de Código

### Backend
- Módulos em `src/modules/<nome>/` com: controller, service, routes, schema
- Controllers: recebem req/res, chamam service, retornam response padronizada
- Services: lógica de negócio, chamam Prisma
- Schemas: validação Zod para input
- Prisma client singleton em `src/config/database.ts`
- Respostas via `src/utils/api-response.ts` (success/error padronizado)

### Frontend
- App Router do Next.js 14
- Grupo `(auth)` para login/register
- Grupo `(dashboard)` com layout compartilhado (sidebar + header)
- Componentes em `src/components/<módulo>/`
- API client centralizado em `src/lib/api.ts`
- Custom hooks em `src/hooks/`

## Variáveis de Ambiente

### Backend (.env)
```
DATABASE_URL=postgresql://agency:agency123@localhost:5432/agency_db
JWT_SECRET=super-secret-key-change-in-production
PORT=3333
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:3333/api

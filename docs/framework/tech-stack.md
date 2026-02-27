# Tech Stack — Agência de Marketing Digital

## Visão Geral

Sistema de gestão para agências de marketing digital (SaaS interno).

---

## Backend

| Tecnologia | Versão | Uso |
|---|---|---|
| Node.js | 18+ | Runtime |
| TypeScript | 5+ | Linguagem |
| Express | 4+ | Framework HTTP |
| Prisma | 5+ | ORM / client de banco |
| PostgreSQL | 15+ | Banco de dados relacional |
| JWT (jsonwebtoken) | — | Autenticação stateless |
| bcrypt | — | Hash de senhas |
| Zod | — | Validação de input |

**Porta:** `3333`
**Entry point:** `backend/src/server.ts`
**Prisma schema:** `backend/prisma/schema.prisma`

---

## Frontend

| Tecnologia | Versão | Uso |
|---|---|---|
| Next.js | 14 (App Router) | Framework React |
| React | 18 | UI |
| TypeScript | 5+ | Linguagem |
| Tailwind CSS | 3+ | Estilização utilitária |
| shadcn/ui | — | Componentes UI (Radix base) |

**Porta:** `3000`
**Roteamento:** App Router (`src/app/`)

---

## Infraestrutura

| Serviço | Uso |
|---|---|
| Docker Compose | PostgreSQL local (`docker-compose.yml`) |
| Railway | Deploy em produção (backend + DB) |

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

## Comandos de Desenvolvimento

```bash
# Subir PostgreSQL
docker compose up -d

# Backend
cd backend
npm install
npx prisma generate
npx prisma db push
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

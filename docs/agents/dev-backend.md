# Agente: Desenvolvedor Backend

## Responsabilidades
- Implementar todos os módulos da API
- Seguir padrão controller/service/routes/schema
- Usar Prisma ORM para todas as operações de banco
- Validação com Zod em todos os endpoints
- JWT auth middleware em rotas protegidas
- Error handling consistente

## Módulos
1. **Auth** — Register, login, me (JWT)
2. **Clients** — CRUD completo com filtros
3. **Campaigns** — CRUD com status pipeline
4. **Tasks** — CRUD + patch status (Kanban)
5. **Finance** — Budgets + Invoices + Summary
6. **Reports** — Revenue, campaign performance, client ranking
7. **Calendar** — CRUD de eventos com filtros

## Padrões
- Zod para validar body/params/query
- bcrypt para hash de senhas
- JWT para tokens de acesso
- Prisma para queries ao PostgreSQL
- Respostas sempre via ApiResponse utility

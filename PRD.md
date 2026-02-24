# PRD — Sistema de Gestão para Agência de Marketing

## Visão Geral

Sistema completo de gestão interna para agências de marketing digital. Permite gerenciar clientes, campanhas, tarefas da equipe, finanças, relatórios e calendário em uma interface premium e moderna.

## Público-Alvo

- Donos de agências de marketing
- Gerentes de projeto
- Membros da equipe (designers, copywriters, social media, etc.)

## Perfis de Usuário

| Perfil  | Permissões                                                    |
|---------|---------------------------------------------------------------|
| ADMIN   | Acesso total: CRUD em tudo, gerenciar usuários, ver finanças |
| MANAGER | Gerenciar clientes, campanhas, tarefas, ver relatórios       |
| MEMBER  | Ver tarefas atribuídas, atualizar status, ver calendário     |

## Módulos

### 1. Autenticação (Auth)
- Registro de novos usuários (nome, email, senha, perfil)
- Login com email e senha
- JWT para sessão (access token)
- Hash de senha com bcrypt
- Middleware de autenticação em rotas protegidas

### 2. Dashboard
- KPIs: total de clientes ativos, campanhas ativas, tarefas pendentes, receita mensal
- Gráfico de receita dos últimos 6 meses
- Lista de campanhas ativas com progresso
- Tarefas pendentes do usuário logado
- Últimos clientes cadastrados

### 3. Clientes (CRM)
- Listagem com busca e filtro por status
- Cadastro: nome, email, telefone, empresa, notas
- Edição e exclusão
- Status: ACTIVE, INACTIVE, LEAD
- Página de detalhe com histórico de campanhas e faturas

### 4. Campanhas
- Listagem com filtros por status e cliente
- Cadastro: nome, cliente, datas, orçamento, metas, descrição
- Status pipeline: PLANNING → ACTIVE → PAUSED → COMPLETED → CANCELLED
- Página de detalhe com tarefas vinculadas e métricas
- Associação com cliente obrigatória

### 5. Tarefas (Kanban)
- Board estilo Kanban: TODO, IN_PROGRESS, DONE
- Criar tarefa: título, descrição, prioridade, responsável, campanha, prazo
- Drag-and-drop entre colunas (visual)
- Prioridades: LOW, MEDIUM, HIGH, URGENT
- Filtrar por campanha, responsável, prioridade

### 6. Financeiro
- Orçamentos (Budgets): criar vinculado a cliente/campanha, com título e itens detalhados (descrição + valor), status DRAFT/SENT/APPROVED/REJECTED
- Faturas (Invoices): gerar a partir de orçamento aprovado, status PENDING/PAID/OVERDUE/CANCELLED
- Visão geral: receita total, despesas, lucro, faturas pendentes
- Filtro por período e cliente

### 7. Relatórios
- Receita por período (mensal, trimestral, anual)
- Performance por campanha (tarefas concluídas vs total)
- Clientes mais rentáveis
- Exportação em JSON (futuramente PDF/CSV)

### 8. Calendário
- Visão mensal e semanal
- Tipos de evento: MEETING, DEADLINE, DELIVERY, OTHER
- Criar evento com: título, descrição, tipo, data, data de término (opcional), campanha (opcional), usuário responsável (opcional)
- Cores por tipo de evento

### 9. Usuários (Gestão de Equipe)
- Listagem de todos os usuários da agência (ADMIN e MANAGER)
- Criar novo usuário (ADMIN)
- Editar perfil e role de usuário (ADMIN)
- Remover usuário (ADMIN)
- Ver perfil próprio e editar dados pessoais (todos)

## API Endpoints

### Auth
- `POST /api/auth/register` — Criar conta
- `POST /api/auth/login` — Login
- `GET /api/auth/me` — Perfil do usuário logado
- `PUT /api/auth/me` — Atualizar perfil próprio

### Dashboard
- `GET /api/dashboard/summary` — KPIs agregados: clientes ativos, campanhas ativas, tarefas pendentes, receita mensal, receita dos últimos 6 meses, campanhas recentes, tarefas do usuário logado

### Clients
- `GET /api/clients` — Listar clientes (filtros: status, busca por nome)
- `GET /api/clients/:id` — Detalhe do cliente (inclui campanhas e faturas)
- `POST /api/clients` — Criar cliente *(ADMIN, MANAGER)*
- `PUT /api/clients/:id` — Atualizar cliente *(ADMIN, MANAGER)*
- `DELETE /api/clients/:id` — Remover cliente *(ADMIN)*

### Campaigns
- `GET /api/campaigns` — Listar campanhas (filtros: status, clientId)
- `GET /api/campaigns/:id` — Detalhe da campanha (inclui tarefas e orçamentos)
- `POST /api/campaigns` — Criar campanha *(ADMIN, MANAGER)*
- `PUT /api/campaigns/:id` — Atualizar campanha *(ADMIN, MANAGER)*
- `DELETE /api/campaigns/:id` — Remover campanha *(ADMIN)*

### Tasks
- `GET /api/tasks` — Listar tarefas (filtros: status, assigneeId, campaignId, priority)
- `GET /api/tasks/:id` — Detalhe da tarefa
- `POST /api/tasks` — Criar tarefa *(ADMIN, MANAGER)*
- `PUT /api/tasks/:id` — Atualizar tarefa *(ADMIN, MANAGER)*
- `PATCH /api/tasks/:id/status` — Atualizar apenas status *(todos)*
- `DELETE /api/tasks/:id` — Remover tarefa *(ADMIN)*

### Finance
- `GET /api/finance/budgets` — Listar orçamentos (filtros: status, clientId)
- `GET /api/finance/budgets/:id` — Detalhe do orçamento
- `POST /api/finance/budgets` — Criar orçamento *(ADMIN, MANAGER)*
- `PUT /api/finance/budgets/:id` — Atualizar orçamento *(ADMIN, MANAGER)*
- `DELETE /api/finance/budgets/:id` — Remover orçamento *(ADMIN)*
- `GET /api/finance/invoices` — Listar faturas (filtros: status, clientId)
- `GET /api/finance/invoices/:id` — Detalhe da fatura
- `POST /api/finance/invoices` — Criar fatura *(ADMIN, MANAGER)*
- `PUT /api/finance/invoices/:id` — Atualizar fatura *(ADMIN, MANAGER)*
- `DELETE /api/finance/invoices/:id` — Remover fatura *(ADMIN)*
- `GET /api/finance/summary` — Resumo financeiro *(ADMIN, MANAGER)*

### Reports
- `GET /api/reports/revenue` — Receita por período *(ADMIN, MANAGER)*
- `GET /api/reports/campaigns` — Performance das campanhas *(ADMIN, MANAGER)*
- `GET /api/reports/clients` — Ranking de clientes *(ADMIN, MANAGER)*

### Calendar
- `GET /api/calendar` — Listar eventos (filtro por mês/ano)
- `GET /api/calendar/:id` — Detalhe do evento
- `POST /api/calendar` — Criar evento *(ADMIN, MANAGER)*
- `PUT /api/calendar/:id` — Atualizar evento *(ADMIN, MANAGER)*
- `DELETE /api/calendar/:id` — Remover evento *(ADMIN, MANAGER)*

### Users
- `GET /api/users` — Listar usuários da equipe *(ADMIN, MANAGER)*
- `GET /api/users/:id` — Detalhe de um usuário *(ADMIN, MANAGER)*
- `PUT /api/users/:id` — Atualizar usuário (role, nome, etc.) *(ADMIN)*
- `DELETE /api/users/:id` — Remover usuário *(ADMIN)*

## Permissões por Role

| Ação                          | ADMIN | MANAGER | MEMBER |
|-------------------------------|-------|---------|--------|
| Ver dashboard                 | ✅    | ✅      | ✅     |
| CRUD clientes                 | ✅    | ✅ (sem delete) | ❌ |
| CRUD campanhas                | ✅    | ✅ (sem delete) | ❌ |
| Criar/editar tarefas          | ✅    | ✅      | ❌     |
| Atualizar status de tarefa    | ✅    | ✅      | ✅     |
| Ver/criar financeiro          | ✅    | ✅      | ❌     |
| Deletar registros financeiros | ✅    | ❌      | ❌     |
| Ver relatórios                | ✅    | ✅      | ❌     |
| Gerenciar usuários            | ✅    | ❌      | ❌     |
| Ver lista de usuários         | ✅    | ✅      | ❌     |
| CRUD calendário               | ✅    | ✅      | ❌     |
| Ver calendário                | ✅    | ✅      | ✅     |

## Schema — Campos Adicionais

Os seguintes campos devem ser adicionados ao schema Prisma (não estão no código original):

- `Budget`: adicionar `title String` (nome/título do orçamento)
- `CalendarEvent`: adicionar `description String?`

## Requisitos Não-Funcionais

- Interface responsiva (mobile-first)
- Paleta premium para agência de marketing
- Tipografia profissional (Inter / Plus Jakarta Sans)
- Animações sutis de transição
- Loading states em todas as ações assíncronas
- Tratamento de erros com mensagens amigáveis
- Validação no frontend e backend

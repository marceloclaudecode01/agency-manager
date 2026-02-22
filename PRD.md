# PRD — Sistema de Gestão para Agência de Marketing

## Visão Geral

Sistema completo de gestão interna para agências de marketing digital. Permite gerenciar clientes, campanhas, tarefas da equipe, finanças, relatórios e calendário em uma interface premium e moderna.

## Público-Alvo

- Donos de agências de marketing
- Gerentes de projeto
- Membros da equipe (designers, copywriters, social media, etc.)

## Perfis de Usuário

| Perfil    | Permissões                                                    |
|-----------|---------------------------------------------------------------|
| ADMIN     | Acesso total: CRUD em tudo, gerenciar usuários, ver finanças |
| MANAGER   | Gerenciar clientes, campanhas, tarefas, ver relatórios       |
| MEMBER    | Ver tarefas atribuídas, atualizar status, ver calendário     |

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
- Orçamentos (Budgets): criar vinculado a cliente/campanha, itens com valor, status DRAFT/SENT/APPROVED/REJECTED
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
- Criar evento vinculado a campanha e/ou usuário
- Cores por tipo de evento

## API Endpoints

### Auth
- `POST /api/auth/register` — Criar conta
- `POST /api/auth/login` — Login
- `GET /api/auth/me` — Perfil do usuário logado

### Clients
- `GET /api/clients` — Listar clientes
- `GET /api/clients/:id` — Detalhe do cliente
- `POST /api/clients` — Criar cliente
- `PUT /api/clients/:id` — Atualizar cliente
- `DELETE /api/clients/:id` — Remover cliente

### Campaigns
- `GET /api/campaigns` — Listar campanhas
- `GET /api/campaigns/:id` — Detalhe da campanha
- `POST /api/campaigns` — Criar campanha
- `PUT /api/campaigns/:id` — Atualizar campanha
- `DELETE /api/campaigns/:id` — Remover campanha

### Tasks
- `GET /api/tasks` — Listar tarefas (filtros: status, assignee, campaign)
- `GET /api/tasks/:id` — Detalhe da tarefa
- `POST /api/tasks` — Criar tarefa
- `PUT /api/tasks/:id` — Atualizar tarefa
- `PATCH /api/tasks/:id/status` — Atualizar apenas status
- `DELETE /api/tasks/:id` — Remover tarefa

### Finance
- `GET /api/finance/budgets` — Listar orçamentos
- `POST /api/finance/budgets` — Criar orçamento
- `PUT /api/finance/budgets/:id` — Atualizar orçamento
- `GET /api/finance/invoices` — Listar faturas
- `POST /api/finance/invoices` — Criar fatura
- `PUT /api/finance/invoices/:id` — Atualizar fatura
- `GET /api/finance/summary` — Resumo financeiro

### Reports
- `GET /api/reports/revenue` — Receita por período
- `GET /api/reports/campaigns` — Performance das campanhas
- `GET /api/reports/clients` — Ranking de clientes

### Calendar
- `GET /api/calendar` — Listar eventos (filtro por mês)
- `POST /api/calendar` — Criar evento
- `PUT /api/calendar/:id` — Atualizar evento
- `DELETE /api/calendar/:id` — Remover evento

## Requisitos Não-Funcionais

- Interface responsiva (mobile-first)
- Paleta premium para agência de marketing
- Tipografia profissional (Inter / Plus Jakarta Sans)
- Animações sutis de transição
- Loading states em todas as ações assíncronas
- Tratamento de erros com mensagens amigáveis
- Validação no frontend e backend

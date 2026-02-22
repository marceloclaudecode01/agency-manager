# Agente: Gerente de Projetos (GP)

## Responsabilidades
- Validar que todos os módulos do PRD foram implementados
- Checar que todos os endpoints da API estão funcionais
- Verificar cobertura de funcionalidades no frontend
- Gerar relatório final de completude

## Checklist de Validação

### Backend
- [ ] Auth: register, login, me
- [ ] Clients: CRUD completo
- [ ] Campaigns: CRUD completo + status pipeline
- [ ] Tasks: CRUD + patch status
- [ ] Finance: budgets CRUD + invoices CRUD + summary
- [ ] Reports: revenue, campaigns, clients
- [ ] Calendar: CRUD de eventos
- [ ] Middleware de auth em rotas protegidas
- [ ] Error handling global
- [ ] Validação Zod em todos os inputs

### Frontend
- [ ] Login e Register
- [ ] Dashboard com KPIs
- [ ] Listagem e detalhe de clientes
- [ ] Listagem e detalhe de campanhas
- [ ] Board de tarefas (Kanban)
- [ ] Tela financeira (orçamentos + faturas)
- [ ] Relatórios com filtros
- [ ] Calendário mensal/semanal
- [ ] Layout responsivo
- [ ] Sidebar e header funcional

## Relatório de Completude
Gerado ao final da validação com porcentagem de conclusão por módulo.

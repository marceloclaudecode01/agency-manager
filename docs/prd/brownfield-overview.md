# PRD Brownfield — Visão Geral do Sistema

> Gerado em 2026-02-27. Complementa o PRD original (`PRD.md`).
> Este documento descreve o estado ATUAL do sistema e define os objetivos do próximo ciclo.

---

## 1. Resumo Executivo

Sistema de gestão interna para agências de marketing digital. Implementado com Node.js/Express/Prisma no backend e Next.js 14 no frontend. O sistema possui núcleo funcional em produção (Railway), com módulos core estáveis e módulos avançados implementados no backend mas com frontend parcial.

---

## 2. O que está em produção (estado atual)

### Modulos estáveis (backend + frontend)
| Módulo | Backend | Frontend | Observação |
|--------|---------|----------|------------|
| Auth (login/register) | Completo | Completo | Bug: inconsistência cookie vs localStorage |
| Dashboard (KPIs) | Completo | Completo | |
| Clientes (CRM) | Completo | Completo | |
| Campanhas | Completo | Completo | |
| Tarefas (Kanban) | Completo | Parcial | DnD não implementado |
| Financeiro (Budget/Invoice) | Completo | Completo | Sem export PDF |
| Relatórios | Completo | Completo | Sem export CSV/PDF |
| Calendário | Completo | Completo | |
| Usuários/Equipe | Completo | Completo | |

### Módulos avançados (backend implementado, frontend pode ser parcial)
| Módulo | Backend | Frontend | Observação |
|--------|---------|----------|------------|
| Social Media | Completo | Parcial | Verificar integração Facebook API |
| Produtos IA | Completo | Parcial | TikTok Shop, agentes em background |
| Agentes IA | Completo | Parcial | 14 agentes com rotação Gemini API keys |
| Chat interno | Completo | Parcial | Socket.io — verificar UX |
| Notificações | Completo | ? | Não confirmado no frontend |

---

## 3. Gaps e Dívida Técnica Identificados

| # | Problema | Severidade | Impacto |
|---|----------|-----------|---------|
| G1 | Inconsistência cookie vs localStorage no token de auth | Critica | Loop de redirect em produção |
| G2 | Sem refresh token — JWT fixo de 7 dias | Alta | Sessão expira sem aviso, UX ruim |
| G3 | `middleware.ts` pode ter validação inconsistente | Alta | Falsos positivos/negativos no redirect |
| G4 | Kanban sem drag-and-drop funcional | Media | Feature prometida no PRD não entregue |
| G5 | Sem exportação PDF/CSV | Media | Usuários precisam exportar faturas e relatórios |
| G6 | Zero testes automatizados | Alta | Regressoes silenciosas a cada deploy |
| G7 | Módulos avançados com frontend incompleto | Baixa | Funcionalidades pagas sem interface |

---

## 4. Objetivos do Próximo Ciclo

1. **Estabilizar autenticação** — eliminar o risco de loop redirect em produção (G1, G2, G3)
2. **Completar features prometidas no PRD** — DnD no Kanban, exportação PDF/CSV (G4, G5)
3. **Estabelecer cobertura de testes** — proteção contra regressão nos módulos críticos (G6)

Módulos avançados (G7) serão avaliados em ciclo separado após auditoria de frontend.

---

## 5. Perfis de Usuário e Permissões

| Perfil | Descrição | Restrições |
|--------|-----------|------------|
| **ADMIN** | Dono/sócio da agência | Acesso total — CRUD em tudo, gerenciar usuários, ver finanças |
| **MANAGER** | Gerente de projetos | Sem delete financeiro, sem gerenciar usuários |
| **MEMBER** | Colaborador (designer, copywriter, etc.) | Apenas suas tarefas atribuídas, sem acesso a finanças |

---

## 6. Epics do Ciclo Atual

| Epic | Titulo | Prioridade |
|------|--------|-----------|
| [Epic 1](epic-1-auth-fixes.md) | Correcao Critica de Autenticacao | P0 |
| [Epic 2](epic-2-kanban-dnd.md) | Kanban Drag-and-Drop | P1 |
| [Epic 3](epic-3-exports.md) | Exportacao de Dados (PDF/CSV) | P1 |
| [Epic 4](epic-4-tests.md) | Cobertura de Testes | P2 |

# Epic 3 — Exportação de Dados (PDF/CSV)

> Prioridade: P1
> Dependências: nenhuma (pode rodar em paralelo com Epic 2)
> @sm deve detalhar as stories abaixo.

---

## Problema

O PRD original menciona exportação como entrega futura ("Exportação em JSON — futuramente PDF/CSV"). O sistema atual não possui nenhum mecanismo de exportação. Usuários precisam exportar:
- Relatórios de receita e ranking de clientes (CSV — para planilhas)
- Faturas (PDF — para envio ao cliente)
- Orçamentos (PDF — para aprovação do cliente)

**Arquivos afetados:**
- `backend/src/modules/reports/` — adicionar endpoints de export
- `backend/src/modules/finance/` — adicionar geração de PDF
- `frontend/src/app/(dashboard)/reports/` — botões de download CSV
- `frontend/src/app/(dashboard)/finance/` — botões de download PDF

---

## Stories

### Story 3.1 — Export CSV para relatórios de receita e clientes
**Escopo:**
- Novo endpoint `GET /api/reports/revenue/export?format=csv&period=...` — retorna CSV com dados de receita por periodo
- Novo endpoint `GET /api/reports/clients/export?format=csv` — retorna CSV com ranking de clientes (nome, receita total, campanhas)
- Frontend: botão "Exportar CSV" na página de relatórios que dispara download direto via link
- Formato CSV: UTF-8 com BOM (compatível com Excel), separador `;`
- Protegido por role: ADMIN e MANAGER apenas

**Bibliotecas sugeridas (backend):** `csv-stringify` ou geração manual (simples o suficiente)

### Story 3.2 — Export PDF para Faturas (Invoice)
**Escopo:**
- Novo endpoint `GET /api/finance/invoices/:id/pdf` — retorna PDF da fatura
- Layout do PDF: logo (placeholder), dados do cliente, itens do orçamento vinculado, total, status, data de vencimento
- Frontend: botão "Baixar PDF" na página de detalhe da fatura e na listagem (ação por linha)
- Protegido por role: ADMIN e MANAGER

**Bibliotecas sugeridas (backend):** `@react-pdf/renderer` (SSR no Node) ou `pdfkit` (mais leve)

### Story 3.3 — Export PDF para Orçamentos (Budget)
**Escopo:**
- Novo endpoint `GET /api/finance/budgets/:id/pdf` — retorna PDF do orçamento
- Layout do PDF: dados do cliente, descrição dos itens, valores unitários, subtotal, total, validade do orçamento
- Frontend: botão "Baixar PDF" na página de detalhe do orçamento
- Protegido por role: ADMIN e MANAGER

**Nota para @sm:** Stories 3.2 e 3.3 devem usar o mesmo utilitário de geração de PDF para consistência visual. Considerar criar um `pdf.service.ts` compartilhado no módulo finance.

---

## Criterios de Sucesso

- [ ] CSV de receita abre corretamente no Excel e Google Sheets sem problemas de encoding
- [ ] CSV de clientes exporta todos os campos relevantes com cabecalho legível
- [ ] PDF de fatura contém todos os dados obrigatórios para cobrança (dados do cliente, itens, total, vencimento)
- [ ] PDF de orçamento contém todos os dados para aprovação comercial
- [ ] Downloads funcionam em todos os browsers (Chrome, Firefox, Safari)
- [ ] Endpoints de export retornam 403 para MEMBER

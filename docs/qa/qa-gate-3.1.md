# QA Gate — Story 3.1: Export CSV para Relatórios

**Revisor:** @qa (Quinn, Guardian)
**Data:** 2026-02-27
**Status da Story:** InReview
**Veredicto Final:** PASS (re-gate 2026-02-27 — ambos os Concerns resolvidos)

---

## Resumo Executivo

A Story 3.1 implementa exportação de dados em CSV para relatórios de receita e ranking de clientes. A implementação cobre a maior parte dos critérios de aceitação. No entanto, foram identificadas duas preocupações que merecem atenção antes do merge: (1) o filtro de datas no `exportRevenueCsv` usa `createdAt` em vez de `paidAt`, divergindo do comportamento do `getRevenue` existente; e (2) `getTopClients` filtra apenas clientes com `status: 'ACTIVE'`, fazendo com que o CSV de clientes omita clientes inativos com histórico de receita, enquanto o cabeçalho hardcoded retorna sempre `ATIVO`.

---

## Check 1 — Revisão de Código (Padrões, TypeScript, uso de `any`)

**Resultado: APROVADO com ressalvas**

### `reports.service.ts`
- Métodos `exportRevenueCsv` e `exportClientsCsv` retornam `Promise<string>` — tipagem correta.
- Parâmetros de query tipados como `{ startDate?: string; endDate?: string }` — correto.
- **RESSALVA:** `exportRevenueCsv` (linha 96) faz query com `createdAt: { gte: startDate, lte: endDate }` enquanto `getRevenue` filtra por `paidAt: { gte: startDate, lte: endDate }` e restringe a `status: 'PAID'`. O método de export agrupa depois por `paidAt || createdAt` mas busca todas as faturas (pagas, pendentes, vencidas) no período de `createdAt`. Isso produz comportamento diferente do endpoint `getRevenue` correspondente.
- Escape de ponto-e-vírgula em nomes de clientes: `c.name.replace(/;/g, ',')` — correto.
- `\uFEFF` BOM adicionado ao início do CSV — correto para compatibilidade Excel.
- Separador `;` — correto conforme especificação.
- **RESSALVA:** `exportClientsCsv` chama `this.getTopClients()` que filtra apenas `status: 'ACTIVE'`. O campo `Status` no CSV retorna sempre a string hardcoded `'ATIVO'` (linha 136), ignorando o campo real de status do cliente. Se um cliente tiver `status: 'INACTIVE'`, nunca aparecerá no CSV.

### `reports.controller.ts`
- Desestruturação de `req.query` com tipagem explícita `{ startDate?: string; endDate?: string }` — correto.
- Headers `Content-Type: text/csv; charset=utf-8` e `Content-Disposition: attachment; filename="..."` — correto.
- `periodLabel` gerado de forma segura para o nome do arquivo — correto.
- Tratamento de erros com bloco `catch` em ambos os métodos — correto.
- Uso de `error: any` no catch — padrão já existente no projeto (`getRevenue`, `getTopClients` usam o mesmo pattern).

### `reports.routes.ts`
- `authMiddleware` aplicado globalmente ao router via `router.use(authMiddleware)` — correto.
- `requireRole('ADMIN', 'MANAGER')` aplicado globalmente via `router.use(requireRole(...))` — correto; protege todas as rotas do módulo incluindo as novas.
- Rotas `/revenue/export` e `/clients/export` registradas corretamente.

### `reports/page.tsx` (frontend)
- Estados `exportingRevenue` e `exportingClients` para loading state — correto.
- `downloadCsv` usa `api.get` com `responseType: 'blob'` — abordagem correta para download autenticado via axios (token enviado via header de sessão, não como query param).
- Criação de URL de objeto blob + click programático em anchor + revogação da URL — padrão correto para download via JS.
- Botões desabilitados durante exportação com `disabled={exportingRevenue}` / `disabled={exportingClients}` — correto.
- Uso de `any[]` para estados de dados — padrão existente no arquivo (não introduzido por esta story).

---

## Check 2 — Critérios de Aceitação

**Resultado: 4/5 APROVADOS; AC2 com ressalva**

| AC | Descrição | Status | Evidência no código |
|----|-----------|--------|---------------------|
| AC1 | ADMIN recebe CSV com Content-Type text/csv, BOM e separador `;` | APROVADO | `res.setHeader('Content-Type', 'text/csv; charset=utf-8')`. BOM `\uFEFF` na linha 125 do service. Separador `;` em todos os campos. |
| AC2 | Caracteres acentuados aparecem corretamente no Excel | APROVADO COM RESSALVA | BOM `\uFEFF` presente. Cabeçalho `Per\u00EDodo` (escape Unicode de "Período") e `N\u00FAmero` ("Número") estão corretos. Porém a coluna Status retorna `ATIVO` hardcoded (ASCII puro) — não há preocupação de encoding nesta string específica, mas o valor é semanticamente incorreto para clientes não-ativos. |
| AC3 | MEMBER recebe 403 | APROVADO | `requireRole('ADMIN', 'MANAGER')` aplicado globalmente ao router — qualquer role não listada, incluindo MEMBER, receberá 403. |
| AC4 | Clique em "Exportar CSV" inicia download sem navegar para nova página | APROVADO | `downloadCsv` usa fetch+blob+anchor click programático. Nenhum `window.open()` ou navegação direta. |
| AC5 | Período sem dados retorna CSV apenas com cabeçalho e status 200 | APROVADO | Quando `monthMap` ou `clients` estão vazios, `lines` será array vazio; `[header, ...lines].join('\r\n')` retorna apenas o cabeçalho. Status 200 retornado por `res.status(200).send(csv)`. |

---

## Check 3 — Ausência de Regressões

**Resultado: APROVADO**

- Endpoints existentes (`/revenue`, `/campaigns`, `/clients`, `/clients/top`) preservados sem alterações.
- `getRevenue`, `getCampaignPerformance`, `getTopClients` no service intactos.
- `loadData` no frontend preservado — carrega os três relatórios existentes.
- Proteção de role existente (`requireRole` no router) mantida e agora estendida às novas rotas.
- Nenhum arquivo fora dos declarados em "Arquivos Afetados" foi modificado.

---

## Check 4 — Segurança

**Resultado: APROVADO**

- **Proteção de role confirmada:** `router.use(requireRole('ADMIN', 'MANAGER'))` na linha 9 de `reports.routes.ts` protege todo o router, incluindo os dois novos endpoints de export. MEMBER recebe 403.
- **Autenticação confirmada:** `router.use(authMiddleware)` na linha 8 — requisições sem token válido são rejeitadas antes de chegar ao `requireRole`.
- **Sem query injection:** parâmetros `startDate` e `endDate` são passados ao Prisma como objetos `Date` (após `new Date(query.startDate)`), não interpolados em strings SQL brutas.
- **Sem exposição de dados sensíveis:** o CSV expõe apenas dados de receita e ranking de clientes, que são informações de negócio acessíveis a ADMIN e MANAGER por design.
- **Download frontend autenticado:** usa axios com credenciais de sessão (não expõe token em URL pública).

---

## Check 5 — Escopo

**Resultado: APROVADO**

Todos os itens do `IN` foram implementados:
- Endpoints `/revenue/export` e `/clients/export` criados.
- Métodos `exportRevenueCsv` e `exportClientsCsv` no service.
- Métodos `exportRevenueCsv` e `exportClientsCsv` no controller.
- Headers de resposta CSV corretos.
- Cabeçalhos CSV com os campos especificados.
- Proteção por role.
- Botões "Exportar CSV" no frontend com loading state e download autenticado.

Itens do `OUT` (XLSX, JSON, export de campanhas, agendamento) **nao implementados** — correto.

---

## Check 6 — Tratamento de Erros

**Resultado: APROVADO**

- Controller: ambos os métodos de export possuem `try/catch` com retorno via `ApiResponse.error`.
- Frontend: `downloadCsv` possui `try/catch` com toast de erro `'Erro ao exportar CSV'`.
- Estado de loading (`exportingRevenue`, `exportingClients`) retorna a `false` no `finally` — evita botao preso em estado "Exportando...".
- Datas inválidas passadas como query params: `new Date('invalid')` resulta em `Invalid Date`; Prisma pode lançar erro que é capturado pelo `catch` do controller.

---

## Check 7 — Documentação

**Resultado: APROVADO**

- Story status: `InReview` — correto.
- Todos os checkboxes do escopo `IN`: marcados como `[x]`.
- Todos os ACs marcados como `[x]`.
- Change Log atualizado com entrada de implementação por @dev em 2026-02-27.

---

## Preocupacoes Identificadas

### CONCERN 1 — Filtro de datas inconsistente em `exportRevenueCsv` (Severidade: Media)

**Arquivo:** `C:\Users\MARCELO SANTOS\Desktop\test\backend\src\modules\reports\reports.service.ts`, linha 96

**Problema:** O método `exportRevenueCsv` filtra faturas por `createdAt`:
```typescript
where: {
  createdAt: { gte: startDate, lte: endDate },
},
```
O método `getRevenue` filtra por `paidAt` e restringe a `status: 'PAID'`:
```typescript
where: {
  status: 'PAID',
  paidAt: { gte: startDate, lte: endDate },
},
```
Isso significa que o CSV de receita pode incluir faturas criadas no período mas ainda nao pagas (PENDING/OVERDUE), gerando discrepância entre os dados exibidos na tela e os dados exportados. O usuário pode receber números diferentes para o mesmo período dependendo de onde olha.

**Recomendacao:** Alinhar o filtro do export ao comportamento do `getRevenue`, ou documentar explicitamente que o export tem escopo diferente (todas as faturas vs apenas pagas).

### CONCERN 2 — Status hardcoded `ATIVO` no CSV de clientes (Severidade: Baixa)

**Arquivo:** `C:\Users\MARCELO SANTOS\Desktop\test\backend\src\modules\reports\reports.service.ts`, linha 136

**Problema:** A coluna `Status` no CSV de clientes sempre retorna `'ATIVO'`:
```typescript
return `${clientName};${revenueFormatted};${c.campaignCount};ATIVO`;
```
Isso é tecnicamente correto porque `getTopClients` já filtra por `status: 'ACTIVE'`, mas:
1. O valor hardcoded `ATIVO` nunca corresponderá a outros possíveis valores de status.
2. Se `getTopClients` for alterado no futuro para incluir outros status, o CSV será silenciosamente incorreto.

**Recomendacao:** Mapear o status real do cliente para o texto em português, ou remover a coluna `Status` do CSV se ela nao acrescenta informação (todos os registros sao ATIVO).

---

## Veredicto: CONCERNS (gate original)

Os concerns identificados nao impedem o funcionamento da feature em produção para o caso de uso principal, mas introduzem inconsistência de dados (Concern 1) que pode gerar confusão para usuários finais. Recomenda-se resolução antes do merge, especialmente o Concern 1.

---

## Re-gate: 2026-02-27 — PASS

**CONCERN 1 — RESOLVIDO:** `exportRevenueCsv` agora filtra por `status: 'PAID'` e `paidAt` — alinhado com `getRevenue`.

**CONCERN 2 — RESOLVIDO:** `exportClientsCsv` agora usa `c.status` (status real do cliente) em vez de `'ATIVO'` hardcoded.

**Veredicto Re-gate: PASS** — Story 3.1 aprovada para merge.

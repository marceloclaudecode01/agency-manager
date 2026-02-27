# Epic 4 — Cobertura de Testes

> Prioridade: P2
> Dependências: pode rodar em paralelo; idealmente após Epic 1 (auth estável)
> @sm deve detalhar as stories abaixo.

---

## Problema

O sistema não possui nenhum teste automatizado (unitário, integração ou e2e). Qualquer alteração nos módulos críticos pode introduzir regressões silenciosas que só são detectadas em produção. O risco é especialmente alto para:
- Fluxo de autenticação (impacta todos os usuários)
- Módulo de clientes (dados críticos do CRM)
- Módulo financeiro (cálculos de receita, geração de faturas)

---

## Stories

### Story 4.1 — Setup Jest + Supertest no backend
**Escopo:**
- Instalar e configurar `jest`, `ts-jest`, `supertest`, `@types/jest`, `@types/supertest`
- Configurar `jest.config.ts` com paths do TypeScript
- Configurar banco de testes (PostgreSQL separado ou SQLite via Prisma para testes)
- Script `npm run test` e `npm run test:watch` no `package.json`
- Criar arquivo `src/__tests__/setup.ts` com setup/teardown do Prisma client de teste
- **Entrega mínima:** 1 teste "smoke" passando (`GET /api/health` retorna 200)

### Story 4.2 — Testes unitários dos services críticos (auth, clients, finance)
**Escopo:**

**Auth service:**
- `register()` — cria usuário com senha hasheada, retorna token
- `login()` — valida credenciais, retorna token; falha com senha errada
- `login()` — retorna 401 para email inexistente

**Clients service:**
- `create()` — persiste cliente, associa ao usuário criador
- `findAll()` — filtra por status e busca por nome
- `delete()` — falha se cliente tem campanhas ativas (se essa regra existir)

**Finance service:**
- `createInvoice()` — só permite criação a partir de Budget com status APPROVED
- `summaryReport()` — calculos de totais estão corretos

**Fora do escopo:** Testes de controllers (cobertos indiretamente via Supertest em integração futura)

### Story 4.3 — Setup Vitest + Testing Library no frontend
**Escopo:**
- Instalar e configurar `vitest`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`
- Configurar `vitest.config.ts` compatível com Next.js 14 App Router
- Configurar `src/__tests__/setup.ts` com `@testing-library/jest-dom` matchers
- Script `npm run test` e `npm run test:ui` no `package.json`
- Mock do módulo `api.ts` para isolar testes de componentes da rede
- **Entrega mínima:** 1 teste "smoke" passando (componente Button renderiza sem erros)

### Story 4.4 — Testes de componentes críticos (forms, auth flow)
**Escopo:**

**Formulário de Login:**
- Renderiza campos email e senha
- Exibe erro de validação para campos vazios (submit sem preencher)
- Exibe mensagem de erro da API em caso de credenciais inválidas
- Redireciona para `/dashboard` em caso de login bem-sucedido (mock da API)

**Formulário de criação de Cliente:**
- Campos obrigatórios mostram erro de validação se vazios
- Submit com dados válidos chama `api.clients.create()` com os dados corretos
- Exibe toast de sucesso após criação

**AuthContext / hook de autenticação:**
- Estado inicial é `{ user: null, loading: true }`
- Após `login()` bem-sucedido, estado passa a ter o user
- `logout()` limpa o estado e remove o token

**Fora do escopo:** Testes e2e com Playwright ou Cypress (ciclo futuro)

---

## Criterios de Sucesso

- [ ] `npm run test` no backend executa sem erros e todos os testes passam
- [ ] `npm run test` no frontend executa sem erros e todos os testes passam
- [ ] Cobertura minima: 60% dos services de auth, clients e finance
- [ ] CI local (pre-commit ou pre-push hook) pode rodar os testes antes de um deploy
- [ ] Testes nao dependem de banco de dados de producao ou variaveis de ambiente externas

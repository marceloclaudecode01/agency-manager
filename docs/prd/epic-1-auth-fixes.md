# Epic 1 — Correção Crítica de Autenticação

> Prioridade: P0 — Crítico
> Dependências: nenhuma
> @sm deve detalhar as stories abaixo antes de qualquer implementação.

---

## Problema

O sistema possui inconsistência na forma como o token JWT é armazenado e lido:

- O backend emite o token e o frontend o salva em **localStorage** (via `api.ts`)
- O `middleware.ts` do Next.js pode estar lendo de **cookie** — fontes diferentes causam dessincronia
- Em produção (Railway + Vercel), isso provoca **loops de redirect**: o middleware considera o usuário não autenticado mesmo após login bem-sucedido
- Não existe refresh token — o JWT tem validade fixa de 7 dias, após o que o usuário é deslogado sem aviso

**Arquivos afetados:**
- `frontend/src/lib/api.ts` — onde o token é lido/salvo
- `frontend/src/middleware.ts` — onde o token é validado para redirect
- `frontend/src/contexts/` — AuthContext (se existir)
- `backend/src/modules/auth/auth.service.ts` — geração do token

---

## Stories

### Story 1.1 — Padronizar token storage (cookie httpOnly)
**Escopo:**
- Definir cookie httpOnly como fonte única de verdade para o token
- Backend deve setar `Set-Cookie` com `httpOnly`, `secure`, `sameSite=strict` no login/register
- Frontend (`api.ts`) deve parar de usar localStorage para o token de auth
- Axios deve enviar cookies automaticamente (`withCredentials: true`)
- Logout deve limpar o cookie via endpoint ou `Set-Cookie: expires=past`

**Fora do escopo:** Sessoes de refresh token (Story 1.2)

### Story 1.2 — Implementar refresh token
**Escopo:**
- Novo endpoint `POST /api/auth/refresh` que recebe refresh token (cookie httpOnly) e retorna novo access token
- Access token com validade curta (15min)
- Refresh token com validade longa (30 dias) em cookie httpOnly separado
- Interceptor no Axios do frontend para capturar 401 e tentar refresh automaticamente antes de redirecionar para login
- Endpoint `POST /api/auth/logout` que invalida o refresh token

**Fora do escopo:** Revogação de refresh tokens em banco (pode ser blacklist simples em memória inicialmente)

### Story 1.3 — Corrigir middleware.ts para validação consistente
**Escopo:**
- Reescrever `frontend/src/middleware.ts` para ler token exclusivamente do cookie (alinhado com Story 1.1)
- Garantir que rotas publicas (`/login`, `/register`) não redirecionem usuarios autenticados para loop
- Garantir que rotas protegidas (`/dashboard/*`) redirecionem para `/login` se sem cookie válido
- Testar manualmente os cenarios: login fresh, token expirado, logout, acesso direto a URL protegida

**Fora do escopo:** Validação criptográfica do JWT no middleware (Next.js edge runtime tem limitações — checar viabilidade)

---

## Criterios de Sucesso

- [ ] Login em produção não causa loop de redirect
- [ ] Token é armazenado exclusivamente em cookie httpOnly (não aparece no localStorage)
- [ ] Após 15min, o access token é renovado automaticamente sem logout do usuário
- [ ] Logout limpa todos os cookies e redireciona para `/login`
- [ ] Fluxo de auth testado nos 3 browsers principais (Chrome, Firefox, Safari)

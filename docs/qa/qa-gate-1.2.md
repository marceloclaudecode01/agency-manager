# QA Gate Report — Story 1.2

**Veredicto:** FAIL
**Data:** 2026-02-27

---

## Resultados das Verificações

### 1. Code Review: ⚠️ — issues encontrados

O código segue a estrutura de módulo corretamente (controller / service / routes / schema). Padrões de
ApiResponse, try/catch e singleton do Prisma respeitados.

**Issue HIGH — `auth.service.ts` linhas 54–58:** O método `refreshAccessToken` assina o novo access token chamando `jwt.sign` diretamente com apenas `{ id: decoded.id }` em vez de delegar para `this.generateAccessToken(...)`. O payload resultante fica incompleto — sem `email` e sem `role`. O `authMiddleware` decodifica o token e popula `req.user`, portanto após um refresh todas as requisições que dependem de `req.user.email` ou `req.user.role` (ex.: RBAC via `requireRole`, qualquer log de auditoria) receberão `undefined`.

```typescript
// auth.service.ts linha 54-58 — ATUAL (incorreto)
return jwt.sign(
  { id: decoded.id },           // faltam email e role
  ACCESS_TOKEN_SECRET as string,
  { expiresIn: '15m' }
);
```

O correto seria buscar o usuário no banco ou, no mínimo, incluir os campos do payload original do refresh token. Como o refresh token atual só persiste `{ id }` (linha 27-31), seria necessário fazer lookup no banco para reconstruir `{ id, email, role }`.

**Issue MEDIUM — `error: any` sem justificativa:** `auth.controller.ts` linhas 32, 47, 75, 87 e 99 usam `catch (error: any)` sem comentário justificando o uso de `any`. O `coding-standards.md` exige TypeScript strict — `any` precisa de justificativa explícita. O padrão correto seria `catch (error: unknown)` com narrowing.

**Ressalva LOW — `invalidateRefreshToken` é wrapper desnecessário:** O método `invalidateRefreshToken` em `auth.service.ts` linha 61-63 é um wrapper trivial de `addToBlacklist`. Não agrega semântica — é indireção sem valor. Manter apenas um dos dois.

---

### 2. Critérios de Aceitação: ❌ — AC4 não implementado corretamente

- **AC1** ✅ — `auth.controller.ts` linhas 29-30 e 44-45: dois cookies setados no login e register com `ACCESS_COOKIE_OPTIONS` (15m) e `REFRESH_COOKIE_OPTIONS` (30d), ambos `httpOnly: true`.
- **AC2** ✅ — `frontend/src/lib/api.ts` linhas 39-78: interceptor 401 chama `POST /auth/refresh` e retenta a requisição original. Flag `_retry` presente (linha 57). Fila de concorrência implementada (linhas 45-55).
- **AC3** ✅ — Se o refresh falha, `window.location.href = '/login'` é executado (linhas 52 e 76).
- **AC4** ❌ — **BLOQUEANTE.** `auth.controller.ts` linhas 55-63: o método `logout` lê `req.cookies?.refresh_token` para adicionar à blacklist. Porém `REFRESH_COOKIE_OPTIONS` define `path: '/api/auth/refresh'` (linha 22). O browser envia um cookie **somente** para paths que correspondem ao `path` do cookie. Como a rota de logout é `POST /api/auth/logout`, o browser jamais enviará `refresh_token` nessa requisição — `req.cookies.refresh_token` será sempre `undefined` e `invalidateRefreshToken` nunca é chamado. Após logout, o refresh token permanece válido por 30 dias.
- **AC5** ✅ — `auth.service.ts` linhas 10-12: `throw new Error('REFRESH_TOKEN_SECRET environment variable is not set')` — falha explícita no startup.

---

### 3. Sem Regressões: ✅ — com observação

- Bearer header fallback preservado em `backend/src/middlewares/auth.ts` linhas 11-15. ✅
- Story 1.1: comportamento de cookie httpOnly no login/register preservado. ✅
- **Débito técnico de Story 1.1 resolvido:** Token não está mais exposto no body de login/register. `auth.controller.ts` linha 46 retorna apenas `{ user: result.user }` — a issue MEDIUM do QA 1.1 foi sanada. ✅
- Rotas existentes (`/me`, `/profile`) não foram alteradas. ✅
- **Observação:** Após um refresh bem-sucedido, o novo access token terá payload incompleto (apenas `{ id }`), o que pode causar regressão silenciosa em qualquer módulo que leia `req.user.role` para autorização por papel.

---

### 4. Segurança: ❌ — issue crítico de revogação

- `REFRESH_TOKEN_SECRET` separado de `JWT_SECRET` — verificado no `.env` (linha 3). ✅
- Refresh cookie `path` restrito a `/api/auth/refresh` — boa prática de minimização de superfície. ✅ (porém causa AC4 quebrado — ver abaixo)
- Blacklist em memória funciona corretamente para o endpoint de refresh (`isBlacklisted` verificado em `auth.service.ts` linhas 43-45). ✅
- Token de access não está mais no body de login/register. ✅
- **Issue CRÍTICO — Revogação de refresh token no logout não funciona:** Como explicado no AC4, o cookie `refresh_token` com `path: '/api/auth/refresh'` nunca é enviado pelo browser para `/api/auth/logout`. O token permanece válido após logout durante toda a janela de 30 dias. Um atacante com acesso ao refresh token pode continuar obtendo novos access tokens mesmo após o usuário ter feito logout.

  Solução: o path do refresh cookie deve ser ampliado para incluir também `/api/auth/logout`, ou simplificado para `/api/auth` (cobre ambas as rotas). Uma alternativa é que o `logout` receba o refresh token no body da requisição (saindo do cookie), mas isso contradiz o design da story.

- **Issue MEDIUM — Novo access token pós-refresh sem `role`:** Conforme issue HIGH do Code Review, o payload incompleto pode levar bypass silencioso de `requireRole` se o role for `undefined` e a comparação nunca for verdadeira — resultado: acesso negado mesmo para usuário autenticado, ou comportamento indefinido dependendo da implementação de `requireRole`.

---

### 5. Escopo: ✅

Nenhum arquivo fora da lista "Arquivos Afetados" foi modificado. A lógica do `middleware.ts` do Next.js não foi alterada. Nenhuma persistência de refresh token no banco foi adicionada. Implementação dentro do escopo definido.

---

### 6. Tratamento de Erros: ✅ — com ressalva

- `auth.controller.ts`: `refresh()` trata ausência de cookie (linha 67-69), `statusCode 401` do service (linha 76-78) e erro genérico (linha 79). ✅
- `auth.service.ts`: `refreshAccessToken` encapsula o `jwt.verify` em try/catch e lança objeto tipado com `statusCode` (linhas 48-52). ✅
- `frontend/api.ts`: Flag `_retry` previne loop infinito (linha 43 — `!originalRequest._retry`). ✅
- `frontend/api.ts`: `isAuthRoute` inclui `/auth/refresh` (linha 37) — evita que falha no próprio refresh dispare outro refresh. ✅
- `frontend/api.ts`: Fila de requisições concorrentes (`pendingRequests`) garante que múltiplos 401 simultâneos disparam apenas um `POST /auth/refresh` (linhas 13-27 e 45-55). ✅
- **Ressalva MEDIUM:** No frontend, `api.ts` linha 62-66 usa uma instância `axios` separada (não a instância `api`) para chamar o refresh. Isso é correto para evitar que o próprio interceptor intercepte a chamada de refresh. Porém se `NEXT_PUBLIC_API_URL` estiver indefinido, a URL é construída com fallback hardcoded `http://localhost:3333/api` na linha 63 — comportamento idêntico à instância principal, portanto não é um bug funcional, mas é duplicação de lógica.

---

### 7. Documentação: ✅

- Status da story: `InReview`. ✅
- Todos os checkboxes do escopo IN marcados como `[x]`. ✅
- Change Log atualizado em 2026-02-27 com nota de implementação do @dev. ✅

---

## Issues Encontradas

| # | Severidade | Arquivo | Linha(s) | Descrição |
|---|-----------|---------|----------|-----------|
| 1 | CRITICAL | `backend/src/modules/auth/auth.controller.ts` | 56 | Cookie `refresh_token` com `path: '/api/auth/refresh'` não é enviado pelo browser para `POST /api/auth/logout` — blacklist nunca é populada; revogação de token no logout não funciona |
| 2 | HIGH | `backend/src/modules/auth/auth.service.ts` | 54–58 | `refreshAccessToken` assina novo token com apenas `{ id }` — payload falta `email` e `role`; downstream `req.user.role` será `undefined` após refresh |
| 3 | MEDIUM | `backend/src/modules/auth/auth.controller.ts` | 32, 47, 75, 87, 99 | `catch (error: any)` sem justificativa — viola TypeScript strict do `coding-standards.md` |
| 4 | LOW | `backend/src/modules/auth/auth.service.ts` | 61–63 | `invalidateRefreshToken` é wrapper trivial de `addToBlacklist` — indireção sem valor semântico |
| 5 | LOW | `frontend/src/lib/api.ts` | 63 | Duplicação da URL base do backend em vez de reutilizar `api.defaults.baseURL` |

---

## Correções Necessárias (bloqueantes para merge)

### Issue 1 — CRITICAL: Path do refresh cookie impede revogação no logout

O `path` do `REFRESH_COOKIE_OPTIONS` deve cobrir tanto `/api/auth/refresh` quanto `/api/auth/logout`. A solução mais simples é alterar o path para `/api/auth`:

```typescript
// auth.controller.ts — REFRESH_COOKIE_OPTIONS
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: '/api/auth',  // cobre /api/auth/refresh E /api/auth/logout
};
```

O `clearCookie` no logout também deve usar o mesmo path para expirar o cookie corretamente no browser.

### Issue 2 — HIGH: Payload incompleto no token gerado por refreshAccessToken

`refreshAccessToken` em `auth.service.ts` deve buscar o usuário no banco antes de assinar o novo token, para reconstruir `{ id, email, role }`:

```typescript
// auth.service.ts — refreshAccessToken (correção conceitual)
async refreshAccessToken(refreshToken: string): Promise<string> {
  if (this.isBlacklisted(refreshToken)) {
    throw { statusCode: 401, message: 'Refresh token has been revoked' };
  }
  let decoded: { id: string };
  try {
    decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET as string) as { id: string };
  } catch {
    throw { statusCode: 401, message: 'Invalid or expired refresh token' };
  }
  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: { id: true, email: true, role: true },
  });
  if (!user) {
    throw { statusCode: 401, message: 'User not found' };
  }
  return this.generateAccessToken(user);
}
```

Nota: esta mudança torna `refreshAccessToken` assíncrono — o `auth.controller.ts` deve ser atualizado para `await authService.refreshAccessToken(refreshToken)` (linha 72 já usa `await`, mas verificar que a tipagem está correta).

---

## Resumo

A implementação cobre corretamente a maioria dos requisitos da story: dois tokens distintos, cookies httpOnly, interceptor de refresh no frontend com fila de concorrência, flag `_retry`, falha explícita no startup sem `REFRESH_TOKEN_SECRET`, e token removido do body de resposta (débito da Story 1.1 resolvido).

Dois bugs bloqueantes impedem o merge: (1) o logout não invalida o refresh token devido ao path restritivo do cookie, quebrando a segurança de revogação de sessão (AC4); (2) o token emitido após refresh carrega payload incompleto, potencialmente quebrando autorização por papel em toda a aplicação.

---

## Re-review — 2026-02-27

**Verdict:** PASS

Bug 1: ✅ — `REFRESH_COOKIE_OPTIONS.path` alterado de `'/api/auth/refresh'` para `'/api/auth'` (`auth.controller.ts` linha 22). O browser agora envia o cookie `refresh_token` tanto para `POST /api/auth/logout` quanto para `POST /api/auth/refresh`. O `clearCookie` no logout também usa `{ ...REFRESH_COOKIE_OPTIONS }` com o mesmo path, garantindo expiração correta no browser. `req.cookies.refresh_token` será populado no logout e `invalidateRefreshToken` será chamado. AC4 corrigido.

Bug 2: ✅ — `refreshAccessToken` em `auth.service.ts` (linhas 54–63) agora faz `prisma.user.findUnique` com `select: { id, email, role }` e delega para `this.generateAccessToken(user)`, que assina `{ id: user.id, email: user.email, role: user.role }` com `expiresIn: '15m'`. Payload completo após refresh — `req.user.role` e `req.user.email` estarão disponíveis em todos os middlewares downstream.

Bug 3: ✅ — Todos os `catch` em `auth.controller.ts` agora tipam como `catch (error: unknown)` (linhas 32, 47, 75, 87, 99). O cast `(error as any)` aparece apenas dentro de blocos com narrowing explícito (`error instanceof Object && 'statusCode' in error`) — padrão aceitável em TypeScript strict para lidar com erros não-Error lançados como objetos literais. Nenhum `catch (error: any)` sem justificativa permanece.

Remaining issues:
- LOW (`auth.service.ts` linha 66–68): `invalidateRefreshToken` continua sendo wrapper trivial de `addToBlacklist` — indireção sem valor semântico. Não bloqueia merge.
- LOW (`frontend/src/lib/api.ts` linha 63): URL base duplicada hardcoded em vez de reutilizar `api.defaults.baseURL`. Não bloqueia merge.

Approved For Push: YES

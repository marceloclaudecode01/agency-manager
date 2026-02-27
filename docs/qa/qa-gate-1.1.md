# QA Gate Report — Story 1.1

**Veredicto:** CONCERNS
**Data:** 2026-02-27

---

## Resultados das Verificações

### 1. Code Review: ✅ — com ressalvas menores

O código segue os padrões do `coding-standards.md`:

- `auth.controller.ts`: estrutura correta com try/catch, respostas via `ApiResponse`, constante `COOKIE_OPTIONS` extraída para reutilização — boa prática.
- `auth.service.ts`: `generateToken()` extraído como método público, sem duplicação de lógica.
- `auth.routes.ts`: rotas organizadas conforme o padrão de módulo.
- `server.ts`: `cookieParser()` registrado antes do `express.json()` — ordem correta.
- `frontend/api.ts`: limpo, conciso, sem interceptor de request desnecessário.
- `frontend/useAuth.ts`: sem referências a `localStorage`, lógica centralizada no hook.

**Ressalva LOW:** `@types/cookie-parser` está declarado em `dependencies` no `package.json` do backend (linha 17), quando deveria estar em `devDependencies`. Pacotes `@types/*` são exclusivamente de desenvolvimento e não devem ser incluídos no bundle de produção.

**Ressalva LOW:** O método `logout` em `auth.controller.ts` não usa a constante `COOKIE_OPTIONS` — replica os campos `httpOnly`, `secure` e `sameSite` manualmente. Embora funcional, há inconsistência que pode causar divergência futura se `COOKIE_OPTIONS` for alterado.

---

### 2. Critérios de Aceitação: ✅ — ACs implementados no código

- **AC1** ✅ — `res.cookie('token', result.token, COOKIE_OPTIONS)` seta cookie `httpOnly: true`, `secure` em produção. Nenhuma escrita em `localStorage` existe em `api.ts`, `useAuth.ts` ou `layout.tsx`.
- **AC2** ✅ — `withCredentials: true` na instância axios garante envio automático do cookie em todas as requisições. Backend com `credentials: true` no CORS.
- **AC3** ✅ — Rota `POST /logout` expira o cookie com `expires: new Date(0)`. `useAuth.ts` chama `POST /auth/logout` e redireciona para `/login`.
- **AC4** ✅ — `middleware.ts` lê `request.cookies.get('token')` e redireciona para `/dashboard` se autenticado acessando rota pública. Agora o cookie é corretamente setado pelo backend.
- **AC5** ✅ — A fonte do token está unificada: backend seta cookie, frontend envia via cookie, middleware lê cookie. O loop de redirect está resolvido pela consistência do mecanismo.

---

### 3. Sem Regressões: ✅

- `authMiddleware` em `backend/src/middlewares/auth.ts` mantém leitura exclusiva pelo header `Authorization: Bearer` — comportamento preservado conforme especificado na story (OUT of scope alterar).
- Método `login` ainda retorna o token no body da resposta (`result.token` incluído em `ApiResponse.success`) — compatibilidade temporária mantida conforme previsto.
- Rotas existentes (`/me`, `/profile`) não foram alteradas.

---

### 4. Segurança: ✅ — com ressalva menor

- `httpOnly: true` — protege contra XSS (acesso ao cookie via JavaScript bloqueado). ✅
- `secure: process.env.NODE_ENV === 'production'` — flag `Secure` ativo apenas em HTTPS em produção. ✅
- `sameSite: 'strict'` — proteção contra CSRF. ✅
- `maxAge: 7 * 24 * 60 * 60 * 1000` — expiração de 7 dias (alinhado com `expiresIn: '7d'` do JWT). ✅
- `path: '/'` — cookie disponível para toda a aplicação. ✅
- CORS com `credentials: true` e `origin` explícito (não wildcard). ✅

**Ressalva LOW:** O método `logout` usa `expires: new Date(0)` mas não usa `maxAge: 0`. Ambos funcionam para expirar o cookie, porém a inconsistência com o padrão do resto do controller é uma ressalva estética/de manutenibilidade, não um problema de segurança.

**Ressalva MEDIUM:** O token JWT ainda é retornado no body da resposta de login e register (`result.token` exposto em `data.data.token`). Isso foi mantido intencionalmente por "compatibilidade temporária", mas expõe o token a possível leitura por JavaScript se algum código de consumo o armazenar em `localStorage` no futuro. Recomenda-se remover o token do body na Story 1.2 ou em uma story dedicada de hardening.

---

### 5. Escopo: ✅

Nenhum arquivo fora da lista "Arquivos Afetados" foi modificado. O `authMiddleware` do backend não foi alterado para ler cookies (conforme OUT of scope). O schema do Prisma não foi alterado. A lógica de redirect do `middleware.ts` do Next.js não foi modificada. Implementação restrita ao escopo definido.

---

### 6. Tratamento de Erros: ✅

- `auth.controller.ts`: `register` e `login` possuem try/catch com tratamento diferenciado por `statusCode` (409, 401) e fallback genérico.
- `logout` não usa try/catch — correto, pois a operação é apenas setar um cookie na resposta, sem I/O ou exceções esperadas.
- `useAuth.ts` (logout): bloco `try/catch` vazio com comentário explicativo — chama `POST /auth/logout` e prossegue com cleanup local mesmo em caso de falha de rede. Comportamento defensivo adequado.
- Interceptor de response em `api.ts`: trata 401 com redirect para `/login`, exceto em rotas de auth — evita loop de redirect. Correto.

---

### 7. Documentação: ✅

- Status da story alterado para `InReview`. ✅
- Change Log atualizado em 2026-02-27 com todas as alterações realizadas pelo @dev. ✅
- Itens do escopo IN marcados como `[x]`. ✅

---

## Issues Encontradas

| # | Severidade | Descrição |
|---|-----------|-----------|
| 1 | LOW | `@types/cookie-parser` declarado em `dependencies` em vez de `devDependencies` no `backend/package.json` |
| 2 | LOW | Método `logout` replica flags do cookie manualmente em vez de reutilizar a constante `COOKIE_OPTIONS` |
| 3 | MEDIUM | Token JWT ainda exposto no body da resposta de login/register — risco de uso futuro via `localStorage` |

---

## Correções Necessárias (se FAIL)

Nenhuma correção bloqueante. Os issues encontrados são de baixa e média severidade e não impedem o merge. Recomenda-se:

1. **(LOW — opcional antes do merge)** Mover `@types/cookie-parser` de `dependencies` para `devDependencies` no `backend/package.json`.
2. **(LOW — opcional antes do merge)** Refatorar `logout` para reutilizar `COOKIE_OPTIONS` substituindo `expires` por `maxAge: 0` ou extraindo objeto de expiração separado.
3. **(MEDIUM — registrar como débito técnico para Story 1.2)** Remover `token` do body da resposta de login/register no backend após confirmar que nenhum cliente depende dessa chave.

---

## Aprovado para Push: SIM (com débito técnico registrado)

A implementação resolve o problema crítico de autenticação descrito na story. Os três ACs verificáveis em código estão implementados corretamente. Os issues encontrados são de baixa/média severidade e não comprometem segurança ou funcionalidade. O issue MEDIUM (token no body) deve ser rastreado como débito técnico para Story 1.2.

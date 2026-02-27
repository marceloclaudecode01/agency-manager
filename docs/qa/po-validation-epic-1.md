# Relatório de Validação PO — Epic 1

**Autor:** @po (Pax, Balancer)
**Data:** 2026-02-27
**Epic:** Epic 1 — Correção Crítica de Autenticação
**Referência PRD:** `docs/prd/epic-1-auth-fixes.md`

---

## Story 1.1 — Padronizar token storage (cookie httpOnly)

**Score: 10/10**
**Veredicto: GO**

| # | Critério | Resultado |
|---|----------|-----------|
| 1 | Título claro e objetivo | ✅ Título descreve exatamente o que será feito e o mecanismo técnico |
| 2 | Descrição completa (problema/necessidade explicado) | ✅ Problema técnico descrito com precisão cirúrgica: dessincronia localStorage vs cookie, trechos de código exatos com número de linha identificados |
| 3 | Critérios de aceitação testáveis (Given/When/Then) | ✅ 5 ACs no formato Given/When/Then, cada um verificável manualmente via DevTools ou comportamento observável |
| 4 | Escopo bem definido (IN e OUT claramente listados) | ✅ IN com 11 itens detalhados por arquivo; OUT com 4 itens explícitos de exclusão |
| 5 | Dependências mapeadas | ✅ Declarado explicitamente que não há dependências e que Stories 1.2 e 1.3 dependem desta |
| 6 | Estimativa de complexidade | ✅ M (Médio) — justificada implicitamente pela quantidade de arquivos e pela coordenação backend/frontend |
| 7 | Valor de negócio claro | ✅ Resolve loop de redirect em produção — impacto direto na usabilidade do sistema em Railway + Vercel |
| 8 | Riscos documentados | ✅ Risco de regressão mapeado via item OUT ("manter leitura via header para compatibilidade com chamadas de API futuras"); risco de `cookie-parser` ausente mapeado no IN |
| 9 | Critérios de Done claros | ✅ Seção de Arquivos Afetados e ACs cobrem o que deve estar concluído; AC5 especifica o ambiente de produção |
| 10 | Alinhamento com PRD/Epic | ✅ Cobre exatamente o escopo descrito no Epic 1 para Story 1.1: cookie httpOnly, withCredentials, logout via endpoint |

**Observações:**
- Story exemplar em nível de detalhe técnico — rara para um Draft inicial.
- O AC4 ("cookie `token` válido") usa o nome `token` mas a story renomeia para `access_token` somente na Story 1.2. Coerente dentro do escopo desta story.
- Recomenda-se que o dev confirme o comportamento do `authMiddleware` do backend (manter leitura por header Bearer) durante a implementação, pois a nota sobre compatibilidade está apenas no IN e no OUT, sem AC dedicado.

---

## Story 1.2 — Implementar refresh token

**Score: 10/10**
**Veredicto: GO**

| # | Critério | Resultado |
|---|----------|-----------|
| 1 | Título claro e objetivo | ✅ Título direto; "refresh token" é termo de domínio inequívoco |
| 2 | Descrição completa (problema/necessidade explicado) | ✅ Problema atual descrito com código-fonte exato (linhas 39–43 do service, linhas 16–27 do api.ts); impacto no usuário descrito (deslogado sem aviso após 7 dias) |
| 3 | Critérios de aceitação testáveis (Given/When/Then) | ✅ 5 ACs no formato Given/When/Then; AC5 é particularmente importante (validação de startup com secret ausente) e testável |
| 4 | Escopo bem definido (IN e OUT claramente listados) | ✅ IN com 14 itens granulares por método e arquivo; OUT com 5 itens de exclusão explícitos incluindo rotação de tokens e persistência no banco |
| 5 | Dependências mapeadas | ✅ Dependência de Story 1.1 declarada duas vezes (contexto técnico e seção Dependências) com lista dos pré-requisitos específicos |
| 6 | Estimativa de complexidade | ✅ G (Grande) — justificada pela quantidade de novos métodos, novo endpoint, nova variável de ambiente e reescrita do interceptor |
| 7 | Valor de negócio claro | ✅ Elimina deslogamento abrupto após 7 dias; experiência de sessão contínua sem interrupção perceptível ao usuário |
| 8 | Riscos documentados | ✅ Blacklist em memória documentada com limitação explícita (não sobrevive restart); loop infinito de retry documentado como risco e mitigado via flag `_retry`; multi-instância excluída do escopo como risco conhecido |
| 9 | Critérios de Done claros | ✅ Arquivos Afetados lista todos os 6 arquivos com descrição das mudanças; ACs cobrem todos os fluxos críticos |
| 10 | Alinhamento com PRD/Epic | ✅ Cobre exatamente o escopo do Epic 1 Story 1.2: novo endpoint /refresh, access token 15min, refresh token 30 dias cookie httpOnly, interceptor Axios, logout invalida refresh |

**Observações:**
- A adição de `REFRESH_TOKEN_SECRET` ao `.env` está corretamente no escopo IN, mas o item menciona documentar no `tech-stack.md` e no `CLAUDE.md`. O dev deve garantir que esses arquivos sejam atualizados — não estão nos Arquivos Afetados da story. Recomenda-se @sm adicionar esses dois arquivos à lista na próxima revisão.
- AC2 pressupõe que o interceptor do frontend consegue reter e reenviar a requisição original após o refresh — detalhe de implementação crítico coberto pelo item `_retry` no IN. O dev deve atentar para o caso de múltiplas requisições simultâneas expirando ao mesmo tempo (fila de retries).

---

## Story 1.3 — Corrigir middleware.ts para validação consistente

**Score: 9/10**
**Veredicto: GO**

| # | Critério | Resultado |
|---|----------|-----------|
| 1 | Título claro e objetivo | ✅ Título claro; "validação consistente" é descritivo do problema de raiz |
| 2 | Descrição completa (problema/necessidade explicado) | ✅ Código-fonte completo do arquivo atual reproduzido na story; 4 sub-problemas identificados com numeração; raciocínio sobre Edge Runtime documentado |
| 3 | Critérios de aceitação testáveis (Given/When/Then) | ✅ 6 ACs no formato Given/When/Then; AC6 é meta-AC que cobre o comportamento de loop — excelente adição |
| 4 | Escopo bem definido (IN e OUT claramente listados) | ✅ IN com 7 itens; OUT com 5 exclusões; notável que o OUT documenta decisão de não validar JWT criptograficamente com justificativa |
| 5 | Dependências mapeadas | ✅ Dependência de Story 1.1 declarada com aviso de risco explícito ("aplicar esta story antes da 1.1 derrubará a autenticação de todos os usuários") |
| 6 | Estimativa de complexidade | ✅ P (Pequeno) — totalmente justificado: 1 arquivo, mudanças mínimas (renomear variável e nome do cookie) |
| 7 | Valor de negócio claro | ✅ Corrige o problema raiz do loop de redirect em produção de forma definitiva, completando o Epic 1 |
| 8 | Riscos documentados | ❌ Risco de dependência de Story 1.1 está documentado, porém não há menção ao risco de a Story 1.2 mudar o nome do cookie de `token` para `access_token` — a story já corretamente usa `access_token`, mas não explicita que essa nomenclatura vem da Story 1.2 de forma rastreável. Risco de Edge Runtime comportamento inconsistente entre ambientes (Vercel Edge vs local) não documentado formalmente. |
| 9 | Critérios de Done claros | ✅ Arquivo afetado único listado; ACs cobrem todos os cenários de navegação; item 7 do IN exige "teste manual obrigatório" antes de fechar |
| 10 | Alinhamento com PRD/Epic | ✅ Alinha com o escopo do Epic 1 Story 1.3: leitura do cookie, rotas públicas sem loop, rotas protegidas com redirect correto, teste manual dos 4 cenários |

**Observações:**
- Score 9/10 pela ausência de documentação formal dos riscos de Edge Runtime em diferentes ambientes de deploy (Vercel vs local Next.js). Não é bloqueante, mas @sm deve considerar adicionar na próxima iteração.
- A story menciona "após Story 1.1" e "após Story 1.2" em diferentes pontos ao descrever o nome do cookie — a seção de Dependências cita apenas Story 1.1. Tecnicamente correto (o nome `access_token` é definido na Story 1.2), mas a seção Dependências deveria listar ambas as stories para evitar ambiguidade. Recomendação para @sm.
- Story é adequada para execução — o escopo mínimo (1 arquivo, 2 mudanças) é ideal para uma P0 onde o risco de regressão deve ser minimizado.

---

## Resumo Geral

| Story | Título | Score | Veredicto |
|-------|--------|-------|-----------|
| 1.1 | Padronizar token storage (cookie httpOnly) | 10/10 | GO |
| 1.2 | Implementar refresh token | 10/10 | GO |
| 1.3 | Corrigir middleware.ts para validação consistente | 9/10 | GO |

**Avaliação geral:** O Epic 1 está com qualidade de documentação acima da média. As três stories apresentam contexto técnico preciso, critérios de aceitação verificáveis e escopo bem delimitado. A sequência de dependências (1.1 → 1.2 → 1.3) está clara e o risco de execução fora de ordem está documentado.

**Ações de status:**
- Story 1.1: status atualizado para **Ready**
- Story 1.2: status atualizado para **Ready**
- Story 1.3: status atualizado para **Ready**

**Itens de melhoria para @sm (não bloqueantes):**
1. Story 1.2: adicionar `docs/framework/tech-stack.md` e `CLAUDE.md` à lista de Arquivos Afetados (variável `REFRESH_TOKEN_SECRET`)
2. Story 1.2: considerar adicionar nota sobre comportamento de múltiplas requisições simultâneas expiradas (fila de retries no interceptor)
3. Story 1.3: adicionar Story 1.2 à seção Dependências (o nome `access_token` é definido na 1.2)
4. Story 1.3: documentar risco de comportamento do Edge Runtime em Vercel vs desenvolvimento local

---

*Relatório gerado por @po (Pax, Balancer) em 2026-02-27*

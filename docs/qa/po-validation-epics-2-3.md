# Relatório de Validação PO — Épicos 2 e 3

**Data:** 2026-02-27
**Validador:** @po (Pax, Balancer)
**Escopo:** Stories 2.1, 2.2, 2.3 (Epic 2 — Kanban Drag-and-Drop) e 3.1, 3.2, 3.3 (Epic 3 — Exportação de Dados PDF/CSV)

---

## Checklist Aplicado (10 pontos)

| # | Critério |
|---|----------|
| 1 | Título claro e objetivo |
| 2 | Descrição completa |
| 3 | Critérios de aceitação testáveis |
| 4 | Escopo IN/OUT definido |
| 5 | Dependências mapeadas |
| 6 | Estimativa de complexidade |
| 7 | Valor de negócio claro |
| 8 | Riscos documentados |
| 9 | Critérios de Done claros (DoD explícito) |
| 10 | Alinhamento com PRD/Epic |

---

## Story 2.1 — Setup @dnd-kit/core no Projeto

**Score: 8/10 | Veredicto: GO**

| # | Critério | Avaliação |
|---|----------|-----------|
| 1 | Título claro e objetivo | PASSOU — Título preciso, identifica biblioteca e escopo |
| 2 | Descrição completa | PASSOU — Descreve persona (dev), objetivo e contexto técnico detalhado |
| 3 | Critérios de aceitação testáveis | PASSOU — 5 ACs bem escritos no formato Dado/Quando/Então; AC5 valida build |
| 4 | Escopo IN/OUT definido | PASSOU — IN com 8 itens detalhados; OUT declara explicitamente o que fica para 2.2 e 2.3 |
| 5 | Dependências mapeadas | PASSOU — "Nenhuma" declarado explicitamente, correto para primeira story do épico |
| 6 | Estimativa de complexidade | PASSOU — M (Medium) definido |
| 7 | Valor de negócio claro | PASSOU — Contexto justifica a troca (suporte touch, feedback visual); valor implícito na UX |
| 8 | Riscos documentados | FALHOU — Nenhum risco mencionado (ex: breaking change no HTML5 drag existente, compatibilidade iOS Safari) |
| 9 | Critérios de Done claros | FALHOU — Não há seção DoD explícita; AC5 (build sem erros) é o mais próximo |
| 10 | Alinhamento com PRD/Epic | PASSOU — Alinhado com Epic 2 Kanban Drag-and-Drop |

**Observações:** Story tecnicamente bem escrita. Para as próximas iterações, recomenda-se adicionar seção "Riscos" (risco de regressão na funcionalidade de busca/filtro existente) e DoD explícito com critérios como "code review aprovado" e "testado em Chrome/Safari/mobile".

---

## Story 2.2 — Drag entre Colunas com Update de Status via API

**Score: 8/10 | Veredicto: GO**

| # | Critério | Avaliação |
|---|----------|-----------|
| 1 | Título claro e objetivo | PASSOU — Título comunica ação (drag), objeto (colunas) e mecanismo (API) |
| 2 | Descrição completa | PASSOU — Persona de negócio (usuário da agência), contexto técnico do endpoint existente |
| 3 | Critérios de aceitação testáveis | PASSOU — 5 ACs completos; AC2 cobre o caso de drag na mesma coluna (edge case importante) |
| 4 | Escopo IN/OUT definido | PASSOU — OUT delimita claramente o que pertence à 2.3 (rollback) |
| 5 | Dependências mapeadas | PASSOU — Dependência na Story 2.1 declarada com artefatos específicos |
| 6 | Estimativa de complexidade | PASSOU — M (Medium) definido |
| 7 | Valor de negócio claro | PASSOU — "sem precisar abrir um modal" comunica valor diretamente |
| 8 | Riscos documentados | FALHOU — Riscos não documentados (ex: chamadas duplicadas por double-drop, endpoint PATCH pode ter latência alta) |
| 9 | Critérios de Done claros | FALHOU — Sem seção DoD explícita |
| 10 | Alinhamento com PRD/Epic | PASSOU — Continuidade natural de 2.1, bem alinhado ao épico |

**Observações:** AC4 merece destaque positivo por ser explícito sobre o comportamento em erro sem rollback — delimita claramente a responsabilidade desta story versus a 2.3. Risco de inconsistência visual (card fica na posição errada após erro até Story 2.3) deveria estar documentado como risco conhecido e aceito.

---

## Story 2.3 — Atualização Otimista + Rollback em Erro de API

**Score: 9/10 | Veredicto: GO**

| # | Critério | Avaliação |
|---|----------|-----------|
| 1 | Título claro e objetivo | PASSOU — Título técnico preciso, menciona os dois mecanismos centrais |
| 2 | Descrição completa | PASSOU — Descreve o problema atual (delay, flickering), a solução e a restrição de arquitetura (sem Zustand/Redux) |
| 3 | Critérios de aceitação testáveis | PASSOU — 6 ACs, o mais completo do épico; AC4 cobre race condition, AC6 cobre UX |
| 4 | Escopo IN/OUT definido | PASSOU — OUT menciona WebSocket e retry automático, decisão arquitetural justificada |
| 5 | Dependências mapeadas | PASSOU — Dependência em 2.2 com artefatos específicos |
| 6 | Estimativa de complexidade | PASSOU — P (Pequeno) definido; estimativa plausível dado que 2.2 fez o trabalho pesado |
| 7 | Valor de negócio claro | PASSOU — "interface fluida" e "feedback honesto" são valores percebidos pelo usuário |
| 8 | Riscos documentados | PARCIAL — Race condition citada no escopo IN como item a tratar, mas não há avaliação de probabilidade/impacto como seção dedicada |
| 9 | Critérios de Done claros | FALHOU — Sem seção DoD explícita |
| 10 | Alinhamento com PRD/Epic | PASSOU — Fecha o ciclo do épico 2 com qualidade de UX |

**Observações:** A story mais madura do épico 2. O tratamento do race condition via closure está bem especificado no escopo. AC2 ("em até 100ms após a resposta") é mensurável e específico. Falta apenas seção de riscos formal e DoD.

---

## Story 3.1 — Export CSV para Relatórios

**Score: 8/10 | Veredicto: GO**

| # | Critério | Avaliação |
|---|----------|-----------|
| 1 | Título claro e objetivo | PASSOU — Título identifica formato (CSV), domínio (Relatórios) e os dois tipos de dados |
| 2 | Descrição completa | PASSOU — Persona (admin/gerente), objetivo (Excel/Google Sheets), contexto de endpoints existentes |
| 3 | Critérios de aceitação testáveis | PASSOU — 5 ACs cobrindo: formato, encoding, autorização, download no browser e CSV vazio |
| 4 | Escopo IN/OUT definido | PASSOU — IN detalhado com headers HTTP, cabeçalhos CSV e proteção de role; OUT claro |
| 5 | Dependências mapeadas | PASSOU — "Nenhuma" declarado, com nota de paralelismo com Epic 2 |
| 6 | Estimativa de complexidade | PASSOU — M (Medium) definido |
| 7 | Valor de negócio claro | PASSOU — Análise de dados em ferramentas de planilha é valor tangível |
| 8 | Riscos documentados | FALHOU — Risco de segurança com token via query param não documentado formalmente; risco de dados muito grandes gerando CSV lento |
| 9 | Critérios de Done claros | FALHOU — Sem seção DoD explícita |
| 10 | Alinhamento com PRD/Epic | PASSOU — Alinhado ao Epic 3 Exportação de Dados |

**Observações:** A nota sobre `?token=` na URL é um risco de segurança (token exposto em logs de servidor/proxy) que merece ser documentado como risco conhecido com decisão explícita. AC5 (CSV vazio apenas com cabeçalho) é um caso de borda valioso que demonstra maturidade da story.

---

## Story 3.2 — Export PDF para Fatura (Invoice)

**Score: 9/10 | Veredicto: GO**

| # | Critério | Avaliação |
|---|----------|-----------|
| 1 | Título claro e objetivo | PASSOU — Título identifica formato (PDF), domínio (Fatura/Invoice) |
| 2 | Descrição completa | PASSOU — Persona, objetivo comercial, biblioteca escolhida com justificativa, abordagem de stream sem disco |
| 3 | Critérios de aceitação testáveis | PASSOU — 6 ACs; AC6 valida contrato de reusabilidade para Story 3.3 (inovador) |
| 4 | Escopo IN/OUT definido | PASSOU — OUT lista o que é placeholder (generateBudgetPdf) e o que é futuro (email, assinatura) |
| 5 | Dependências mapeadas | PASSOU — "Nenhuma dentro do Epic 3" com nota de que 3.3 depende desta |
| 6 | Estimativa de complexidade | PASSOU — G (Grande) definido; adequado dado o layout completo do PDF |
| 7 | Valor de negócio claro | PASSOU — "enviá-lo ao cliente de forma profissional" é valor direto |
| 8 | Riscos documentados | FALHOU — Riscos não documentados: pdfkit pode ter problemas com fontes UTF-8 (acentos), stream PDF pode falhar se fatura tiver muitos itens |
| 9 | Critérios de Done claros | PARCIAL — AC6 funciona como critério de qualidade de código, mas não há DoD formal |
| 10 | Alinhamento com PRD/Epic | PASSOU — Alinhado ao Epic 3; cria utilitário compartilhado para 3.3 |

**Observações:** A estratégia de criar `pdf.service.ts` como utilitário compartilhado com stub para 3.3 é uma decisão arquitetural bem comunicada. AC6 é um diferencial positivo — garante reusabilidade por contrato. A estimativa G está bem justificada pelo layout completo.

---

## Story 3.3 — Export PDF para Orçamento (Budget)

**Score: 9/10 | Veredicto: GO**

| # | Critério | Avaliação |
|---|----------|-----------|
| 1 | Título claro e objetivo | PASSOU — Título identifica formato (PDF), domínio (Orçamento/Budget) |
| 2 | Descrição completa | PASSOU — Referencia o stub da 3.2, lista os status do Budget, informa ausência de novos pacotes |
| 3 | Critérios de aceitação testáveis | PASSOU — 6 ACs; AC6 exige não duplicação de código com helpers compartilhados (qualidade técnica mensurável) |
| 4 | Escopo IN/OUT definido | PASSOU — OUT clarifica que os templates são distintos (fatura vs orçamento) |
| 5 | Dependências mapeadas | PASSOU — Dependência em 3.2 com artefatos específicos (pdfkit, pdf.service.ts, estrutura base) |
| 6 | Estimativa de complexidade | PASSOU — M (Medium) adequado dado que estrutura base já existe |
| 7 | Valor de negócio claro | PASSOU — "enviá-lo ao cliente para aprovação comercial" é valor de processo de vendas |
| 8 | Riscos documentados | FALHOU — Sem seção de riscos; risco de divergência de layout entre fatura e orçamento não documentado |
| 9 | Critérios de Done claros | PARCIAL — AC6 funciona como DoD de qualidade, mas sem seção formal |
| 10 | Alinhamento com PRD/Epic | PASSOU — Fecha o Epic 3, consistente com 3.2 |

**Observações:** Story bem construída em continuidade com 3.2. A decisão de reusar helpers (`formatCurrency`, `drawTable`, `drawHeader`) comunicada via AC6 é boa prática. A nota sobre `validUntil` no rodapé e o campo de status para todos os estados do Budget demonstra atenção aos casos de uso.

---

## Tabela Resumo

| Story | Titulo | Desc | ACs | Escopo | Deps | Estimativa | Valor | Riscos | DoD | Alinhamento | **Score** | **Veredicto** |
|-------|--------|------|-----|--------|------|------------|-------|--------|-----|-------------|-----------|---------------|
| 2.1 | OK | OK | OK | OK | OK | OK | OK | FALHOU | FALHOU | OK | **8/10** | **GO** |
| 2.2 | OK | OK | OK | OK | OK | OK | OK | FALHOU | FALHOU | OK | **8/10** | **GO** |
| 2.3 | OK | OK | OK | OK | OK | OK | OK | PARCIAL | FALHOU | OK | **9/10** | **GO** |
| 3.1 | OK | OK | OK | OK | OK | OK | OK | FALHOU | FALHOU | OK | **8/10** | **GO** |
| 3.2 | OK | OK | OK | OK | OK | OK | OK | FALHOU | PARCIAL | OK | **9/10** | **GO** |
| 3.3 | OK | OK | OK | OK | OK | OK | OK | FALHOU | PARCIAL | OK | **9/10** | **GO** |

**Resultado: 6/6 GO | 0/6 NO-GO**

---

## Padrao de Melhoria Identificado

Todas as 6 stories aprovaram nos mesmos 8 pontos e falharam nos mesmos 2:

- **Ponto 8 — Riscos:** Nenhuma story possui seção dedicada de riscos com avaliacao de probabilidade/impacto. Recomenda-se criar template padrao de story com campo "Riscos" obrigatório a partir do próximo sprint.
- **Ponto 9 — DoD explícito:** Nenhuma story possui seção "Critérios de Done" separada dos ACs. ACs testam comportamento funcional; DoD deve cobrir: code review aprovado, testes automatizados passando, build sem erros em CI, testado em ambiente de staging. Recomenda-se adicionar DoD padrão ao template ou usar um DoD global do projeto referenciado em cada story.

---

*Relatório gerado por @po (Pax, Balancer) em 2026-02-27.*

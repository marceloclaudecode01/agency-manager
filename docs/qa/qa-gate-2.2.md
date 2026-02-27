# QA Gate — Story 2.2: Drag entre Colunas com Update de Status via API

**Data:** 2026-02-27
**Revisor:** @qa (Quinn, Guardian)
**Status da Story:** InReview
**Veredicto Final:** PASS

---

## 1. Code Review

O código está limpo e bem estruturado. Os handlers `handleDragStart`, `handleDragEnd` e `handleDragCancel` estão corretamente separados. O `onDragEnd` extrai `active.id` e `over?.id` conforme o padrão do dnd-kit. A atualização local de estado (`setTasks`) é feita imediatamente após sucesso da API (antecipando parcialmente a Story 2.3, mas de forma aceitável — sem rollback). O `DragOverlay` renderiza `TaskCard` com prop `overlay` para snapshot visual. Sensores configurados com constraints adequados (`distance: 5` para pointer, `delay: 250` para touch).

**Resultado:** OK

---

## 2. Critérios de Aceitação Verificados no Código

| AC | Descrição | Status |
|----|-----------|--------|
| AC1 | Card na nova coluna + toast de sucesso após API 200 | PASS — `setTasks` + `toast('Status da tarefa atualizado')` no bloco try |
| AC2 | Sem chamada PATCH se mesma coluna de origem | PASS — guard `if (task.status === newStatus) return` na linha 118 |
| AC3 | Borda destacada na coluna com `isOver` | PASS — `KanbanColumn.tsx` aplica `ring-2 ring-primary/40 bg-surface/80` quando `isOver` |
| AC4 | Toast de erro se API falhar, card permanece onde solto | PASS — bloco catch exibe toast de erro; sem rollback (correto para esta story) |
| AC5 | Filtros de busca funcionam após drag bem-sucedido | PASS — `filteredTasks` é derivado de `tasks` (state), que é atualizado corretamente; filtro por `search` permanece ativo |

**Resultado:** Todos os 5 ACs verificados.

---

## 3. Regressoes

- O fluxo de criação de tarefas (modal + POST) permanece intacto e independente da lógica de drag.
- `loadData` não é chamado após drag — apenas o state local é atualizado — sem side-effects indesejados em outras partes da UI.
- O backend (`tasks.routes.ts`) já possuía a rota `PATCH /:id/status` com `authMiddleware` e `validate(updateTaskStatusSchema)`. Nenhuma alteração nessa rota.

**Resultado:** Sem regressoes identificadas.

---

## 4. Segurança

- Nenhuma informação sensível exposta no frontend.
- O `taskId` vem de `active.id` (gerado pelo dnd-kit a partir de `task.id`, controlado pela aplicação).
- O `newStatus` é validado no frontend contra `['TODO', 'IN_PROGRESS', 'DONE']` antes de chamar a API (linha 121-122). O backend valida novamente via `updateTaskStatusSchema` (Zod). Defesa em profundidade presente.
- `authMiddleware` protege todos os endpoints de tasks — nenhuma rota pública.

**Resultado:** OK — sem issues de segurança.

---

## 5. Escopo

Todo o escopo IN da story foi implementado:
- Handler `onDragEnd` com guards corretos.
- Chamada `api.patch`.
- Feedback visual: `isOver` em `KanbanColumn`, `isDragging` com `opacity-40` em `TaskCard`.
- Toast de sucesso e erro.
- `pointer-events-none` + `opacity-60` para tasks com status inválido/undefined.

Nada do escopo OUT foi implementado (atualização otimista e rollback pertencem à Story 2.3).

**Resultado:** Escopo respeitado.

---

## 6. Tratamento de Erros

- Guard `if (!over) return` previne execução sem alvo.
- Guard `if (!task) return` previne NPE se task não for encontrada.
- Guard de status inválido evita chamadas desnecessárias à API.
- Bloco try/catch no `handleDragEnd` captura falhas de rede/API e exibe toast.
- `handleDragCancel` limpa `activeId`, evitando estado inconsistente no overlay.

**Ponto de atenção menor:** O estado local é atualizado antes de aguardar confirmação do servidor (linha 127-129) — isso é uma atualização otimista parcial, comportamento correto e esperado para UX. Não configura bug.

**Resultado:** Tratamento de erros adequado.

---

## 7. Documentação

- Comentários inline explicam os guards e a lógica dos sensores (`// PointerSensor for mouse/desktop, TouchSensor with delay for iOS Safari`).
- A prop `overlay` em `TaskCard` tem JSDoc explicativo.
- Código autodocumentado com nomes descritivos.

**Resultado:** Documentação suficiente para o escopo da story.

---

## Resumo

| Verificacao | Resultado |
|-------------|-----------|
| Code Review | PASS |
| ACs Verificados | PASS (5/5) |
| Sem Regressoes | PASS |
| Segurança | PASS |
| Escopo | PASS |
| Tratamento de Erros | PASS |
| Documentação | PASS |

## Veredicto: PASS

A implementação está correta, completa e segura. Story 2.2 aprovada para merge.

# Epic 2 — Kanban Drag-and-Drop

> Prioridade: P1
> Dependências: Epic 1 (auth estável antes de novas features)
> @sm deve detalhar as stories abaixo.

---

## Problema

O board Kanban em `frontend/src/app/(dashboard)/tasks/` existe visualmente com colunas TODO / IN_PROGRESS / DONE, mas o drag-and-drop entre colunas **não está implementado**. O usuário pode apenas clicar em um card e editar o status via modal/form — experiência inferior ao prometido no PRD.

**Arquivos afetados:**
- `frontend/src/app/(dashboard)/tasks/page.tsx` — página principal do Kanban
- `frontend/src/components/tasks/` — componentes de card e coluna (se existirem)
- `backend/src/modules/tasks/` — endpoint `PATCH /api/tasks/:id/status` (já existe, deve ser usado)

---

## Stories

### Story 2.1 — Instalar e configurar @dnd-kit/core
**Escopo:**
- Instalar `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` no frontend
- Configurar `DndContext` na página de tarefas
- Definir os `Droppable` containers (uma coluna por status)
- Definir os `Draggable` items (um por task card)
- Sem lógica de negócio nesta story — apenas setup visual do DnD funcional

### Story 2.2 — Implementar drag entre colunas com update de status
**Escopo:**
- Handler `onDragEnd` que identifica coluna de origem e destino
- Ao soltar em nova coluna: chamar `PATCH /api/tasks/:id/status` com novo status
- Mapear nomes de coluna para enum: `TODO` | `IN_PROGRESS` | `DONE`
- Feedback visual durante o drag (card semi-transparente, coluna destacada)
- Não permitir drop na mesma coluna (sem chamada de API desnecessária)

### Story 2.3 — Persistência otimista + rollback em erro
**Escopo:**
- Atualizar o estado local do board imediatamente ao soltar o card (antes da resposta da API)
- Se a API retornar erro: reverter o card para a coluna original e exibir toast de erro
- Loading state no card durante a chamada (cursor bloqueado, overlay sutil)
- Garantir que a lista de tasks do hook (`useTasks` ou similar) seja invalidada/refetchada após sucesso

**Fora do escopo:** Reordenação dentro da mesma coluna (prioridade futura)

---

## Criterios de Sucesso

- [ ] Arrastar card entre colunas atualiza o status no banco
- [ ] Em caso de erro de rede, o card retorna à coluna original
- [ ] A transição é visualmente fluida (sem flickering)
- [ ] Funciona em dispositivos touch (mobile) — testar no iOS Safari
- [ ] Nenhuma regressão nos filtros existentes de campanha/responsável/prioridade

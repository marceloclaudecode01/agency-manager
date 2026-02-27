# Padrões de Código — Agência de Marketing Digital

## Backend

### Estrutura de Módulo
Cada módulo em `backend/src/modules/<nome>/` segue:
```
<nome>/
├── <nome>.controller.ts   # Recebe req/res, chama service, retorna resposta
├── <nome>.service.ts      # Lógica de negócio, chama Prisma
├── <nome>.routes.ts       # Definição das rotas Express
└── <nome>.schema.ts       # Validação Zod dos inputs
```

### Módulos existentes
`auth` | `calendar` | `campaigns` | `chat` | `clients` | `dashboard` | `finance` | `notifications` | `products` | `reports` | `social` | `tasks` | `users` | `agents`

### Padrões obrigatórios
- **Prisma client:** singleton em `src/config/database.ts` — nunca instanciar direto
- **Respostas:** sempre via `src/utils/api-response.ts` (`ApiResponse.success()` / `ApiResponse.error()`)
- **Validação:** Zod schema em `<nome>.schema.ts`, validar antes de chegar no service
- **Auth middleware:** `src/middlewares/auth.ts` — proteger rotas com `authenticate`
- **Tipos globais:** `src/types/` — não redefinir tipos que já existem

### Convenções de código
```typescript
// Controller: sempre async, sempre try/catch, sempre retornar ApiResponse
export async function createClient(req: Request, res: Response) {
  try {
    const data = clientSchema.parse(req.body)
    const result = await clientService.create(data, req.user.id)
    return ApiResponse.success(res, result, 201)
  } catch (error) {
    return ApiResponse.error(res, error)
  }
}
```

---

## Frontend

### Estrutura de Rotas (App Router)
```
src/app/
├── (auth)/          # Login, Register — sem sidebar
│   ├── login/
│   └── register/
└── (dashboard)/     # Layout compartilhado: sidebar + header
    ├── dashboard/
    ├── clients/
    ├── campaigns/
    ├── tasks/
    ├── finance/
    ├── reports/
    ├── calendar/
    ├── team/
    ├── social/
    ├── products/
    ├── agents/
    ├── chat/
    └── settings/
```

### Estrutura de Componentes
```
src/components/<módulo>/   # Componentes específicos do módulo
src/components/ui/         # shadcn/ui base components
```

### Padrões obrigatórios
- **API client:** centralizado em `src/lib/api.ts` — nunca fazer fetch direto
- **Hooks customizados:** `src/hooks/` — lógica de dados fora dos componentes
- **Contextos:** `src/contexts/` — estado global (auth, etc.)
- **Tipos:** `src/types/` — interfaces compartilhadas

### Convenções de código
```typescript
// Hook de dados: sempre useCallback, sempre estado de loading/error
export function useClients() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  // ...fetch via api.ts
}

// Componente: Server Component por padrão, 'use client' só se necessário
// Estilização: Tailwind classes direto, sem CSS modules
// UI: sempre usar shadcn/ui antes de criar componente novo
```

---

## Regras Gerais

- Nunca commitar `.env` ou `.env.local`
- Nunca fazer `git push` direto — sempre via `@devops *push`
- TypeScript strict mode ativado — sem `any` sem justificativa
- Toda nova feature começa com uma story em `docs/stories/`

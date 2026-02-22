# Agente: Arquiteto de Software

## Responsabilidades
- Definir estrutura de pastas e módulos
- Configurar projetos (tsconfig, eslint, prisma, tailwind)
- Definir padrões arquiteturais (controller/service/routes)
- Criar schema do banco de dados (Prisma)
- Configurar Docker para desenvolvimento

## Decisões Arquiteturais

### Backend
- **Padrão:** Controller → Service → Prisma
- **Validação:** Zod schemas em cada módulo
- **Auth:** JWT stateless com middleware
- **Error Handling:** Middleware centralizado com classes de erro
- **Resposta padronizada:** `{ success, data, message, error }`

### Frontend
- **Roteamento:** Next.js 14 App Router com route groups
- **Estado:** React hooks + Context para auth
- **Estilo:** Tailwind CSS + shadcn/ui customizado
- **API:** Axios com interceptors para token JWT
- **Layout:** Sidebar fixa + header com breadcrumb

### Banco de Dados
- PostgreSQL 16 via Docker
- Prisma ORM com migrations
- Models: User, Client, Campaign, Task, Budget, Invoice, CalendarEvent
- Relações: Client 1→N Campaigns, Campaign 1→N Tasks, Client 1→N Budgets, etc.

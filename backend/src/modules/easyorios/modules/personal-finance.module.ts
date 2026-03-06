import { EasyoriosModule, CommandDefinition, ModuleContext, ModuleAlert, QuickAction } from '../core/module.interface';
import prisma from '../../../config/database';

const CATEGORY_MAP: Record<string, string> = {
  comida: 'alimentacao', alimentacao: 'alimentacao', restaurante: 'alimentacao', mercado: 'alimentacao',
  almoco: 'alimentacao', jantar: 'alimentacao', lanche: 'alimentacao', cafe: 'alimentacao',
  uber: 'transporte', transporte: 'transporte', gasolina: 'transporte', onibus: 'transporte',
  metro: 'transporte', estacionamento: 'transporte', pedagio: 'transporte',
  cinema: 'lazer', lazer: 'lazer', netflix: 'lazer', spotify: 'lazer', jogo: 'lazer', bar: 'lazer',
  aluguel: 'moradia', moradia: 'moradia', condominio: 'moradia', luz: 'moradia', agua: 'moradia',
  internet: 'moradia', gas: 'moradia',
  farmacia: 'saude', saude: 'saude', medico: 'saude', dentista: 'saude', academia: 'saude',
  curso: 'educacao', educacao: 'educacao', livro: 'educacao', escola: 'educacao', faculdade: 'educacao',
  salario: 'salario', freelance: 'freelance', investimento: 'investimento',
};

function detectCategory(description: string): string {
  const lower = description.toLowerCase();
  for (const [keyword, category] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(keyword)) return category;
  }
  return 'outro';
}

function parseAmount(text: string): number | null {
  // Match: R$50, R$ 50, 50 reais, 50.00, 50,50, R$1.500,00
  const match = text.match(/R?\$?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/);
  if (!match) return null;
  let numStr = match[1]
    .replace(/\./g, '')  // remove thousand separators
    .replace(',', '.');  // decimal comma to dot
  const num = parseFloat(numStr);
  return isNaN(num) ? null : num;
}

export class PersonalFinanceModule implements EasyoriosModule {
  id = 'finance';
  name = 'Financas Pessoais';
  icon = 'DollarSign';
  contextPriority = 7;

  getCommands(): CommandDefinition[] {
    return [
      // ─── Add expense ───
      {
        name: 'add_expense',
        description: 'Registrar gasto',
        patterns: [
          /(?:gastei|paguei|comprei|gasto)\s+(?:R?\$?\s*)(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s+(?:em|com|de|no|na|pro|pra)\s+(.+)/i,
          /(?:despesa|expense):\s*(?:R?\$?\s*)(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s+(.+)/i,
        ],
        requiredRole: 'MEMBER',
        execute: async (match, userId) => {
          const amount = parseAmount(match[1]);
          if (!amount) return { command: 'add_expense', success: false, message: 'Valor invalido.' };
          const description = match[2]?.trim() || 'Gasto';
          const category = detectCategory(description);

          await prisma.personalTransaction.create({
            data: { userId, type: 'expense', amount, description, category },
          });

          return {
            command: 'add_expense',
            success: true,
            message: `Gasto registrado: R$ ${amount.toFixed(2)} em "${description}" [${category}]`,
            data: { amount, description, category, type: 'expense' },
          };
        },
      },
      // ─── Add income ───
      {
        name: 'add_income',
        description: 'Registrar receita',
        patterns: [
          /(?:recebi|ganhei|entrou|receita)\s+(?:R?\$?\s*)(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:de|do|da|com|por)?\s*(.*)/i,
          /(?:renda|income):\s*(?:R?\$?\s*)(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(.*)/i,
        ],
        requiredRole: 'MEMBER',
        execute: async (match, userId) => {
          const amount = parseAmount(match[1]);
          if (!amount) return { command: 'add_income', success: false, message: 'Valor invalido.' };
          const description = match[2]?.trim() || 'Receita';
          const category = detectCategory(description);

          await prisma.personalTransaction.create({
            data: { userId, type: 'income', amount, description, category },
          });

          return {
            command: 'add_income',
            success: true,
            message: `Receita registrada: R$ ${amount.toFixed(2)} — "${description}" [${category}]`,
            data: { amount, description, category, type: 'income' },
          };
        },
      },
      // ─── Monthly summary ───
      {
        name: 'monthly_summary',
        description: 'Resumo financeiro do mes',
        patterns: [
          /(?:quanto\s+gastei|resumo\s+financeiro|financas|finan[cç]as|balanco|balan[cç]o)\s*(?:esse|este|do)?\s*(?:mes|mês)?/i,
          /(?:meu|minha)\s+(?:financ|gasto|despesa)/i,
        ],
        requiredRole: 'MEMBER',
        execute: async (_match, userId) => {
          const monthStart = new Date();
          monthStart.setDate(1);
          monthStart.setHours(0, 0, 0, 0);

          const transactions = await prisma.personalTransaction.findMany({
            where: { userId, date: { gte: monthStart } },
            orderBy: { date: 'desc' },
          });

          const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
          const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
          const balance = income - expenses;

          // Group expenses by category
          const byCategory: Record<string, number> = {};
          transactions.filter(t => t.type === 'expense').forEach(t => {
            const cat = t.category || 'outro';
            byCategory[cat] = (byCategory[cat] || 0) + t.amount;
          });

          const categoryLines = Object.entries(byCategory)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, val]) => `  - ${cat}: R$ ${val.toFixed(2)}`)
            .join('\n');

          return {
            command: 'monthly_summary',
            success: true,
            message: `Resumo financeiro do mes:\n- Receitas: R$ ${income.toFixed(2)}\n- Despesas: R$ ${expenses.toFixed(2)}\n- Saldo: R$ ${balance.toFixed(2)}\n- Transacoes: ${transactions.length}\n${categoryLines ? `\nPor categoria:\n${categoryLines}` : ''}`,
            data: { income, expenses, balance, transactionCount: transactions.length, byCategory },
          };
        },
      },
      // ─── Recent transactions ───
      {
        name: 'recent_transactions',
        description: 'Ultimas transacoes',
        patterns: [
          /(?:ultimas?|últimas?|recentes?)\s+(?:transac|despesa|gasto|movimentac)/i,
          /(?:listar?|ver|mostrar?)\s+(?:transac|despesa|gasto|movimentac)/i,
          /(?:historico|histórico)\s+financ/i,
        ],
        requiredRole: 'MEMBER',
        execute: async (_match, userId) => {
          const transactions = await prisma.personalTransaction.findMany({
            where: { userId },
            orderBy: { date: 'desc' },
            take: 10,
          });

          if (transactions.length === 0) {
            return { command: 'recent_transactions', success: true, message: 'Nenhuma transacao registrada.' };
          }

          const lines = transactions.map((t, i) => {
            const sign = t.type === 'income' ? '+' : '-';
            const date = t.date.toLocaleDateString('pt-BR');
            return `${i + 1}. ${sign} R$ ${t.amount.toFixed(2)} — ${t.description} [${t.category || 'outro'}] (${date})`;
          });

          return {
            command: 'recent_transactions',
            success: true,
            message: `Ultimas ${transactions.length} transacoes:\n${lines.join('\n')}`,
            data: { transactions },
          };
        },
      },
    ];
  }

  async gatherContext(userId: string): Promise<ModuleContext> {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const results = await Promise.allSettled([
      prisma.personalTransaction.aggregate({
        where: { userId, type: 'expense', date: { gte: monthStart } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.personalTransaction.aggregate({
        where: { userId, type: 'income', date: { gte: monthStart } },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const expenses = results[0].status === 'fulfilled' ? results[0].value : { _sum: { amount: 0 }, _count: 0 };
    const income = results[1].status === 'fulfilled' ? results[1].value : { _sum: { amount: 0 }, _count: 0 };

    const expTotal = (expenses as any)._sum?.amount || 0;
    const incTotal = (income as any)._sum?.amount || 0;
    const balance = incTotal - expTotal;

    return {
      moduleId: 'finance',
      summary: `Receitas: R$ ${incTotal.toFixed(2)} | Despesas: R$ ${expTotal.toFixed(2)} | Saldo: R$ ${balance.toFixed(2)}`,
      metrics: { monthlyIncome: incTotal, monthlyExpenses: expTotal, balance },
    };
  }

  async getQuickActions(_userId: string): Promise<QuickAction[]> {
    return [
      { label: 'Resumo Financeiro', prompt: 'resumo financeiro', icon: 'DollarSign', moduleId: 'finance' },
      { label: 'Ultimas Transacoes', prompt: 'ultimas transacoes', icon: 'List', moduleId: 'finance' },
    ];
  }

  async getProactiveAlerts(userId: string): Promise<ModuleAlert[]> {
    const alerts: ModuleAlert[] = [];

    try {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const expenses = await prisma.personalTransaction.aggregate({
        where: { userId, type: 'expense', date: { gte: monthStart } },
        _sum: { amount: true },
      });

      const total = expenses._sum?.amount || 0;
      if (total > 5000) {
        alerts.push({
          id: 'finance-high-expenses',
          moduleId: 'finance',
          title: 'Gastos elevados',
          message: `R$ ${total.toFixed(2)} em despesas este mes.`,
          severity: 'warning',
          createdAt: new Date(),
        });
      }
    } catch {}

    return alerts;
  }
}

import { EasyoriosModule, CommandDefinition, ModuleContext, ModuleAlert, QuickAction } from '../core/module.interface';
import * as nlm from '../core/notebooklm.service';

// Map of topic keywords to best artifact types (used by autonomous generate_artifact)
const ARTIFACT_TYPE_MAP: Record<string, string[]> = {
  educativo: ['quiz', 'flashcards'],
  educação: ['quiz', 'flashcards'],
  tutorial: ['quiz', 'flashcards'],
  estratégia: ['briefing-doc', 'mind-map'],
  análise: ['briefing-doc', 'mind-map'],
  analise: ['briefing-doc', 'mind-map'],
  planejamento: ['briefing-doc', 'mind-map'],
  apresentação: ['slide-deck', 'infographic'],
  apresentacao: ['slide-deck', 'infographic'],
  cliente: ['slide-deck', 'infographic'],
  proposta: ['slide-deck', 'infographic'],
  engajamento: ['audio', 'video'],
  audiência: ['audio', 'video'],
  audiencia: ['audio', 'video'],
  podcast: ['audio'],
  dados: ['data-table', 'briefing-doc'],
  métricas: ['data-table', 'briefing-doc'],
  metricas: ['data-table', 'briefing-doc'],
  relatório: ['briefing-doc'],
  relatorio: ['briefing-doc'],
};

function pickArtifactType(topic: string): string {
  const lower = topic.toLowerCase();
  for (const [keyword, types] of Object.entries(ARTIFACT_TYPE_MAP)) {
    if (lower.includes(keyword)) return types[0];
  }
  // Default: briefing-doc is the most versatile
  return 'briefing-doc';
}

function fmtResult(label: string, res: nlm.CLIResult): string {
  if (!res.success) return `Erro ao ${label}: ${res.error}`;
  if (typeof res.data === 'string') return res.data;
  return JSON.stringify(res.data, null, 2);
}

export class NotebookLmModule implements EasyoriosModule {
  id = 'notebooklm';
  name = 'NotebookLM';
  icon = 'BookOpen';
  contextPriority = 8;

  getCommands(): CommandDefinition[] {
    return [
      // ─── Create Notebook ───
      {
        name: 'create_notebook',
        description: 'Criar notebook no NotebookLM',
        patterns: [/(?:criar?|create)\s+notebook\s+(.+)/i],
        requiredRole: 'MEMBER',
        execute: async (match) => {
          const title = match[1]?.trim();
          if (!title) return { command: 'create_notebook', success: false, message: 'Titulo do notebook nao informado.' };
          const res = await nlm.createNotebook(title);
          return {
            command: 'create_notebook',
            success: res.success,
            message: res.success ? `Notebook "${title}" criado com sucesso!\n${fmtResult('criar', res)}` : fmtResult('criar notebook', res),
            data: res.data,
          };
        },
      },
      // ─── Add Source ───
      {
        name: 'add_source',
        description: 'Adicionar fonte ao notebook',
        patterns: [/(?:adicionar?\s+fonte|add\s+source)\s+(.+)/i],
        requiredRole: 'MEMBER',
        execute: async (match) => {
          const content = match[1]?.trim();
          if (!content) return { command: 'add_source', success: false, message: 'Fonte nao informada.' };
          const res = await nlm.addSource(content);
          return {
            command: 'add_source',
            success: res.success,
            message: res.success ? `Fonte adicionada: "${content.substring(0, 80)}"` : fmtResult('adicionar fonte', res),
            data: res.data,
          };
        },
      },
      // ─── Research Topic ───
      {
        name: 'research_topic',
        description: 'Pesquisar tema e adicionar ao notebook',
        patterns: [/(?:pesquisar?|research)\s+(.+)/i],
        requiredRole: 'MEMBER',
        execute: async (match) => {
          const query = match[1]?.trim();
          if (!query) return { command: 'research_topic', success: false, message: 'Tema nao informado.' };
          const res = await nlm.addResearch(query);
          return {
            command: 'research_topic',
            success: res.success,
            message: res.success
              ? `Pesquisa iniciada sobre "${query}". O NotebookLM esta processando em background.`
              : fmtResult('pesquisar', res),
            data: res.data,
          };
        },
      },
      // ─── Generate Artifact (AUTONOMOUS) ───
      {
        name: 'generate_artifact',
        description: 'Gerar conteudo — o brain decide o melhor tipo automaticamente',
        patterns: [/(?:gerar?|generate)\s+(?:conteúdo|conteudo|content|material)\s+(?:sobre|about)\s+(.+)/i],
        requiredRole: 'MEMBER',
        execute: async (match) => {
          const topic = match[1]?.trim();
          if (!topic) return { command: 'generate_artifact', success: false, message: 'Tema nao informado.' };

          const artifactType = pickArtifactType(topic);
          const res = await nlm.generateArtifact(artifactType, topic);

          return {
            command: 'generate_artifact',
            success: res.success,
            message: res.success
              ? `Artefato gerado (tipo: ${artifactType}) sobre "${topic}":\n${fmtResult('gerar', res)}`
              : fmtResult('gerar artefato', res),
            data: { type: artifactType, topic, ...res.data },
          };
        },
      },
      // ─── Generate Podcast ───
      {
        name: 'generate_podcast',
        description: 'Gerar podcast/audio',
        patterns: [/(?:podcast|áudio|audio)\s+(?:sobre|about)?\s*(.+)/i],
        requiredRole: 'MEMBER',
        execute: async (match) => {
          const topic = match[1]?.trim();
          if (!topic) return { command: 'generate_podcast', success: false, message: 'Tema nao informado.' };
          const res = await nlm.generateArtifact('audio', topic);
          return {
            command: 'generate_podcast',
            success: res.success,
            message: res.success ? `Podcast gerado sobre "${topic}":\n${fmtResult('gerar', res)}` : fmtResult('gerar podcast', res),
            data: res.data,
          };
        },
      },
      // ─── Generate Report ───
      {
        name: 'generate_report',
        description: 'Gerar relatorio/briefing',
        patterns: [/(?:relatório|relatorio|report|briefing)\s+(?:sobre|about)?\s*(.+)/i],
        requiredRole: 'MEMBER',
        execute: async (match) => {
          const topic = match[1]?.trim();
          if (!topic) return { command: 'generate_report', success: false, message: 'Tema nao informado.' };
          const res = await nlm.generateArtifact('briefing-doc', topic);
          return {
            command: 'generate_report',
            success: res.success,
            message: res.success ? `Relatorio gerado sobre "${topic}":\n${fmtResult('gerar', res)}` : fmtResult('gerar relatorio', res),
            data: res.data,
          };
        },
      },
      // ─── Generate Video ───
      {
        name: 'generate_video',
        description: 'Gerar video',
        patterns: [/(?:vídeo|video)\s+(?:sobre|about)?\s*(.+)/i],
        requiredRole: 'MEMBER',
        execute: async (match) => {
          const topic = match[1]?.trim();
          if (!topic) return { command: 'generate_video', success: false, message: 'Tema nao informado.' };
          const res = await nlm.generateArtifact('video', topic);
          return {
            command: 'generate_video',
            success: res.success,
            message: res.success ? `Video gerado sobre "${topic}":\n${fmtResult('gerar', res)}` : fmtResult('gerar video', res),
            data: res.data,
          };
        },
      },
      // ─── Generate Slides ───
      {
        name: 'generate_slides',
        description: 'Gerar slide deck/apresentacao',
        patterns: [/(?:slides?|apresentação|apresentacao|presentation)\s+(?:sobre|about)?\s*(.+)/i],
        requiredRole: 'MEMBER',
        execute: async (match) => {
          const topic = match[1]?.trim();
          if (!topic) return { command: 'generate_slides', success: false, message: 'Tema nao informado.' };
          const res = await nlm.generateArtifact('slide-deck', topic);
          return {
            command: 'generate_slides',
            success: res.success,
            message: res.success ? `Slides gerados sobre "${topic}":\n${fmtResult('gerar', res)}` : fmtResult('gerar slides', res),
            data: res.data,
          };
        },
      },
      // ─── Ask Notebook ───
      {
        name: 'ask_notebook',
        description: 'Perguntar ao notebook',
        patterns: [
          /(?:perguntar?\s+(?:ao\s+)?notebook|ask\s+notebook)\s+(.+)/i,
        ],
        requiredRole: 'MEMBER',
        execute: async (match) => {
          const question = match[1]?.trim();
          if (!question) return { command: 'ask_notebook', success: false, message: 'Pergunta nao informada.' };
          const res = await nlm.askNotebook(question);
          return {
            command: 'ask_notebook',
            success: res.success,
            message: res.success ? `Resposta do NotebookLM:\n${fmtResult('perguntar', res)}` : fmtResult('perguntar ao notebook', res),
            data: res.data,
          };
        },
      },
      // ─── List Notebooks ───
      {
        name: 'list_notebooks',
        description: 'Listar notebooks',
        patterns: [/(?:listar?\s+notebooks?|list\s+notebooks?|meus\s+notebooks?)/i],
        requiredRole: 'MEMBER',
        execute: async () => {
          const res = await nlm.listNotebooks();
          if (!res.success) return { command: 'list_notebooks', success: false, message: fmtResult('listar notebooks', res) };

          const notebooks = Array.isArray(res.data) ? res.data : [];
          if (notebooks.length === 0) {
            return { command: 'list_notebooks', success: true, message: 'Nenhum notebook encontrado.' };
          }

          const lines = notebooks.map((nb: any, i: number) => `${i + 1}. **${nb.title || nb.id}** (ID: ${nb.id})`);
          return {
            command: 'list_notebooks',
            success: true,
            message: `${notebooks.length} notebook(s):\n${lines.join('\n')}`,
            data: { notebooks },
          };
        },
      },
      // ─── List Artifacts ───
      {
        name: 'list_artifacts',
        description: 'Listar artefatos gerados',
        patterns: [/(?:listar?\s+(?:artefatos|artifacts)|meus\s+(?:artefatos|artifacts))/i],
        requiredRole: 'MEMBER',
        execute: async () => {
          const res = await nlm.listArtifacts();
          if (!res.success) return { command: 'list_artifacts', success: false, message: fmtResult('listar artefatos', res) };

          const artifacts = Array.isArray(res.data) ? res.data : [];
          if (artifacts.length === 0) {
            return { command: 'list_artifacts', success: true, message: 'Nenhum artefato gerado ainda.' };
          }

          const lines = artifacts.map((a: any, i: number) => `${i + 1}. [${a.type}] ${a.status || 'unknown'} — ID: ${a.id}`);
          return {
            command: 'list_artifacts',
            success: true,
            message: `${artifacts.length} artefato(s):\n${lines.join('\n')}`,
            data: { artifacts },
          };
        },
      },
    ];
  }

  async gatherContext(_userId: string): Promise<ModuleContext> {
    const [nbRes, artRes] = await Promise.allSettled([
      nlm.listNotebooks(),
      nlm.listArtifacts(),
    ]);

    const notebooks = nbRes.status === 'fulfilled' && nbRes.value.success && Array.isArray(nbRes.value.data) ? nbRes.value.data : [];
    const artifacts = artRes.status === 'fulfilled' && artRes.value.success && Array.isArray(artRes.value.data) ? artRes.value.data : [];

    let researchMeta = { lastResearchAt: null as string | null, totalInsights: 0, topTopics: [] as string[] };
    try {
      const { getResearchMeta } = await import('../../../services/research-intelligence.service');
      researchMeta = await getResearchMeta();
    } catch {}

    return {
      moduleId: 'notebooklm',
      summary: `${notebooks.length} notebook(s) | ${artifacts.length} artefato(s) | ${researchMeta.totalInsights} insight(s) de pesquisa`,
      metrics: {
        totalNotebooks: notebooks.length,
        totalArtifacts: artifacts.length,
        totalResearchInsights: researchMeta.totalInsights,
        lastResearchAt: researchMeta.lastResearchAt,
        topResearchTopics: researchMeta.topTopics,
      },
    };
  }

  async getQuickActions(_userId: string): Promise<QuickAction[]> {
    return [
      { label: 'Gerar Podcast', prompt: 'podcast sobre tendencias de marketing', icon: 'Mic', moduleId: 'notebooklm' },
      { label: 'Relatorio Semanal', prompt: 'relatorio sobre desempenho da agencia', icon: 'FileText', moduleId: 'notebooklm' },
      { label: 'Pesquisar Concorrencia', prompt: 'pesquisar concorrencia marketing digital 2026', icon: 'Search', moduleId: 'notebooklm' },
      { label: 'Meus Notebooks', prompt: 'listar notebooks', icon: 'BookOpen', moduleId: 'notebooklm' },
    ];
  }

  async getProactiveAlerts(_userId: string): Promise<ModuleAlert[]> {
    const alerts: ModuleAlert[] = [];

    try {
      const sugRes = await nlm.getArtifactSuggestions();
      if (sugRes.success && Array.isArray(sugRes.data) && sugRes.data.length > 0) {
        alerts.push({
          id: 'notebooklm-suggestions',
          moduleId: 'notebooklm',
          title: 'Sugestoes do NotebookLM',
          message: `${sugRes.data.length} sugestao(oes) de artefatos disponiveis. Diga "listar artefatos" para ver.`,
          severity: 'info',
          createdAt: new Date(),
        });
      }
    } catch {}

    // Alert if no research in 3+ days
    try {
      const { getResearchMeta } = await import('../../../services/research-intelligence.service');
      const meta = await getResearchMeta();
      if (!meta.lastResearchAt || (Date.now() - new Date(meta.lastResearchAt).getTime()) > 3 * 24 * 60 * 60 * 1000) {
        alerts.push({
          id: 'notebooklm-no-research',
          moduleId: 'notebooklm',
          title: 'Sem pesquisa recente',
          message: 'Nenhuma pesquisa NotebookLM nos ultimos 3 dias. Diga "pesquisar tendencias marketing digital" para atualizar.',
          severity: 'warning',
          createdAt: new Date(),
        });
      }
    } catch {}

    return alerts;
  }
}

'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Loading } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import { formatDateTime } from '@/lib/utils';
import {
  Facebook, Users, Eye, TrendingUp, Heart, Plus, RefreshCw, Trash2,
  Clock, Sparkles, Calendar, CheckCircle, XCircle, Bot, BarChart3,
  Zap, ChevronRight, AlertCircle,
} from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
  PUBLISHED: 'Publicado',
  FAILED: 'Falhou',
};

const STATUS_VARIANTS: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  PENDING: 'warning',
  APPROVED: 'default',
  REJECTED: 'error',
  PUBLISHED: 'success',
  FAILED: 'error',
};

export default function SocialPage() {
  const { toast } = useToast();

  // Facebook
  const [pageInfo, setPageInfo] = useState<any>(null);
  const [insights, setInsights] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [postForm, setPostForm] = useState({ message: '', imageUrl: '', scheduledTime: '' });

  // Agentes IA
  const [activeTab, setActiveTab] = useState<'social' | 'agents'>('social');
  const [scheduledPosts, setScheduledPosts] = useState<any[]>([]);
  const [metricsReports, setMetricsReports] = useState<any[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);

  // Geração de post com IA
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedPost, setGeneratedPost] = useState<any>(null);
  const [genForm, setGenForm] = useState({ topic: '', extraContext: '' });

  // Aprovação de post gerado
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [approving, setApproving] = useState(false);

  // Plano semanal
  const [showWeeklyModal, setShowWeeklyModal] = useState(false);
  const [weeklyFocus, setWeeklyFocus] = useState('');
  const [weeklyPlan, setWeeklyPlan] = useState<any[]>([]);
  const [generatingWeekly, setGeneratingWeekly] = useState(false);

  // Análise de métricas
  const [analyzingMetrics, setAnalyzingMetrics] = useState(false);

  useEffect(() => { loadSocial(); }, []);
  useEffect(() => { if (activeTab === 'agents') loadAgents(); }, [activeTab]);

  const loadSocial = async () => {
    setLoading(true);
    try {
      const connRes = await api.get('/social/connection');
      if (!connRes.data.data.connected) { setConnected(false); return; }
      setConnected(true);
      const [infoRes, insightsRes, postsRes] = await Promise.all([
        api.get('/social/page'),
        api.get('/social/insights?period=month'),
        api.get('/social/posts?limit=6'),
      ]);
      setPageInfo(infoRes.data.data);
      setInsights(insightsRes.data.data);
      setPosts(postsRes.data.data || []);
    } catch {
      toast('Erro ao carregar dados do Facebook', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadAgents = async () => {
    setAgentsLoading(true);
    try {
      const [scheduledRes, metricsRes] = await Promise.all([
        api.get('/agents/scheduled'),
        api.get('/agents/metrics'),
      ]);
      setScheduledPosts(scheduledRes.data.data || []);
      setMetricsReports(metricsRes.data.data || []);
    } catch {
      toast('Erro ao carregar dados dos agentes', 'error');
    } finally {
      setAgentsLoading(false);
    }
  };

  // Publicar post direto no Facebook
  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postForm.message.trim()) return;
    setPublishing(true);
    try {
      await api.post('/social/posts', {
        message: postForm.message,
        imageUrl: postForm.imageUrl || null,
        scheduledTime: postForm.scheduledTime || null,
      });
      toast(postForm.scheduledTime ? 'Post agendado!' : 'Post publicado!', 'success');
      setShowPostModal(false);
      setPostForm({ message: '', imageUrl: '', scheduledTime: '' });
      loadSocial();
    } catch (err: any) {
      toast(err.response?.data?.message || 'Erro ao publicar', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const handleDeleteFbPost = async (postId: string) => {
    try {
      await api.delete(`/social/posts/${postId}`);
      toast('Post removido', 'success');
      loadSocial();
    } catch {
      toast('Erro ao remover post', 'error');
    }
  };

  // Gerar post com IA
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genForm.topic.trim()) return;
    setGenerating(true);
    setGeneratedPost(null);
    try {
      const res = await api.post('/agents/generate-post', genForm);
      setGeneratedPost(res.data.data);
    } catch (err: any) {
      toast(err.response?.data?.message || 'Erro ao gerar post', 'error');
    } finally {
      setGenerating(false);
    }
  };

  // Salvar post gerado no banco (já como APPROVED + data)
  const handleSaveGenerated = async () => {
    if (!generatedPost || !scheduleDate) return;
    setApproving(true);
    try {
      await api.post('/agents/scheduled', {
        topic: generatedPost.topic,
        message: generatedPost.message,
        hashtags: generatedPost.hashtags,
        scheduledFor: scheduleDate,
      });
      toast('Post agendado com sucesso!', 'success');
      setShowGenerateModal(false);
      setGeneratedPost(null);
      setGenForm({ topic: '', extraContext: '' });
      setScheduleDate('');
      loadAgents();
    } catch (err: any) {
      toast(err.response?.data?.message || 'Erro ao agendar post', 'error');
    } finally {
      setApproving(false);
    }
  };

  // Aprovar post pendente
  const handleApprove = async () => {
    if (!selectedPost || !scheduleDate) return;
    setApproving(true);
    try {
      await api.patch(`/agents/scheduled/${selectedPost.id}/approve`, { scheduledFor: scheduleDate });
      toast('Post aprovado!', 'success');
      setShowApproveModal(false);
      setSelectedPost(null);
      setScheduleDate('');
      loadAgents();
    } catch {
      toast('Erro ao aprovar post', 'error');
    } finally {
      setApproving(false);
    }
  };

  // Rejeitar post
  const handleReject = async (id: string) => {
    try {
      await api.patch(`/agents/scheduled/${id}/reject`);
      toast('Post rejeitado', 'success');
      loadAgents();
    } catch {
      toast('Erro ao rejeitar post', 'error');
    }
  };

  // Deletar post agendado
  const handleDeleteScheduled = async (id: string) => {
    try {
      await api.delete(`/agents/scheduled/${id}`);
      toast('Post removido', 'success');
      loadAgents();
    } catch {
      toast('Erro ao remover post', 'error');
    }
  };

  // Plano semanal com IA
  const handleGenerateWeekly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weeklyFocus.trim()) return;
    setGeneratingWeekly(true);
    setWeeklyPlan([]);
    try {
      const res = await api.post('/agents/generate-weekly', { focus: weeklyFocus });
      setWeeklyPlan(res.data.data || []);
    } catch (err: any) {
      toast(err.response?.data?.message || 'Erro ao gerar plano', 'error');
    } finally {
      setGeneratingWeekly(false);
    }
  };

  // Rodar análise de métricas agora
  const handleRunMetrics = async () => {
    setAnalyzingMetrics(true);
    try {
      await api.post('/agents/metrics/run');
      toast('Análise concluída!', 'success');
      loadAgents();
    } catch (err: any) {
      toast(err.response?.data?.message || 'Erro ao analisar métricas', 'error');
    } finally {
      setAnalyzingMetrics(false);
    }
  };

  if (loading) return <Loading />;

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <div className="h-16 w-16 rounded-2xl bg-blue-500/10 flex items-center justify-center">
          <Facebook size={32} className="text-blue-500" />
        </div>
        <h2 className="text-xl font-heading font-semibold text-text-primary">Facebook não conectado</h2>
        <p className="text-text-secondary max-w-sm">
          Configure as variáveis{' '}
          <code className="text-primary-300">FACEBOOK_ACCESS_TOKEN</code> e{' '}
          <code className="text-primary-300">FACEBOOK_PAGE_ID</code> no arquivo{' '}
          <code>.env</code> do backend.
        </p>
        <Button onClick={loadSocial} variant="outline">
          <RefreshCw size={16} className="mr-2" /> Tentar novamente
        </Button>
      </div>
    );
  }

  const kpis = [
    { label: 'Seguidores', value: pageInfo?.followers_count?.toLocaleString('pt-BR') ?? '—', icon: Users, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { label: 'Curtidas', value: pageInfo?.fan_count?.toLocaleString('pt-BR') ?? '—', icon: Heart, color: 'text-pink-400', bg: 'bg-pink-400/10' },
    { label: 'Alcance mensal', value: insights?.page_impressions_unique?.value?.toLocaleString('pt-BR') ?? '—', icon: Eye, color: 'text-purple-400', bg: 'bg-purple-400/10' },
    { label: 'Engajamento', value: insights?.page_engaged_users?.value?.toLocaleString('pt-BR') ?? '—', icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-400/10' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          {pageInfo?.picture?.data?.url ? (
            <img src={pageInfo.picture.data.url} alt="Page" className="h-14 w-14 rounded-xl object-cover" />
          ) : (
            <div className="h-14 w-14 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Facebook size={28} className="text-blue-500" />
            </div>
          )}
          <div>
            <h2 className="text-lg font-heading font-semibold text-text-primary">{pageInfo?.name}</h2>
            <p className="text-sm text-text-secondary">{pageInfo?.category}</p>
          </div>
          <Badge variant="success">Conectado</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadSocial}>
            <RefreshCw size={14} className="mr-1" /> Atualizar
          </Button>
          <Button size="sm" onClick={() => setShowPostModal(true)}>
            <Plus size={14} className="mr-1" /> Novo Post
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg ${kpi.bg} flex items-center justify-center flex-shrink-0`}>
                <kpi.icon size={20} className={kpi.color} />
              </div>
              <div>
                <p className="text-xl font-heading font-bold text-text-primary">{kpi.value}</p>
                <p className="text-xs text-text-secondary">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {[
          { key: 'social', label: 'Posts Facebook', icon: Facebook },
          { key: 'agents', label: 'Agentes IA', icon: Bot },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary text-primary-300'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Posts Facebook */}
      {activeTab === 'social' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Posts recentes</h3>
            {posts.length === 0 ? (
              <Card><CardContent className="p-6 text-center text-text-secondary">Nenhum post encontrado</CardContent></Card>
            ) : (
              posts.map((post) => (
                <Card key={post.id}>
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      {post.full_picture && (
                        <img src={post.full_picture} alt="" className="h-16 w-16 rounded-lg object-cover flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary line-clamp-2">{post.message || post.story || '(sem legenda)'}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-text-secondary">{formatDateTime(post.created_time)}</span>
                          <div className="flex items-center gap-3 text-xs text-text-secondary">
                            {post.insights?.data?.map((ins: any) => (
                              <span key={ins.name} className="flex items-center gap-1">
                                {ins.name === 'post_impressions' && <><Eye size={12} />{ins.values?.[0]?.value ?? 0}</>}
                                {ins.name === 'post_engaged_users' && <><Heart size={12} />{ins.values?.[0]?.value ?? 0}</>}
                              </span>
                            ))}
                            <button onClick={() => handleDeleteFbPost(post.id)} className="text-error hover:text-error/80 ml-1">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Visão da página</h3>
            <Card>
              <CardContent className="p-4 space-y-3">
                {pageInfo?.about && (
                  <p className="text-sm text-text-secondary">{pageInfo.about}</p>
                )}
                {pageInfo?.website && (
                  <a href={pageInfo.website} target="_blank" rel="noreferrer" className="text-sm text-primary-300 flex items-center gap-1 hover:underline">
                    <ChevronRight size={14} /> {pageInfo.website}
                  </a>
                )}
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-text-secondary mb-1">Crescimento de seguidores (mês)</p>
                  <p className="text-lg font-bold text-text-primary">
                    {insights?.page_fan_adds?.value != null
                      ? `+${insights.page_fan_adds.value.toLocaleString('pt-BR')}`
                      : '—'}
                  </p>
                </div>
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-text-secondary mb-1">Visualizações da página</p>
                  <p className="text-lg font-bold text-text-primary">
                    {insights?.page_views_total?.value?.toLocaleString('pt-BR') ?? '—'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Tab: Agentes IA */}
      {activeTab === 'agents' && (
        <div className="space-y-6">
          {agentsLoading ? (
            <Loading />
          ) : (
            <>
              {/* Ações dos agentes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button onClick={() => setShowGenerateModal(true)} className="text-left rounded-xl border border-border bg-surface hover:border-primary/50 transition-colors">
                  <div className="p-5 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                      <Sparkles size={24} className="text-purple-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-text-primary">Gerar Post com IA</p>
                      <p className="text-xs text-text-secondary">Crie um post a partir de um tema</p>
                    </div>
                  </div>
                </button>

                <button onClick={() => setShowWeeklyModal(true)} className="text-left rounded-xl border border-border bg-surface hover:border-primary/50 transition-colors">
                  <div className="p-5 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <Calendar size={24} className="text-blue-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-text-primary">Plano Semanal</p>
                      <p className="text-xs text-text-secondary">7 posts gerados pela IA</p>
                    </div>
                  </div>
                </button>

                <button onClick={handleRunMetrics} disabled={analyzingMetrics} className="text-left rounded-xl border border-border bg-surface hover:border-primary/50 transition-colors disabled:opacity-60">
                  <div className="p-5 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                      {analyzingMetrics ? (
                        <RefreshCw size={24} className="text-green-400 animate-spin" />
                      ) : (
                        <BarChart3 size={24} className="text-green-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-text-primary">Analisar Métricas</p>
                      <p className="text-xs text-text-secondary">{analyzingMetrics ? 'Analisando...' : 'Gerar relatório agora'}</p>
                    </div>
                  </div>
                </button>
              </div>

              {/* Posts agendados pelo agente */}
              <div>
                <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
                  Posts Agendados pelos Agentes
                  <Badge variant="default" className="ml-2 normal-case">{scheduledPosts.length}</Badge>
                </h3>
                {scheduledPosts.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Zap size={32} className="text-text-secondary mx-auto mb-2 opacity-40" />
                      <p className="text-text-secondary text-sm">Nenhum post agendado. Gere um com IA!</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {scheduledPosts.map((post) => (
                      <Card key={post.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant={STATUS_VARIANTS[post.status] || 'default'}>
                                  {STATUS_LABELS[post.status] || post.status}
                                </Badge>
                                <span className="text-xs text-text-secondary font-medium">{post.topic}</span>
                              </div>
                              <p className="text-sm text-text-primary line-clamp-2">{post.message}</p>
                              {post.hashtags && (
                                <p className="text-xs text-primary-300 mt-1 line-clamp-1">{post.hashtags}</p>
                              )}
                              <div className="flex items-center gap-1 mt-2 text-xs text-text-secondary">
                                <Clock size={12} />
                                {post.status === 'PUBLISHED' && post.publishedAt
                                  ? `Publicado em ${formatDateTime(post.publishedAt)}`
                                  : post.scheduledFor
                                  ? `Agendado para ${formatDateTime(post.scheduledFor)}`
                                  : 'Sem data definida'}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {post.status === 'PENDING' && (
                                <>
                                  <button
                                    onClick={() => { setSelectedPost(post); setShowApproveModal(true); }}
                                    className="p-1.5 text-success hover:bg-success/10 rounded"
                                    title="Aprovar"
                                  >
                                    <CheckCircle size={18} />
                                  </button>
                                  <button
                                    onClick={() => handleReject(post.id)}
                                    className="p-1.5 text-error hover:bg-error/10 rounded"
                                    title="Rejeitar"
                                  >
                                    <XCircle size={18} />
                                  </button>
                                </>
                              )}
                              {(post.status === 'REJECTED' || post.status === 'FAILED') && (
                                <button
                                  onClick={() => handleDeleteScheduled(post.id)}
                                  className="p-1.5 text-text-secondary hover:text-error rounded"
                                  title="Remover"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Relatórios de métricas */}
              {metricsReports.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">Últimos Relatórios de Métricas</h3>
                  <div className="space-y-3">
                    {metricsReports.slice(0, 3).map((report) => (
                      <Card key={report.id}>
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-sm font-bold
                                ${report.growthScore >= 7 ? 'bg-success/10 text-success' : report.growthScore >= 4 ? 'bg-warning/10 text-warning' : 'bg-error/10 text-error'}
                              `}>
                                {report.growthScore}
                              </div>
                              <span className="text-xs text-text-secondary">Score de crescimento</span>
                            </div>
                            <span className="text-xs text-text-secondary">{formatDateTime(report.createdAt)}</span>
                          </div>
                          <p className="text-sm text-text-primary mb-3">{report.summary}</p>
                          {report.recommendations?.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Recomendações</p>
                              {(report.recommendations as string[]).map((rec, i) => (
                                <div key={i} className="flex items-start gap-2 text-xs text-text-secondary">
                                  <AlertCircle size={12} className="mt-0.5 flex-shrink-0 text-warning" />
                                  {rec}
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modal: Novo Post direto */}
      <Modal isOpen={showPostModal} onClose={() => setShowPostModal(false)} title="Novo Post no Facebook">
        <form onSubmit={handlePublish} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Legenda *</label>
            <textarea
              value={postForm.message}
              onChange={(e) => setPostForm({ ...postForm, message: e.target.value })}
              rows={4}
              required
              placeholder="Escreva a legenda do post..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>
          <Input label="URL da imagem (opcional)" type="url" placeholder="https://..." value={postForm.imageUrl} onChange={(e) => setPostForm({ ...postForm, imageUrl: e.target.value })} />
          <Input label="Agendar para (opcional)" type="datetime-local" value={postForm.scheduledTime} onChange={(e) => setPostForm({ ...postForm, scheduledTime: e.target.value })} />
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setShowPostModal(false)}>Cancelar</Button>
            <Button type="submit" disabled={publishing}>
              {publishing ? 'Publicando...' : postForm.scheduledTime ? 'Agendar' : 'Publicar agora'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Gerar post com IA */}
      <Modal isOpen={showGenerateModal} onClose={() => { setShowGenerateModal(false); setGeneratedPost(null); setGenForm({ topic: '', extraContext: '' }); setScheduleDate(''); }} title="Gerar Post com IA">
        <div className="space-y-4">
          {!generatedPost ? (
            <form onSubmit={handleGenerate} className="space-y-4">
              <Input
                label="Tema do post *"
                placeholder="Ex: lançamento de série, dica de streaming..."
                value={genForm.topic}
                onChange={(e) => setGenForm({ ...genForm, topic: e.target.value })}
                required
              />
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Contexto adicional (opcional)</label>
                <textarea
                  value={genForm.extraContext}
                  onChange={(e) => setGenForm({ ...genForm, extraContext: e.target.value })}
                  rows={2}
                  placeholder="Informações extras para a IA..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setShowGenerateModal(false)}>Cancelar</Button>
                <Button type="submit" disabled={generating}>
                  {generating ? <><RefreshCw size={14} className="mr-2 animate-spin" />Gerando...</> : <><Sparkles size={14} className="mr-2" />Gerar</>}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
                <p className="text-sm text-text-primary">{generatedPost.message}</p>
                <p className="text-xs text-primary-300">{generatedPost.hashtags?.map((h: string) => `#${h.replace('#', '')}`).join(' ')}</p>
                <p className="text-xs text-text-secondary flex items-center gap-1">
                  <Clock size={12} /> Horário sugerido: {generatedPost.suggestedTime}
                </p>
              </div>
              <Input
                label="Agendar para *"
                type="datetime-local"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                required
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setGeneratedPost(null)}>Gerar outro</Button>
                <Button onClick={handleSaveGenerated} disabled={!scheduleDate || approving}>
                  {approving ? 'Agendando...' : 'Agendar post'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal: Aprovar post pendente */}
      <Modal isOpen={showApproveModal} onClose={() => { setShowApproveModal(false); setSelectedPost(null); setScheduleDate(''); }} title="Aprovar Post">
        {selectedPost && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-surface p-4 space-y-2">
              <p className="text-sm font-medium text-text-secondary">{selectedPost.topic}</p>
              <p className="text-sm text-text-primary">{selectedPost.message}</p>
              {selectedPost.hashtags && <p className="text-xs text-primary-300">{selectedPost.hashtags}</p>}
            </div>
            <Input
              label="Agendar para *"
              type="datetime-local"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowApproveModal(false)}>Cancelar</Button>
              <Button onClick={handleApprove} disabled={!scheduleDate || approving}>
                {approving ? 'Aprovando...' : <><CheckCircle size={14} className="mr-2" />Aprovar e Agendar</>}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Plano semanal */}
      <Modal isOpen={showWeeklyModal} onClose={() => { setShowWeeklyModal(false); setWeeklyPlan([]); setWeeklyFocus(''); }} title="Plano Semanal com IA">
        <div className="space-y-4">
          {weeklyPlan.length === 0 ? (
            <form onSubmit={handleGenerateWeekly} className="space-y-4">
              <Input
                label="Tema geral da semana *"
                placeholder="Ex: filmes de ação, séries de comédia..."
                value={weeklyFocus}
                onChange={(e) => setWeeklyFocus(e.target.value)}
                required
              />
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setShowWeeklyModal(false)}>Cancelar</Button>
                <Button type="submit" disabled={generatingWeekly}>
                  {generatingWeekly ? <><RefreshCw size={14} className="mr-2 animate-spin" />Gerando 7 posts...</> : <><Sparkles size={14} className="mr-2" />Gerar plano</>}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              <p className="text-sm text-text-secondary">{weeklyPlan.length} posts gerados. Você pode adicionar cada um individualmente à fila.</p>
              {weeklyPlan.map((post, i) => (
                <div key={i} className="rounded-lg border border-border bg-surface p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-primary-300">Dia {i + 1} — {post.topic}</p>
                    <span className="text-xs text-text-secondary flex items-center gap-1">
                      <Clock size={11} /> {post.suggestedTime}
                    </span>
                  </div>
                  <p className="text-sm text-text-primary">{post.message}</p>
                  <p className="text-xs text-text-secondary">{post.hashtags?.map((h: string) => `#${h.replace('#', '')}`).join(' ')}</p>
                </div>
              ))}
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setWeeklyPlan([])}>Gerar novamente</Button>
                <Button onClick={() => setShowWeeklyModal(false)}>Fechar</Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

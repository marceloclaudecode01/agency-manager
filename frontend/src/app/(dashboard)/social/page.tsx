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
  Zap, ChevronRight, AlertCircle, Flame, ShoppingCart, Tag,
  Package, Brain, Shield, ExternalLink, Link2, Lock, Youtube, Music2, MessageSquare,
} from 'lucide-react';

const PLATFORMS = [
  { key: 'facebook', label: 'Facebook', icon: Facebook, color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/30', enabled: true },
  { key: 'instagram', label: 'Instagram', icon: Heart, color: 'text-pink-500', bg: 'bg-pink-500/10 border-pink-500/30', enabled: false },
  { key: 'youtube', label: 'YouTube', icon: Youtube, color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/30', enabled: false },
  { key: 'tiktok', label: 'TikTok', icon: Music2, color: 'text-cyan-400', bg: 'bg-cyan-400/10 border-cyan-400/30', enabled: false },
] as const;

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
  const [postForm, setPostForm] = useState({ message: '', imageUrl: '', linkUrl: '', mediaType: '' as '' | 'image' | 'video', scheduledTime: '' });
  const [postMediaFile, setPostMediaFile] = useState<File | null>(null);
  const [postMediaPreview, setPostMediaPreview] = useState<string | null>(null);
  const [uploadingPostMedia, setUploadingPostMedia] = useState(false);

  // Agentes IA
  const [activeTab, setActiveTab] = useState<'social' | 'performance' | 'agents'>('social');
  const [performanceData, setPerformanceData] = useState<any>(null);
  const [loadingPerformance, setLoadingPerformance] = useState(false);
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

  // Trending topics
  const [showTrendingModal, setShowTrendingModal] = useState(false);
  const [trendingReport, setTrendingReport] = useState<any>(null);
  const [loadingTrending, setLoadingTrending] = useState(false);
  const [trendingNiche, setTrendingNiche] = useState('');

  // TikTok Shop + Orquestrador
  const [showProductsModal, setShowProductsModal] = useState(false);
  const [tiktokProducts, setTiktokProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [runningOrchestrator, setRunningOrchestrator] = useState(false);
  const [productQuery, setProductQuery] = useState('');
  const [orchestratorResult, setOrchestratorResult] = useState<any>(null);

  // Post a partir de link
  const [productLink, setProductLink] = useState('');
  const [creatingFromLink, setCreatingFromLink] = useState(false);
  const [linkPostResult, setLinkPostResult] = useState<any>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Growth Insights
  const [showGrowthModal, setShowGrowthModal] = useState(false);
  const [growthInsights, setGrowthInsights] = useState<any>(null);
  const [loadingGrowth, setLoadingGrowth] = useState(false);

  // Token status
  const [tokenStatus, setTokenStatus] = useState<any>(null);

  useEffect(() => { loadSocial(); }, []);
  useEffect(() => {
    if (activeTab === 'agents') { loadAgents(); loadTokenStatus(); }
    if (activeTab === 'performance' && !performanceData) { loadPerformance(); }
  }, [activeTab]);

  const loadPerformance = async () => {
    setLoadingPerformance(true);
    try {
      const [overviewRes, postsRes, bestTimesRes] = await Promise.all([
        api.get('/analytics/overview').catch(() => ({ data: { data: null } })),
        api.get('/analytics/posts').catch(() => ({ data: { data: null } })),
        api.get('/analytics/best-times').catch(() => ({ data: { data: null } })),
      ]);
      setPerformanceData({
        overview: overviewRes.data.data,
        posts: postsRes.data.data,
        bestTimes: bestTimesRes.data.data,
      });
    } catch {
      toast('Erro ao carregar performance', 'error');
    } finally {
      setLoadingPerformance(false);
    }
  };

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

  const handlePostMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('video/') && file.size > 200 * 1024 * 1024) {
      toast('Video muito grande. Limite de 2 minutos/200MB.', 'error');
      e.currentTarget.value = '';
      return;
    }

    setPostMediaFile(file);
    setPostMediaPreview(URL.createObjectURL(file));
    setPostForm((f) => ({ ...f, mediaType: file.type.startsWith('video/') ? 'video' : 'image' }));
  };

  const clearPostMedia = () => {
    setPostMediaFile(null);
    setPostMediaPreview(null);
    setPostForm(f => ({ ...f, imageUrl: '', mediaType: '' }));
  };

  // Publicar post direto no Facebook
  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postForm.message.trim()) return;
    setPublishing(true);
    try {
      let mediaUrl = postForm.imageUrl || null;
      let mediaType = postForm.mediaType || null;

      if (postMediaFile) {
        setUploadingPostMedia(true);
        const formData = new FormData();
        formData.append('file', postMediaFile);
        const uploadRes = await api.post('/agents/upload-media', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        mediaUrl = uploadRes.data.data.url;
        mediaType = uploadRes.data.data.resourceType || (postMediaFile.type.startsWith('video/') ? 'video' : 'image');
        setUploadingPostMedia(false);
      }

      await api.post('/social/posts', {
        message: postForm.message,
        imageUrl: mediaUrl,
        mediaUrl,
        mediaType,
        linkUrl: postForm.linkUrl || null,
        scheduledTime: postForm.scheduledTime || null,
      });

      toast(postForm.scheduledTime ? 'Post agendado!' : 'Post publicado!', 'success');
      setShowPostModal(false);
      setPostForm({ message: '', imageUrl: '', linkUrl: '', mediaType: '', scheduledTime: '' });
      setPostMediaFile(null);
      setPostMediaPreview(null);
      loadSocial();
    } catch (err: any) {
      setUploadingPostMedia(false);
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

  // Carregar status do token
  const loadTokenStatus = async () => {
    try {
      const res = await api.get('/agents/token/status');
      setTokenStatus(res.data.data);
    } catch {}
  };

  // Buscar produtos TikTok Shop
  const handleFetchProducts = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingProducts(true);
    setTiktokProducts([]);
    try {
      const params = productQuery.trim() ? `?query=${encodeURIComponent(productQuery)}` : '';
      const res = await api.get(`/agents/products/tiktok${params}`);
      setTiktokProducts(res.data.data || []);
    } catch (err: any) {
      toast(err.response?.data?.message || 'Erro ao buscar produtos', 'error');
    } finally {
      setLoadingProducts(false);
    }
  };

  // Executar orquestrador completo (pesquisa + copy + agenda)
  const handleRunOrchestrator = async () => {
    setRunningOrchestrator(true);
    setOrchestratorResult(null);
    try {
      const res = await api.post('/agents/products/run', { query: productQuery || undefined });
      setOrchestratorResult(res.data.data);
      toast(`${res.data.data.postsCreated} posts de produto criados!`, 'success');
      loadAgents();
    } catch (err: any) {
      toast(err.response?.data?.message || 'Erro ao executar orquestrador', 'error');
    } finally {
      setRunningOrchestrator(false);
    }
  };

  // Upload de mídia
  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaFile(file);
    const url = URL.createObjectURL(file);
    setMediaPreview(url);
  };

  const clearMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
  };

  // Criar post a partir de link de produto
  const handleCreateFromLink = async () => {
    if (!productLink.trim()) return toast('Cole um link de produto', 'error');
    setCreatingFromLink(true);
    setLinkPostResult(null);
    try {
      let mediaUrl: string | null = null;

      // Faz upload da mídia se houver
      if (mediaFile) {
        setUploadingMedia(true);
        const formData = new FormData();
        formData.append('file', mediaFile);
        const uploadRes = await api.post('/agents/upload-media', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        mediaUrl = uploadRes.data.data.url;
        setUploadingMedia(false);
      }

      const res = await api.post('/agents/post-from-link', {
        url: productLink.trim(),
        mediaUrl,
      });
      setLinkPostResult(res.data.data);
      toast('Post criado e agendado com sucesso!', 'success');
      setProductLink('');
      clearMedia();
      loadAgents();
    } catch (err: any) {
      setUploadingMedia(false);
      toast(err.response?.data?.message || 'Erro ao processar link', 'error');
    } finally {
      setCreatingFromLink(false);
    }
  };

  // Growth insights
  const handleFetchGrowth = async () => {
    setLoadingGrowth(true);
    setGrowthInsights(null);
    try {
      const res = await api.get('/agents/growth');
      setGrowthInsights(res.data.data);
    } catch (err: any) {
      toast(err.response?.data?.message || 'Erro ao buscar insights', 'error');
    } finally {
      setLoadingGrowth(false);
    }
  };

  // Buscar trending topics
  const handleFetchTrending = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingTrending(true);
    setTrendingReport(null);
    try {
      const params = trendingNiche.trim() ? `?niche=${encodeURIComponent(trendingNiche)}` : '';
      const res = await api.get(`/agents/trending${params}`);
      setTrendingReport(res.data.data);
    } catch (err: any) {
      toast(err.response?.data?.message || 'Erro ao buscar tendências', 'error');
    } finally {
      setLoadingTrending(false);
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
      {/* Platform Selector */}
      <div className="flex gap-3 flex-wrap">
        {PLATFORMS.map((p) => {
          const Icon = p.icon;
          return (
            <div
              key={p.key}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${
                p.enabled
                  ? `${p.bg} cursor-default shadow-sm`
                  : 'bg-surface border-border opacity-50 cursor-not-allowed'
              }`}
            >
              <Icon size={18} className={p.enabled ? p.color : 'text-gray-500'} />
              <span className={`text-sm font-medium ${p.enabled ? 'text-text-primary' : 'text-gray-500'}`}>{p.label}</span>
              {!p.enabled && <Lock size={12} className="text-gray-600 ml-1" />}
              {!p.enabled && <span className="text-xs text-gray-600">Em breve</span>}
            </div>
          );
        })}
      </div>

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
          <Card key={kpi.label} className="hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
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
          { key: 'performance', label: 'Performance', icon: BarChart3 },
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

      {/* Tab: Performance */}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          {loadingPerformance ? (
            <Loading />
          ) : !performanceData?.overview && !performanceData?.posts ? (
            <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
              <BarChart3 size={48} className="opacity-30 mb-3" />
              <p className="text-lg font-medium">Sem dados de performance ainda</p>
              <p className="text-sm mt-1">Os dados aparecerão quando os agentes coletarem métricas.</p>
            </div>
          ) : (
            <>
              {/* Overview Stats */}
              {performanceData?.overview && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total de Posts', value: performanceData.overview.totalPosts ?? 0, icon: Facebook, color: 'text-blue-400', bg: 'bg-blue-400/10' },
                    { label: 'Alcance Total', value: (performanceData.overview.totalReach ?? 0).toLocaleString('pt-BR'), icon: Eye, color: 'text-purple-400', bg: 'bg-purple-400/10' },
                    { label: 'Engajamento Total', value: (performanceData.overview.totalEngagement ?? 0).toLocaleString('pt-BR'), icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-400/10' },
                    { label: 'Taxa Engajamento', value: `${(performanceData.overview.engagementRate ?? 0).toFixed(1)}%`, icon: Heart, color: 'text-pink-400', bg: 'bg-pink-400/10' },
                  ].map((stat) => (
                    <Card key={stat.label} className="hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-lg ${stat.bg} flex items-center justify-center flex-shrink-0`}>
                          <stat.icon size={20} className={stat.color} />
                        </div>
                        <div>
                          <p className="text-xl font-heading font-bold text-text-primary">{stat.value}</p>
                          <p className="text-xs text-text-secondary">{stat.label}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Top Posts */}
              {performanceData?.posts?.length > 0 && (
                <Card>
                  <CardHeader>
                    <h3 className="text-lg font-heading font-semibold text-text-primary">Melhores Posts</h3>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {performanceData.posts.slice(0, 5).map((post: any, idx: number) => (
                        <div key={post.id || idx} className="flex items-center justify-between rounded-lg bg-surface-hover/50 p-3">
                          <div className="flex-1 min-w-0 mr-4">
                            <p className="text-sm text-text-primary truncate">{post.message || post.content || 'Post sem texto'}</p>
                            <p className="text-xs text-text-secondary mt-0.5">{post.publishedAt ? formatDateTime(post.publishedAt) : ''}</p>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-text-secondary flex-shrink-0">
                            <span className="flex items-center gap-1"><Heart size={12} className="text-pink-400" /> {post.likes ?? 0}</span>
                            <span className="flex items-center gap-1"><MessageSquare size={12} className="text-blue-400" /> {post.comments ?? 0}</span>
                            <span className="flex items-center gap-1"><Eye size={12} className="text-purple-400" /> {post.reach ?? 0}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Best Times */}
              {performanceData?.bestTimes && (
                <Card>
                  <CardHeader>
                    <h3 className="text-lg font-heading font-semibold text-text-primary">Melhores Horários para Postar</h3>
                  </CardHeader>
                  <CardContent>
                    {Array.isArray(performanceData.bestTimes) && performanceData.bestTimes.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {performanceData.bestTimes.map((time: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
                            <Clock size={14} className="text-primary-300" />
                            <span className="text-sm text-text-primary">{time.hour ?? time.time ?? time}</span>
                            {time.engagement && <span className="text-xs text-text-secondary">({time.engagement} eng.)</span>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-text-secondary">Dados insuficientes para determinar melhores horários.</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

                <button onClick={() => setShowTrendingModal(true)} className="text-left rounded-xl border border-border bg-surface hover:border-primary/50 transition-colors">
                  <div className="p-5 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                      <Flame size={24} className="text-orange-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-text-primary">Trending Topics</p>
                      <p className="text-xs text-text-secondary">Temas quentes que geram compras</p>
                    </div>
                  </div>
                </button>

                <button onClick={() => setShowProductsModal(true)} className="text-left rounded-xl border border-border bg-surface hover:border-primary/50 transition-colors">
                  <div className="p-5 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-pink-500/10 flex items-center justify-center flex-shrink-0">
                      <Package size={24} className="text-pink-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-text-primary">Produtos TikTok Shop</p>
                      <p className="text-xs text-text-secondary">Copy persuasivo + link na bio</p>
                    </div>
                  </div>
                </button>

                <button onClick={() => { setShowGrowthModal(true); handleFetchGrowth(); }} className="text-left rounded-xl border border-border bg-surface hover:border-primary/50 transition-colors">
                  <div className="p-5 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                      <Brain size={24} className="text-cyan-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-text-primary">Growth Insights</p>
                      <p className="text-xs text-text-secondary">Analista de crescimento IA</p>
                    </div>
                  </div>
                </button>
              </div>

              {/* Status do Token Facebook */}
              {tokenStatus && (
                <div className={`rounded-xl border p-4 flex items-center gap-3 ${
                  !tokenStatus.isValid ? 'border-red-500/40 bg-red-500/5' :
                  tokenStatus.daysUntilExpiry <= 7 ? 'border-red-500/40 bg-red-500/5' :
                  tokenStatus.daysUntilExpiry <= 15 ? 'border-yellow-500/40 bg-yellow-500/5' :
                  'border-green-500/40 bg-green-500/5'
                }`}>
                  <Shield size={20} className={
                    !tokenStatus.isValid || tokenStatus.daysUntilExpiry <= 7 ? 'text-red-400' :
                    tokenStatus.daysUntilExpiry <= 15 ? 'text-yellow-400' : 'text-green-400'
                  } />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-text-primary">
                      Token Facebook — {tokenStatus.isValid ? 'Ativo' : 'EXPIRADO'}
                      {tokenStatus.isValid && tokenStatus.daysUntilExpiry !== null && (
                        <span className="ml-2 text-xs text-text-secondary">
                          expira em {tokenStatus.daysUntilExpiry} dias
                          {tokenStatus.expiresAt && ` (${new Date(tokenStatus.expiresAt).toLocaleDateString('pt-BR')})`}
                        </span>
                      )}
                    </p>
                    {tokenStatus.appName && (
                      <p className="text-xs text-text-secondary">App: {tokenStatus.appName}</p>
                    )}
                  </div>
                  {(!tokenStatus.isValid || tokenStatus.daysUntilExpiry <= 15) && (
                    <a href="https://business.facebook.com" target="_blank" rel="noreferrer"
                      className="text-xs text-primary-300 hover:underline flex items-center gap-1">
                      Renovar <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              )}

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
          {/* Mídia: URL ou Upload */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-text-primary">Imagem ou vídeo (opcional)</p>
            {/* Upload */}
            {!postMediaPreview ? (
              <label className="flex items-center justify-center gap-2 border-2 border-dashed border-primary/40 rounded-lg p-3 cursor-pointer hover:border-primary transition-colors bg-primary/5">
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/avi,video/mov" onChange={handlePostMediaChange} className="hidden" />
                <Package size={16} className="text-primary-300" />
                <span className="text-sm text-primary-300 font-medium">Upload: clique para adicionar imagem ou vídeo</span>
                <span className="text-xs text-text-secondary">(JPG, PNG, MP4 — até 2min)</span>
              </label>
            ) : (
              <div className="relative rounded-lg overflow-hidden border border-border">
                {postMediaFile?.type.startsWith('video/') ? (
                  <video src={postMediaPreview} className="w-full max-h-40 object-cover" controls />
                ) : (
                  <img src={postMediaPreview} alt="preview" className="w-full max-h-40 object-cover" />
                )}
                <button type="button" onClick={clearPostMedia} className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1">
                  <XCircle size={16} />
                </button>
                <p className="text-xs text-text-secondary px-2 py-1 bg-surface">{postMediaFile?.name}</p>
              </div>
            )}
            {/* OU URL */}
            {!postMediaPreview && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-text-secondary">ou cole uma URL</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}
            {!postMediaPreview && (
              <Input label="URL da midia" placeholder="https://... (imagem ou video)" type="url" value={postForm.imageUrl} onChange={(e) => setPostForm({ ...postForm, imageUrl: e.target.value })} />
            )}
          </div>
          <Input label="Link do post (opcional)" type="url" placeholder="https://seu-link.com" value={postForm.linkUrl} onChange={(e) => setPostForm({ ...postForm, linkUrl: e.target.value })} />
          <Input label="Agendar para (opcional)" type="datetime-local" value={postForm.scheduledTime} onChange={(e) => setPostForm({ ...postForm, scheduledTime: e.target.value })} />
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setShowPostModal(false)}>Cancelar</Button>
            <Button type="submit" disabled={publishing || uploadingPostMedia}>
              {uploadingPostMedia ? 'Enviando mídia...' : publishing ? 'Publicando...' : postForm.scheduledTime ? 'Agendar' : 'Publicar agora'}
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

      {/* Modal: Produtos TikTok Shop */}
      <Modal
        isOpen={showProductsModal}
        onClose={() => { setShowProductsModal(false); setTiktokProducts([]); setOrchestratorResult(null); setProductQuery(''); setLinkPostResult(null); setProductLink(''); }}
        title="Produtos IA — Posts com Copy Persuasivo"
      >
        <div className="space-y-4">

          {/* Seção: Post por link */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
            <p className="text-sm font-semibold text-primary-300 flex items-center gap-2">
              <Link2 size={14} /> Criar post a partir de link de produto
            </p>
            <p className="text-xs text-text-secondary">Cole o link do produto + adicione uma imagem ou vídeo (até 2min). A IA cria o copy e agenda automaticamente.</p>

            {/* Campo de link */}
            <input
              type="text"
              placeholder="https://vt.tiktok.com/... ou qualquer link de produto"
              value={productLink}
              onChange={(e) => setProductLink(e.target.value)}
              className="w-full bg-gray-800 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary"
            />

            {/* Upload de mídia */}
            {!mediaPreview ? (
              <label className="flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/avi"
                  onChange={handleMediaChange}
                  className="hidden"
                />
                <Package size={16} className="text-text-secondary" />
                <span className="text-sm text-text-secondary">Clique para adicionar imagem ou vídeo <span className="text-xs">(JPG, PNG, MP4 — até 2min)</span></span>
              </label>
            ) : (
              <div className="relative rounded-lg overflow-hidden border border-border">
                {mediaFile?.type.startsWith('video/') ? (
                  <video src={mediaPreview} className="w-full max-h-40 object-cover" controls />
                ) : (
                  <img src={mediaPreview} alt="preview" className="w-full max-h-40 object-cover" />
                )}
                <button
                  onClick={clearMedia}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1"
                >
                  <XCircle size={16} />
                </button>
                <p className="text-xs text-text-secondary px-2 py-1 bg-surface">{mediaFile?.name}</p>
              </div>
            )}

            <Button
              onClick={handleCreateFromLink}
              disabled={creatingFromLink || !productLink.trim()}
              className="w-full"
            >
              {uploadingMedia
                ? <><RefreshCw size={14} className="mr-2 animate-spin" />Enviando mídia...</>
                : creatingFromLink
                  ? <><RefreshCw size={14} className="mr-2 animate-spin" />Criando post...</>
                  : <><Sparkles size={14} className="mr-2" />Criar e agendar post</>}
            </Button>

            {linkPostResult && (
              <div className="rounded-lg bg-green-500/5 border border-green-500/20 p-3 space-y-1">
                <p className="text-sm font-semibold text-green-400">✓ Post criado e agendado!</p>
                <p className="text-xs text-text-secondary font-medium">{linkPostResult.productInfo?.name}</p>
                <p className="text-xs text-text-secondary">{linkPostResult.productInfo?.category} · {linkPostResult.productInfo?.price}</p>
                <p className="text-xs text-text-secondary mt-1 line-clamp-2">{linkPostResult.post?.message}</p>
                <p className="text-xs text-text-secondary">
                  Agendado para: {linkPostResult.post?.scheduledFor ? new Date(linkPostResult.post.scheduledFor).toLocaleString('pt-BR') : '—'}
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-border pt-3">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Orquestrador automático (produtos trending)</p>
            <div className="rounded-lg bg-pink-500/5 border border-pink-500/20 p-3 text-xs text-text-secondary">
              O orquestrador busca produtos trending, analisa o que converte melhor e cria posts com copy persuasivo + CTA para o link na bio.
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              label="Buscar por categoria (opcional)"
              placeholder="Ex: beleza, casa, moda, tecnologia..."
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleFetchProducts} disabled={loadingProducts} className="flex-1">
              {loadingProducts ? <><RefreshCw size={14} className="mr-2 animate-spin" />Buscando...</> : <><Package size={14} className="mr-2" />Ver produtos</>}
            </Button>
            <Button onClick={handleRunOrchestrator} disabled={runningOrchestrator} className="flex-1">
              {runningOrchestrator
                ? <><RefreshCw size={14} className="mr-2 animate-spin" />Criando posts...</>
                : <><Sparkles size={14} className="mr-2" />Criar posts automático</>}
            </Button>
          </div>

          {/* Resultado do orquestrador */}
          {orchestratorResult && (
            <div className="rounded-lg bg-green-500/5 border border-green-500/20 p-3 space-y-1">
              <p className="text-sm font-semibold text-green-400">Orquestrador concluído!</p>
              <p className="text-xs text-text-secondary">{orchestratorResult.productsFound} produtos analisados → {orchestratorResult.postsCreated} posts criados e agendados</p>
              {orchestratorResult.insights?.audienceProfile && (
                <p className="text-xs text-text-secondary">Perfil do público: {orchestratorResult.insights.audienceProfile}</p>
              )}
            </div>
          )}

          {/* Lista de produtos */}
          {tiktokProducts.length > 0 && (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{tiktokProducts.length} produtos encontrados</p>
              {tiktokProducts.map((product, i) => (
                <div key={i} className="rounded-lg border border-border bg-surface p-3 flex gap-3">
                  {product.imageUrl && (
                    <img src={product.imageUrl} alt={product.title} className="h-14 w-14 rounded-lg object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary line-clamp-2">{product.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-text-secondary">
                      <span className="text-green-400 font-semibold">R$ {product.price?.toFixed(2)}</span>
                      <span className="flex items-center gap-1"><ShoppingCart size={10} />{product.soldCount?.toLocaleString('pt-BR')} vendidos</span>
                      {product.rating > 0 && <span>⭐ {product.rating}</span>}
                    </div>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-surface border border-border text-text-secondary mt-1 inline-block">{product.category}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Modal: Growth Insights */}
      <Modal
        isOpen={showGrowthModal}
        onClose={() => { setShowGrowthModal(false); setGrowthInsights(null); }}
        title="Growth Insights — Analista de Crescimento IA"
      >
        <div className="space-y-4">
          {loadingGrowth ? (
            <div className="flex items-center justify-center py-8 gap-3 text-text-secondary">
              <RefreshCw size={20} className="animate-spin" />
              <span className="text-sm">Analisando dados de crescimento...</span>
            </div>
          ) : growthInsights ? (
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
              {/* Perfil do público */}
              <div className="rounded-lg bg-cyan-500/5 border border-cyan-500/20 p-3">
                <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-1">Perfil do Público</p>
                <p className="text-sm text-text-primary">{growthInsights.audienceProfile}</p>
              </div>

              {/* Mix de conteúdo recomendado */}
              <div className="rounded-lg border border-border bg-surface p-4">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Mix de Conteúdo Recomendado</p>
                <div className="space-y-2">
                  {[
                    { label: 'Produtos (vendas)', value: growthInsights.contentMix?.product, color: 'bg-pink-400' },
                    { label: 'Entretenimento', value: growthInsights.contentMix?.entertainment, color: 'bg-purple-400' },
                    { label: 'Engajamento', value: growthInsights.contentMix?.engagement, color: 'bg-blue-400' },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-text-secondary">{item.label}</span>
                        <span className="text-text-primary font-semibold">{item.value}%</span>
                      </div>
                      <div className="h-1.5 bg-border rounded-full overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Melhores horários */}
              <div className="rounded-lg border border-border bg-surface p-4">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Melhores Horários para Postar</p>
                <div className="flex gap-2 flex-wrap">
                  {growthInsights.bestPostingHours?.map((h: string, i: number) => (
                    <span key={i} className="flex items-center gap-1 text-sm font-bold text-text-primary bg-primary/10 px-3 py-1.5 rounded-lg">
                      <Clock size={12} className="text-primary-300" /> {h}
                    </span>
                  ))}
                </div>
              </div>

              {/* Recomendações */}
              <div className="rounded-lg border border-border bg-surface p-4">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Recomendações Acionáveis</p>
                <div className="space-y-2">
                  {growthInsights.topRecommendations?.map((rec: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-text-primary">
                      <CheckCircle size={14} className="text-green-400 mt-0.5 flex-shrink-0" />
                      {rec}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">Confiança da análise: {growthInsights.confidenceScore}/10</span>
                <Button variant="outline" size="sm" onClick={handleFetchGrowth}>Reanalisar</Button>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-text-secondary text-sm">Erro ao carregar insights. Tente novamente.</div>
          )}
        </div>
      </Modal>

      {/* Modal: Trending Topics */}
      <Modal
        isOpen={showTrendingModal}
        onClose={() => { setShowTrendingModal(false); setTrendingReport(null); setTrendingNiche(''); }}
        title="Trending Topics — Temas que Geram Compras"
      >
        <div className="space-y-4">
          {!trendingReport ? (
            <form onSubmit={handleFetchTrending} className="space-y-4">
              <div className="rounded-lg bg-orange-500/5 border border-orange-500/20 p-3 text-xs text-text-secondary">
                A IA analisa tendências de comportamento de consumo no Brasil e sugere os temas mais quentes para criar desejo de compra no seu público.
              </div>
              <Input
                label="Nicho ou segmento (opcional)"
                placeholder="Ex: moda feminina, eletrônicos, beleza, casa..."
                value={trendingNiche}
                onChange={(e) => setTrendingNiche(e.target.value)}
              />
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setShowTrendingModal(false)}>Cancelar</Button>
                <Button type="submit" disabled={loadingTrending}>
                  {loadingTrending
                    ? <><RefreshCw size={14} className="mr-2 animate-spin" />Analisando tendências...</>
                    : <><Flame size={14} className="mr-2" />Buscar tendências</>}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {/* Contexto */}
              <div className="rounded-lg bg-orange-500/5 border border-orange-500/20 p-3">
                <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider mb-1">Contexto atual</p>
                <p className="text-sm text-text-secondary">{trendingReport.context}</p>
              </div>

              {/* Tendências */}
              <div className="space-y-3">
                {trendingReport.trends?.map((trend: any, i: number) => (
                  <div key={i} className="rounded-lg border border-border bg-surface p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full
                          ${trend.urgency === 'alta' ? 'bg-red-500/10 text-red-400' :
                            trend.urgency === 'média' ? 'bg-yellow-500/10 text-yellow-400' :
                            'bg-blue-500/10 text-blue-400'}`}>
                          <Flame size={10} />
                          {trend.urgency === 'alta' ? 'Alta' : trend.urgency === 'média' ? 'Média' : 'Baixa'}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-surface border border-border text-text-secondary">
                          <Tag size={10} />
                          {trend.category}
                        </span>
                      </div>
                    </div>

                    <p className="font-semibold text-text-primary text-sm">{trend.topic}</p>

                    <div className="flex items-start gap-2 text-xs text-text-secondary">
                      <ShoppingCart size={12} className="mt-0.5 flex-shrink-0 text-green-400" />
                      <span>{trend.buyingIntent}</span>
                    </div>

                    <div className="flex items-start gap-2 text-xs text-text-secondary">
                      <Sparkles size={12} className="mt-0.5 flex-shrink-0 text-purple-400" />
                      <span>{trend.contentAngle}</span>
                    </div>

                    {/* Ideia de post */}
                    <div className="mt-2 rounded-md bg-background border border-border p-3">
                      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Ideia de post</p>
                      <p className="text-sm text-text-primary">{trend.postIdea}</p>
                      <p className="text-xs text-primary-300 mt-1">{trend.hashtags?.map((h: string) => `#${h.replace('#', '')}`).join(' ')}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Oportunidade da semana */}
              {trendingReport.weeklyOpportunity && (
                <div className="rounded-lg bg-purple-500/5 border border-purple-500/20 p-3">
                  <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-1">Oportunidade desta semana</p>
                  <p className="text-sm text-text-secondary">{trendingReport.weeklyOpportunity}</p>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setTrendingReport(null)}>Nova análise</Button>
                <Button onClick={() => { setShowTrendingModal(false); setTrendingReport(null); setTrendingNiche(''); }}>Fechar</Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

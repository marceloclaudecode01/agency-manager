'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import {
  Layers, Copy, Smartphone, Monitor, Play, Mail, MessageSquare,
  Image, RefreshCw, Wand2, ChevronDown, ChevronUp, Eye,
  Facebook, Instagram, Video, Youtube,
} from 'lucide-react';

const FORMAT_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  carousel:     { label: 'Carrossel',    icon: Image,          color: 'text-pink-400' },
  story:        { label: 'Story',        icon: Smartphone,     color: 'text-orange-400' },
  video_script: { label: 'Roteiro Vídeo', icon: Video,         color: 'text-red-400' },
  email:        { label: 'Email',        icon: Mail,           color: 'text-blue-400' },
  thread:       { label: 'Thread',       icon: MessageSquare,  color: 'text-purple-400' },
  ad_copy:      { label: 'Copy Anúncio', icon: Copy,           color: 'text-green-400' },
};

const PLATFORM_ICONS: Record<string, any> = {
  facebook: Facebook,
  instagram: Instagram,
  tiktok: Video,
  youtube: Youtube,
  email: Mail,
};

export default function ContentLabPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [selectedPost, setSelectedPost] = useState<string | null>(null);
  const [replicas, setReplicas] = useState<any[]>([]);
  const [replicating, setReplicating] = useState(false);
  const [expandedReplica, setExpandedReplica] = useState<string | null>(null);

  // Carousel generator state
  const [carouselTopic, setCarouselTopic] = useState('');
  const [carouselResult, setCarouselResult] = useState<any>(null);
  const [generatingCarousel, setGeneratingCarousel] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [statsRes, postsRes] = await Promise.all([
        api.get('/agents/replicas/stats').catch(() => ({ data: { data: null } })),
        api.get('/agents/scheduled?limit=20').catch(() => ({ data: { data: [] } })),
      ]);
      setStats(statsRes.data.data);
      const postData = postsRes.data.data || [];
      setPosts(Array.isArray(postData) ? postData : []);
    } catch {} finally {
      setLoading(false);
    }
  }

  async function handleReplicate(postId: string) {
    setReplicating(true);
    try {
      const res = await api.post('/agents/replicate', { postId });
      toast(`${res.data.data?.created || 0} formatos criados!`, 'success');
      // Load replicas for this post
      const repRes = await api.get(`/agents/replicas/${postId}`);
      setReplicas(repRes.data.data || []);
      setSelectedPost(postId);
      loadData();
    } catch {
      toast('Erro ao replicar conteúdo', 'error');
    } finally {
      setReplicating(false);
    }
  }

  async function loadReplicas(postId: string) {
    try {
      const res = await api.get(`/agents/replicas/${postId}`);
      setReplicas(res.data.data || []);
      setSelectedPost(postId);
    } catch {
      setReplicas([]);
    }
  }

  async function handleGenerateCarousel() {
    if (!carouselTopic.trim()) return;
    setGeneratingCarousel(true);
    try {
      const res = await api.post('/agents/carousel', { topic: carouselTopic });
      setCarouselResult(res.data.data);
      toast(`Carrossel com ${res.data.data?.totalSlides || 0} slides criado!`, 'success');
    } catch {
      toast('Erro ao gerar carrossel', 'error');
    } finally {
      setGeneratingCarousel(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Layers className="w-6 h-6 text-sky-400" />
            Content Lab
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Replique, otimize e transforme conteúdo em múltiplos formatos
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-surface/60 border-border/60">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-sky-400">{stats?.total ?? 0}</p>
            <p className="text-xs text-text-secondary">Total Réplicas</p>
          </CardContent>
        </Card>
        {(stats?.byFormat || []).slice(0, 3).map((f: any) => {
          const cfg = FORMAT_CONFIG[f.format] || { label: f.format, color: 'text-text-secondary' };
          return (
            <Card key={f.format} className="bg-surface/60 border-border/60">
              <CardContent className="p-4 text-center">
                <p className={`text-2xl font-bold ${cfg.color}`}>{f.count}</p>
                <p className="text-xs text-text-secondary">{cfg.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Posts to replicate */}
        <Card className="bg-surface/60 border-border/60">
          <CardHeader className="pb-2">
            <h3 className="font-semibold text-text-primary flex items-center gap-2">
              <Copy className="w-4 h-4 text-sky-400" />
              Posts Disponíveis para Replicar
            </h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {posts.length === 0 ? (
                <p className="text-sm text-text-secondary text-center py-6">Nenhum post encontrado.</p>
              ) : posts.map((post: any) => (
                <div
                  key={post.id}
                  className={`p-3 rounded-lg border transition-all cursor-pointer ${
                    selectedPost === post.id
                      ? 'bg-sky-400/5 border-sky-400/30'
                      : 'bg-surface-hover/30 border-border/40 hover:border-sky-400/20'
                  }`}
                  onClick={() => loadReplicas(post.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{post.topic}</p>
                      <p className="text-xs text-text-secondary mt-1 line-clamp-2">{post.message?.substring(0, 100)}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="default" className="text-xs">
                          {post.status}
                        </Badge>
                        {post.viralScore && (
                          <span className="text-xs text-fuchsia-400">Viral: {post.viralScore}/10</span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleReplicate(post.id); }}
                      disabled={replicating}
                      className="flex-shrink-0"
                    >
                      <Wand2 className="w-3 h-3 mr-1" />
                      {replicating ? '...' : 'Replicar'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right: Replicas for selected post */}
        <Card className="bg-surface/60 border-border/60">
          <CardHeader className="pb-2">
            <h3 className="font-semibold text-text-primary flex items-center gap-2">
              <Eye className="w-4 h-4 text-purple-400" />
              Formatos Gerados
            </h3>
          </CardHeader>
          <CardContent>
            {replicas.length === 0 ? (
              <div className="text-center py-12 text-text-secondary">
                <Layers className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Selecione um post e clique em "Replicar"</p>
                <p className="text-xs mt-1">6 formatos serão gerados automaticamente</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {replicas.map((replica: any) => {
                  const cfg = FORMAT_CONFIG[replica.format] || { label: replica.format, icon: Copy, color: 'text-text-secondary' };
                  const FIcon = cfg.icon;
                  const PIcon = PLATFORM_ICONS[replica.platform] || Monitor;
                  const isExpanded = expandedReplica === replica.id;

                  return (
                    <div key={replica.id} className="border border-border/40 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setExpandedReplica(isExpanded ? null : replica.id)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-surface-hover/30 transition-colors"
                      >
                        <FIcon className={`w-4 h-4 ${cfg.color} flex-shrink-0`} />
                        <span className="text-sm font-medium text-text-primary">{cfg.label}</span>
                        <PIcon className="w-3 h-3 text-text-secondary ml-auto" />
                        <span className="text-xs text-text-secondary">{replica.platform}</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                      {isExpanded && (
                        <div className="px-3 pb-3 border-t border-border/30">
                          <pre className="text-xs text-text-secondary whitespace-pre-wrap mt-2 bg-surface-hover/50 rounded p-3 max-h-[200px] overflow-y-auto">
                            {replica.format === 'carousel' && replica.slides
                              ? JSON.stringify(replica.slides, null, 2)
                              : replica.format === 'thread' && replica.metadata?.posts
                              ? (replica.metadata.posts as string[]).join('\n\n')
                              : replica.content || JSON.stringify(replica.metadata, null, 2)
                            }
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Carousel Generator */}
      <Card className="bg-surface/60 border-border/60">
        <CardHeader className="pb-2">
          <h3 className="font-semibold text-text-primary flex items-center gap-2">
            <Image className="w-4 h-4 text-pink-400" />
            Gerador de Carrosséis
          </h3>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              value={carouselTopic}
              onChange={(e) => setCarouselTopic(e.target.value)}
              placeholder="Tema do carrossel (ex: 5 dicas de produtividade)"
              className="flex-1 bg-surface-hover border border-border/50 text-text-primary text-sm rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
              onKeyDown={(e) => e.key === 'Enter' && handleGenerateCarousel()}
            />
            <Button onClick={handleGenerateCarousel} disabled={generatingCarousel || !carouselTopic.trim()}>
              <Wand2 className="w-4 h-4 mr-1" />
              {generatingCarousel ? 'Gerando...' : 'Gerar Carrossel'}
            </Button>
          </div>

          {carouselResult && (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary">
                {carouselResult.totalSlides} slides • Legenda: {carouselResult.caption}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {(carouselResult.slides || []).map((slide: any) => (
                  <div
                    key={slide.slideNumber}
                    className="rounded-lg p-4 text-center border border-border/40 min-h-[140px] flex flex-col justify-center"
                    style={{ backgroundColor: slide.backgroundColor || '#1a1a2e' }}
                  >
                    <span className="text-2xl mb-1">{slide.emoji}</span>
                    <p className="text-sm font-bold text-white">{slide.title}</p>
                    <p className="text-xs text-white/70 mt-1">{slide.body}</p>
                    <p className="text-xs text-white/40 mt-2 italic">{slide.designNote}</p>
                  </div>
                ))}
              </div>
              {carouselResult.hashtags?.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {carouselResult.hashtags.map((tag: string, i: number) => (
                    <span key={i} className="text-xs text-sky-400 bg-sky-400/10 px-2 py-0.5 rounded">
                      #{tag.replace('#', '')}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

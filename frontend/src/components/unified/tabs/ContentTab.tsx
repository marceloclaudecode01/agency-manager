'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ContentQueue } from '@/components/command/ContentQueue';
import { FileText, Copy, Images, Wand2 } from 'lucide-react';

interface ContentTabProps {
  scheduledPosts: any[];
  replicaStats: any;
  onOverride: (postId: string, action: 'approve' | 'reject') => Promise<void>;
  onReplicate: (postId: string) => Promise<void>;
  onGenerateCarousel: (topic: string, slides: number) => Promise<any>;
}

export function ContentTab({ scheduledPosts, replicaStats, onOverride, onReplicate, onGenerateCarousel }: ContentTabProps) {
  const [carouselTopic, setCarouselTopic] = useState('');
  const [carouselSlides, setCarouselSlides] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [carouselResult, setCarouselResult] = useState<any>(null);

  const publishedPosts = scheduledPosts.filter(p => p.status === 'PUBLISHED');

  const handleCarousel = async () => {
    if (!carouselTopic.trim()) return;
    setGenerating(true);
    try {
      const res = await onGenerateCarousel(carouselTopic, carouselSlides);
      setCarouselResult(res);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Content Queue */}
      <div>
        <h3 className="text-sm font-heading font-semibold text-text-primary flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-blue-400" /> Fila de Conteúdo
        </h3>
        <ContentQueue posts={scheduledPosts} onOverride={onOverride} />
      </div>

      {/* Replicate Section */}
      <div>
        <h3 className="text-sm font-heading font-semibold text-text-primary flex items-center gap-2 mb-3">
          <Copy className="w-4 h-4 text-purple-400" /> Replicar Posts
        </h3>
        {replicaStats && (
          <div className="flex gap-3 mb-3">
            <Badge variant="default" className="text-xs">Total: {replicaStats.total || 0}</Badge>
            <Badge variant="success" className="text-xs">Sucesso: {replicaStats.success || 0}</Badge>
          </div>
        )}
        {publishedPosts.length === 0 ? (
          <p className="text-xs text-text-secondary/50">Nenhum post publicado para replicar</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {publishedPosts.slice(0, 10).map(post => (
              <div key={post.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-surface/80 p-3">
                <span className="text-sm text-text-primary truncate flex-1">{post.topic}</span>
                <Button size="sm" variant="outline" onClick={() => onReplicate(post.id)} className="gap-1 ml-2">
                  <Copy className="w-3 h-3" /> Replicar
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Carousel Generator */}
      <div>
        <h3 className="text-sm font-heading font-semibold text-text-primary flex items-center gap-2 mb-3">
          <Images className="w-4 h-4 text-orange-400" /> Carousel Generator
        </h3>
        <div className="rounded-xl border border-border/60 bg-surface/80 p-4 space-y-3">
          <div className="flex gap-3">
            <input
              value={carouselTopic}
              onChange={e => setCarouselTopic(e.target.value)}
              placeholder="Tópico do carousel..."
              className="flex-1 bg-surface-hover border border-border/60 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/50"
            />
            <input
              type="number"
              value={carouselSlides}
              onChange={e => setCarouselSlides(parseInt(e.target.value) || 5)}
              min={3}
              max={10}
              className="w-20 bg-surface-hover border border-border/60 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/50"
            />
            <Button onClick={handleCarousel} disabled={generating || !carouselTopic.trim()} className="gap-1.5">
              <Wand2 className="w-3.5 h-3.5" /> {generating ? 'Gerando...' : 'Gerar'}
            </Button>
          </div>
          {carouselResult && (
            <pre className="text-xs text-text-secondary bg-surface-hover rounded-lg p-3 overflow-auto max-h-60">
              {JSON.stringify(carouselResult, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ContentQueue } from '@/components/command/ContentQueue';
import { FileText, Copy } from 'lucide-react';

interface ContentTabProps {
  scheduledPosts: any[];
  replicaStats: any;
  onOverride: (postId: string, action: 'approve' | 'reject') => Promise<void>;
  onReplicate: (postId: string) => Promise<void>;
}

export function ContentTab({ scheduledPosts, replicaStats, onOverride, onReplicate }: ContentTabProps) {
  const publishedPosts = scheduledPosts.filter(p => p.status === 'PUBLISHED');

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

    </div>
  );
}

'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Clock, FileText } from 'lucide-react';

interface Post {
  id: string;
  topic: string;
  scheduledFor: string;
  status: string;
  contentType?: string;
  qualityScore?: number;
  governorDecision?: string;
}

interface ContentQueueProps {
  posts: Post[];
  onOverride: (postId: string, action: 'approve' | 'reject') => Promise<void>;
}

export function ContentQueue({ posts, onOverride }: ContentQueueProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const pending = posts.filter(p => p.status === 'PENDING' || p.status === 'APPROVED');

  const handleAction = async (postId: string, action: 'approve' | 'reject') => {
    setLoadingId(postId);
    try {
      await onOverride(postId, action);
    } finally {
      setLoadingId(null);
    }
  };

  if (pending.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-surface/80 backdrop-blur-sm p-8 text-center">
        <FileText className="w-8 h-8 text-text-secondary/30 mx-auto mb-2" />
        <p className="text-sm text-text-secondary/50">Nenhum post na fila</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pending.map((post) => {
        const time = new Date(post.scheduledFor).toLocaleString('pt-BR', {
          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
        });
        const isLoading = loadingId === post.id;

        return (
          <div
            key={post.id}
            className="rounded-xl border border-border/60 bg-surface/80 backdrop-blur-sm p-4 hover:border-primary/30 transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">{post.topic}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-text-secondary">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {time}
                  </span>
                  {post.contentType && (
                    <Badge variant="default" className="text-xs">{post.contentType}</Badge>
                  )}
                  {post.qualityScore != null && (
                    <span className={`font-mono ${post.qualityScore >= 7 ? 'text-emerald-400' : post.qualityScore >= 4 ? 'text-yellow-400' : 'text-red-400'}`}>
                      Q:{post.qualityScore}/10
                    </span>
                  )}
                  <Badge variant={post.status === 'APPROVED' ? 'success' : 'warning'} className="text-xs">
                    {post.status}
                  </Badge>
                </div>
              </div>
              {post.status === 'PENDING' && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(post.id, 'approve')}
                    disabled={isLoading}
                    className="gap-1 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(post.id, 'reject')}
                    disabled={isLoading}
                    className="gap-1 text-red-400 border-red-500/30 hover:bg-red-500/10"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Rejeitar
                  </Button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

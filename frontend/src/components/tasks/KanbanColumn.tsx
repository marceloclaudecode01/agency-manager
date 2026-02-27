'use client';

import { useDroppable } from '@dnd-kit/core';

interface KanbanColumnProps {
  id: string;
  title: string;
  color: string;
  count: number;
  children: React.ReactNode;
}

export function KanbanColumn({ id, title, color, count, children }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border border-border bg-surface/50 p-4 transition-colors ${
        isOver ? 'ring-2 ring-primary/40 bg-surface/80' : ''
      }`}
    >
      <div className={`flex items-center gap-2 mb-4 pb-3 border-b-2 ${color}`}>
        <h3 className="font-heading font-semibold text-text-primary">{title}</h3>
        <span className="text-xs text-text-secondary bg-surface-hover rounded-full px-2 py-0.5">
          {count}
        </span>
      </div>
      <div className="space-y-3 min-h-[200px]">
        {children}
      </div>
    </div>
  );
}

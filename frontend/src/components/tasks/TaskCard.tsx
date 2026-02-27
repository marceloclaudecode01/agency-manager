'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import { GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Task } from '@/types';

const priorityBadge: Record<string, { variant: string; label: string }> = {
  LOW: { variant: 'default', label: 'Baixa' },
  MEDIUM: { variant: 'info', label: 'Média' },
  HIGH: { variant: 'warning', label: 'Alta' },
  URGENT: { variant: 'error', label: 'Urgente' },
};

interface TaskCardProps {
  task: Task;
  /** When true, renders as a static overlay snapshot (no drag handles). */
  overlay?: boolean;
  /** When true, shows a subtle loading overlay — API call in progress. */
  isPending?: boolean;
}

export function TaskCard({ task, overlay = false, isPending = false }: TaskCardProps) {
  const validStatuses = ['TODO', 'IN_PROGRESS', 'DONE'];
  const isStatusInvalid = !task.status || !validStatuses.includes(task.status);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled: overlay || isStatusInvalid || isPending,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const badge = priorityBadge[task.priority];

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : style}
      {...(!overlay ? attributes : {})}
      className={`relative rounded-lg border border-border bg-surface p-3 hover:border-primary/30 transition-colors ${
        isStatusInvalid ? 'cursor-not-allowed pointer-events-none opacity-60' : 'cursor-grab active:cursor-grabbing'
      } ${isDragging ? 'opacity-40' : ''} ${overlay ? 'shadow-xl ring-1 ring-primary/30' : ''} ${isPending ? 'opacity-60 cursor-wait' : ''}`}
    >
      {isPending && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-surface/40">
          <span className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      )}
      <div className="flex items-start justify-between mb-2">
        <Link
          href={`/tasks/${task.id}`}
          className="text-sm font-medium text-text-primary flex-1 hover:text-primary-300 transition-colors"
          onClick={(e) => isDragging && e.preventDefault()}
        >
          {task.title}
        </Link>
        <span
          {...(!overlay ? listeners : {})}
          className="ml-2 flex-shrink-0 cursor-grab active:cursor-grabbing"
        >
          <GripVertical size={14} className="text-text-secondary/50" />
        </span>
      </div>
      {task.description && (
        <p className="text-xs text-text-secondary mb-2 line-clamp-2">{task.description}</p>
      )}
      <div className="flex items-center justify-between">
        <Badge variant={badge?.variant as any}>{badge?.label}</Badge>
        {task.assignee && (
          <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary-300">
            {task.assignee.name.charAt(0)}
          </div>
        )}
      </div>
      {task.campaign && (
        <p className="text-xs text-text-secondary mt-2">{task.campaign.name}</p>
      )}
    </div>
  );
}

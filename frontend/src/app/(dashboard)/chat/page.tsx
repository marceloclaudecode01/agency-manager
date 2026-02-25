'use client';

import { useEffect, useState, useRef } from 'react';
import api from '@/lib/api';
import { User, Message } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useSocketContext } from '@/contexts/SocketContext';
import { Loading } from '@/components/ui/loading';
import { formatDateTime } from '@/lib/utils';
import { Send, MessageSquare } from 'lucide-react';

export default function ChatPage() {
  const { user } = useAuth();
  const { socket } = useSocketContext();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadUsers();
    loadUnreadCounts();
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('chat:message', (msg: Message) => {
      setMessages((prev) => {
        const alreadyExists = prev.some((m) => m.id === msg.id);
        if (alreadyExists) return prev;
        return [...prev, msg];
      });
      // Atualizar não lidas se a mensagem não é do usuário selecionado
      if (msg.senderId !== selectedUser?.id) {
        setUnreadCounts((prev) => ({
          ...prev,
          [msg.senderId]: (prev[msg.senderId] || 0) + 1,
        }));
      }
    });
    return () => { socket.off('chat:message'); };
  }, [socket, selectedUser]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadUsers = async () => {
    try {
      const { data } = await api.get('/users');
      setUsers((data.data || []).filter((u: User) => u.id !== user?.id));
    } catch {}
    setLoading(false);
  };

  const loadUnreadCounts = async () => {
    try {
      const { data } = await api.get('/chat/unread');
      setUnreadCounts(data.data || {});
    } catch {}
  };

  const selectUser = async (u: User) => {
    setSelectedUser(u);
    setLoadingMessages(true);
    setMessages([]);
    try {
      const { data } = await api.get(`/chat/${u.id}`);
      setMessages(data.data || []);
      setUnreadCounts((prev) => ({ ...prev, [u.id]: 0 }));
    } catch {}
    setLoadingMessages(false);
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedUser || !socket) return;
    socket.emit('chat:message', { receiverId: selectedUser.id, content: input.trim() });
    setInput('');
  };

  if (loading) return <Loading />;

  return (
    <div className="flex h-[calc(100vh-8rem)] rounded-xl border border-border overflow-hidden bg-surface">
      {/* Lista de usuários */}
      <div className="w-64 border-r border-border flex flex-col flex-shrink-0">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Equipe</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {users.length === 0 ? (
            <p className="text-sm text-text-secondary p-4">Nenhum usuário encontrado</p>
          ) : (
            users.map((u) => {
              const unread = unreadCounts[u.id] || 0;
              const isActive = selectedUser?.id === u.id;
              return (
                <button
                  key={u.id}
                  onClick={() => selectUser(u)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors text-left ${isActive ? 'bg-primary/10' : ''}`}
                >
                  <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-primary-300">{u.name[0].toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isActive ? 'text-primary-300' : 'text-text-primary'}`}>{u.name}</p>
                    <p className="text-xs text-text-secondary truncate">{u.role}</p>
                  </div>
                  {unread > 0 && (
                    <span className="h-5 w-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                      {unread}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Área de conversa */}
      <div className="flex-1 flex flex-col">
        {!selectedUser ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <MessageSquare size={32} className="text-primary-300" />
            </div>
            <p className="text-text-primary font-medium">Selecione um colega para conversar</p>
            <p className="text-sm text-text-secondary">Escolha alguém da lista ao lado</p>
          </div>
        ) : (
          <>
            {/* Header da conversa */}
            <div className="px-5 py-3 border-b border-border flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-sm font-semibold text-primary-300">{selectedUser.name[0].toUpperCase()}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">{selectedUser.name}</p>
                <p className="text-xs text-text-secondary">{selectedUser.email}</p>
              </div>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingMessages ? (
                <div className="flex justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                  <p className="text-sm text-text-secondary">Nenhuma mensagem ainda</p>
                  <p className="text-xs text-text-secondary">Comece a conversa!</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.senderId === user?.id;
                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${isMine ? 'bg-primary/20 rounded-tr-sm' : 'bg-surface-hover rounded-tl-sm'}`}>
                        {!isMine && (
                          <p className="text-[10px] font-semibold text-primary-300 mb-1">{msg.sender?.name}</p>
                        )}
                        <p className="text-sm text-text-primary break-words">{msg.content}</p>
                        <p className="text-[10px] text-text-secondary mt-1 text-right">{formatDateTime(msg.createdAt)}</p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form onSubmit={sendMessage} className="px-4 py-3 border-t border-border flex items-center gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Mensagem para ${selectedUser.name}...`}
                className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="h-10 w-10 rounded-lg bg-primary hover:bg-primary-600 disabled:opacity-40 flex items-center justify-center transition-colors flex-shrink-0"
              >
                <Send size={16} className="text-white" />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

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
  Package, Plus, Trash2, ExternalLink, Sparkles, Clock,
  RefreshCw, CheckCircle, XCircle, ShoppingCart, Tag, Brain,
  Search, Link, Image, AlertCircle, ChevronRight,
} from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  SCHEDULED: 'Agendado',
  PUBLISHED: 'Publicado',
  FAILED: 'Falhou',
  CANCELLED: 'Cancelado',
};

const STATUS_VARIANTS: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  PENDING: 'warning',
  SCHEDULED: 'default',
  PUBLISHED: 'success',
  FAILED: 'error',
  CANCELLED: 'error',
};

export default function ProductsPage() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Pré-visualização de link
  const [analyzing, setAnalyzing] = useState(false);
  const [preview, setPreview] = useState<any>(null);

  const [form, setForm] = useState({
    productUrl: '',
    imageUrl: '',
    title: '',
  });

  useEffect(() => {
    fetchCampaigns();
  }, []);

  async function fetchCampaigns() {
    try {
      setLoading(true);
      const res = await api.get('/products');
      setCampaigns(res.data.data || []);
    } catch {
      toast('Erro ao carregar campanhas', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function analyzeLink() {
    if (!form.productUrl) return;
    try {
      setAnalyzing(true);
      setPreview(null);
      const res = await api.post('/products/analyze/link', { url: form.productUrl });
      setPreview(res.data.data);
      if (!form.title) {
        setForm(f => ({ ...f, title: res.data.data.name || '' }));
      }
    } catch (err: any) {
      toast(err.response?.data?.message || 'Erro ao analisar link', 'error');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleCreate() {
    if (!form.productUrl || !form.imageUrl) {
      toast('URL do produto e imagem são obrigatórios', 'error');
      return;
    }
    try {
      setCreating(true);
      const res = await api.post('/products', form);
      toast(res.data.message || 'Campanha criada e post agendado!', 'success');
      setShowCreateModal(false);
      setForm({ productUrl: '', imageUrl: '', title: '' });
      setPreview(null);
      fetchCampaigns();
    } catch (err: any) {
      toast(err.response?.data?.message || 'Erro ao criar campanha', 'error');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover esta campanha?')) return;
    try {
      await api.delete(`/products/${id}`);
      toast('Campanha removida', 'success');
      fetchCampaigns();
    } catch {
      toast('Erro ao remover campanha', 'error');
    }
  }

  async function openDetail(campaign: any) {
    try {
      const res = await api.get(`/products/${campaign.id}`);
      setSelected(res.data.data);
      setShowDetailModal(true);
    } catch {
      setSelected(campaign);
      setShowDetailModal(true);
    }
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-purple-400" />
            Produtos IA
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Cole o link de um produto — a IA analisa, cria o copy e agenda o post automaticamente.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Novo Produto
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: campaigns.length, icon: Package, color: 'text-purple-400' },
          { label: 'Agendados', value: campaigns.filter(c => c.status === 'SCHEDULED').length, icon: Clock, color: 'text-blue-400' },
          { label: 'Publicados', value: campaigns.filter(c => c.status === 'PUBLISHED').length, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Falhos', value: campaigns.filter(c => c.status === 'FAILED').length, icon: XCircle, color: 'text-red-400' },
        ].map(stat => (
          <Card key={stat.label} className="bg-gray-800 border-gray-700">
            <CardContent className="p-4 flex items-center gap-3">
              <stat.icon className={`w-8 h-8 ${stat.color}`} />
              <div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-gray-400">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Lista de campanhas */}
      {campaigns.length === 0 ? (
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-12 text-center">
            <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">Nenhuma campanha de produto ainda.</p>
            <p className="text-gray-500 text-sm mt-1">Cole o link de um produto e a IA faz o resto!</p>
            <Button onClick={() => setShowCreateModal(true)} className="mt-4">
              <Plus className="w-4 h-4 mr-2" /> Criar Primeiro Produto
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {campaigns.map(campaign => (
            <Card key={campaign.id} className="bg-gray-800 border-gray-700 hover:border-gray-600 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Imagem */}
                  {campaign.imageUrl && (
                    <img
                      src={campaign.imageUrl}
                      alt={campaign.productName}
                      className="w-16 h-16 object-cover rounded-lg flex-shrink-0 bg-gray-700"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-white truncate">{campaign.title || campaign.productName}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">{campaign.sourceDomain}</p>
                      </div>
                      <Badge variant={STATUS_VARIANTS[campaign.status] || 'default'}>
                        {STATUS_LABELS[campaign.status] || campaign.status}
                      </Badge>
                    </div>

                    {campaign.productPrice && (
                      <div className="flex items-center gap-1 mt-1">
                        <Tag className="w-3 h-3 text-green-400" />
                        <span className="text-green-400 text-sm font-medium">{campaign.productPrice}</span>
                      </div>
                    )}

                    {campaign.generatedCopy && (
                      <p className="text-gray-400 text-xs mt-2 line-clamp-2">{campaign.generatedCopy}</p>
                    )}

                    <div className="flex items-center gap-3 mt-3">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDateTime(campaign.createdAt)}
                      </span>
                      {campaign.autoReply && (
                        <span className="text-xs text-purple-400 flex items-center gap-1">
                          <Brain className="w-3 h-3" /> Auto-resposta ativa
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => openDetail(campaign)} className="text-blue-400 hover:text-blue-300">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <a href={campaign.productUrl} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="ghost" className="text-gray-400 hover:text-gray-300">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </a>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(campaign.id)} className="text-red-400 hover:text-red-300">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal: Criar Campanha */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); setPreview(null); setForm({ productUrl: '', imageUrl: '', title: '' }); }}
        title="Novo Produto com IA"
      >
        <div className="space-y-4">
          <div className="bg-purple-900/20 border border-purple-700/40 rounded-lg p-3 flex gap-2">
            <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
            <p className="text-purple-300 text-xs">
              A IA vai analisar o produto, criar um copy persuasivo e agendar o post no melhor horário automaticamente.
            </p>
          </div>

          {/* URL do produto */}
          <div>
            <label className="text-sm text-gray-300 mb-1 block">URL do Produto *</label>
            <div className="flex gap-2">
              <Input
                placeholder="https://produto.com/item/..."
                value={form.productUrl}
                onChange={e => setForm(f => ({ ...f, productUrl: e.target.value }))}
                className="flex-1"
              />
              <Button
                variant="secondary"
                onClick={analyzeLink}
                disabled={!form.productUrl || analyzing}
                className="flex-shrink-0"
              >
                {analyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Pré-visualização do produto analisado */}
          {preview && (
            <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-green-400 text-sm font-medium">Produto identificado</span>
              </div>
              <p className="text-white font-medium text-sm">{preview.name}</p>
              {preview.price && <p className="text-green-400 text-sm">{preview.price}</p>}
              {preview.description && <p className="text-gray-400 text-xs line-clamp-2">{preview.description}</p>}
              {preview.sourceDomain && <p className="text-gray-500 text-xs">{preview.sourceDomain}</p>}
            </div>
          )}

          {/* URL da imagem */}
          <div>
            <label className="text-sm text-gray-300 mb-1 block">URL da Imagem do Post *</label>
            <Input
              placeholder="https://cdn.site.com/imagem-produto.jpg"
              value={form.imageUrl}
              onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
            />
            {form.imageUrl && (
              <img
                src={form.imageUrl}
                alt="preview"
                className="mt-2 h-24 object-cover rounded-lg"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
          </div>

          {/* Título opcional */}
          <div>
            <label className="text-sm text-gray-300 mb-1 block">Título da Campanha (opcional)</label>
            <Input
              placeholder="Ex: Promoção Tênis Nike Air"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => { setShowCreateModal(false); setPreview(null); setForm({ productUrl: '', imageUrl: '', title: '' }); }}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !form.productUrl || !form.imageUrl}
              className="flex-1 flex items-center justify-center gap-2"
            >
              {creating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Processando IA...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Criar com IA
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Detalhes */}
      {selected && (
        <Modal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          title={selected.title || selected.productName}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant={STATUS_VARIANTS[selected.status] || 'default'}>
                {STATUS_LABELS[selected.status] || selected.status}
              </Badge>
              {selected.autoReply && (
                <Badge variant="default" className="flex items-center gap-1">
                  <Brain className="w-3 h-3" /> Auto-resposta
                </Badge>
              )}
            </div>

            {selected.imageUrl && (
              <img src={selected.imageUrl} alt="produto" className="w-full h-40 object-cover rounded-lg" />
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              {selected.productPrice && (
                <div>
                  <p className="text-gray-500 text-xs">Preço</p>
                  <p className="text-green-400 font-medium">{selected.productPrice}</p>
                </div>
              )}
              {selected.sourceDomain && (
                <div>
                  <p className="text-gray-500 text-xs">Fonte</p>
                  <p className="text-gray-300">{selected.sourceDomain}</p>
                </div>
              )}
            </div>

            {selected.productDesc && (
              <div>
                <p className="text-gray-500 text-xs mb-1">Descrição do Produto</p>
                <p className="text-gray-300 text-sm">{selected.productDesc}</p>
              </div>
            )}

            {selected.generatedCopy && (
              <div>
                <p className="text-gray-500 text-xs mb-1 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-400" /> Copy Gerado pela IA
                </p>
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <p className="text-gray-200 text-sm whitespace-pre-wrap">{selected.generatedCopy}</p>
                </div>
              </div>
            )}

            {selected.hashtags && (
              <div>
                <p className="text-gray-500 text-xs mb-1">Hashtags</p>
                <p className="text-blue-400 text-sm">{selected.hashtags}</p>
              </div>
            )}

            {selected.replyTemplate && (
              <div>
                <p className="text-gray-500 text-xs mb-1 flex items-center gap-1">
                  <Brain className="w-3 h-3 text-purple-400" /> Template de Resposta Automática
                </p>
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <p className="text-gray-300 text-sm">{selected.replyTemplate}</p>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <a href={selected.productUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                <Button variant="secondary" className="w-full flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" /> Ver Produto
                </Button>
              </a>
              <Button
                variant="ghost"
                onClick={() => { setShowDetailModal(false); handleDelete(selected.id); }}
                className="text-red-400 hover:text-red-300"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

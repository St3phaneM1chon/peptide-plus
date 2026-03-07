'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  DollarSign,
  Calendar,
  User,
  Clock,
  AlertTriangle,
  GripVertical,
  Plus,
  Filter,
  Search,
} from 'lucide-react';

// --- Types ---

interface Deal {
  id: string;
  title: string;
  value: number;
  currency: string;
  stageId: string;
  assignedTo?: { name: string | null; email: string };
  contact?: { name: string | null; email: string } | null;
  lead?: { contactName: string } | null;
  expectedCloseDate?: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface Stage {
  id: string;
  name: string;
  position: number;
  probability: number;
  color: string | null;
  isWon: boolean;
  isLost: boolean;
}

interface Pipeline {
  id: string;
  name: string;
  isDefault: boolean;
  stages: Stage[];
}

interface PipelineKanbanProps {
  onDealClick?: (dealId: string) => void;
  onCreateDeal?: (stageId: string) => void;
}

// --- Draggable Deal Card ---

function DealCard({ deal, isDragging, onClick }: { deal: Deal; isDragging?: boolean; onClick?: () => void }) {
  const { locale } = useI18n();
  const fmt = useCallback(
    (amount: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: deal.currency || 'CAD' }).format(amount),
    [locale, deal.currency]
  );

  const daysSinceUpdate = Math.floor((Date.now() - new Date(deal.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
  const isRotting = daysSinceUpdate > 14;

  return (
    <div
      className={`bg-white rounded-lg border p-3 cursor-pointer transition-shadow hover:shadow-md ${
        isDragging ? 'shadow-lg ring-2 ring-teal-400 opacity-90' : ''
      } ${isRotting ? 'border-red-300' : 'border-gray-200'}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium text-gray-900 truncate flex-1">{deal.title}</h4>
        {isRotting && <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />}
      </div>

      <div className="mt-2 flex items-center gap-1 text-sm font-semibold text-green-700">
        <DollarSign className="h-3.5 w-3.5" />
        {fmt(deal.value)}
      </div>

      {(deal.contact || deal.lead) && (
        <div className="mt-1.5 flex items-center gap-1 text-xs text-gray-500">
          <User className="h-3 w-3" />
          <span className="truncate">{deal.contact?.name || deal.lead?.contactName || deal.contact?.email}</span>
        </div>
      )}

      {deal.assignedTo && (
        <div className="mt-1 flex items-center gap-1 text-xs text-gray-400">
          <User className="h-3 w-3" />
          <span className="truncate">{deal.assignedTo.name || deal.assignedTo.email}</span>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between">
        {deal.expectedCloseDate && (
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Calendar className="h-3 w-3" />
            {new Date(deal.expectedCloseDate).toLocaleDateString(locale)}
          </div>
        )}
        {daysSinceUpdate > 0 && (
          <div className={`flex items-center gap-1 text-xs ${isRotting ? 'text-red-500' : 'text-gray-400'}`}>
            <Clock className="h-3 w-3" />
            {daysSinceUpdate}j
          </div>
        )}
      </div>

      {deal.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {deal.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Draggable Wrapper ---

function DraggableDealCard({ deal, onDealClick }: { deal: Deal; onDealClick?: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: { deal },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform), zIndex: isDragging ? 50 : undefined }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className="flex items-start gap-1">
        <button {...listeners} className="mt-1 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500">
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <DealCard deal={deal} isDragging={isDragging} onClick={() => onDealClick?.(deal.id)} />
        </div>
      </div>
    </div>
  );
}

// --- Droppable Column ---

function StageColumn({
  stage,
  deals,
  totalValue,
  onDealClick,
  onCreateDeal,
}: {
  stage: Stage;
  deals: Deal[];
  totalValue: number;
  onDealClick?: (id: string) => void;
  onCreateDeal?: (stageId: string) => void;
}) {
  const { locale } = useI18n();
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  const fmt = useCallback(
    (amount: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD', notation: 'compact' }).format(amount),
    [locale]
  );

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-72 min-w-[288px] shrink-0 rounded-lg transition-colors ${
        isOver ? 'bg-teal-50 ring-2 ring-teal-300' : 'bg-gray-50'
      }`}
    >
      {/* Column Header */}
      <div className="p-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color || '#6B7280' }} />
            <h3 className="text-sm font-semibold text-gray-700">{stage.name}</h3>
            <span className="inline-flex items-center justify-center bg-gray-200 text-gray-600 rounded-full h-5 min-w-[20px] px-1.5 text-xs font-medium">
              {deals.length}
            </span>
          </div>
          <button
            onClick={() => onCreateDeal?.(stage.id)}
            className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
            title="Add deal"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
          <span>{fmt(totalValue)}</span>
          <span>{Math.round(stage.probability * 100)}%</span>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)]">
        {deals.map((deal) => (
          <DraggableDealCard key={deal.id} deal={deal} onDealClick={onDealClick} />
        ))}
        {deals.length === 0 && (
          <div className="p-4 text-center text-xs text-gray-400">Aucun deal</div>
        )}
      </div>
    </div>
  );
}

// --- Main Kanban Board ---

export default function PipelineKanban({ onDealClick, onCreateDeal }: PipelineKanbanProps) {
  const { t } = useI18n();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [assigneeFilter, _setAssigneeFilter] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Load pipelines
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/crm/pipelines');
        const json = await res.json();
        if (json.success && json.data) {
          setPipelines(json.data);
          const defaultPipeline = json.data.find((p: Pipeline) => p.isDefault) || json.data[0];
          if (defaultPipeline) setSelectedPipelineId(defaultPipeline.id);
        }
      } catch {
        toast.error('Failed to load pipelines');
      }
    })();
  }, []);

  // Load deals when pipeline changes
  useEffect(() => {
    if (!selectedPipelineId) return;
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ pipelineId: selectedPipelineId, limit: '500' });
        if (searchQuery) params.set('search', searchQuery);
        if (assigneeFilter) params.set('assignedToId', assigneeFilter);
        const res = await fetch(`/api/admin/crm/deals?${params}`);
        const json = await res.json();
        if (json.success) {
          setDeals(json.data || []);
        }
      } catch {
        toast.error('Failed to load deals');
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedPipelineId, searchQuery, assigneeFilter]);

  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId);
  const stages = selectedPipeline?.stages?.sort((a, b) => a.position - b.position) || [];

  const dealsByStage = stages.reduce<Record<string, Deal[]>>((acc, stage) => {
    acc[stage.id] = deals.filter((d) => d.stageId === stage.id);
    return acc;
  }, {});

  const handleDragStart = (event: DragStartEvent) => {
    const deal = event.active.data.current?.deal as Deal | undefined;
    if (deal) setActiveDeal(deal);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDeal(null);
    const { active, over } = event;
    if (!over) return;

    const dealId = active.id as string;
    const newStageId = over.id as string;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stageId === newStageId) return;

    // Optimistic update
    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stageId: newStageId } : d)));

    try {
      const res = await fetch(`/api/admin/crm/deals/${dealId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId: newStageId }),
      });
      const json = await res.json();
      if (!json.success) {
        // Revert optimistic update
        setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stageId: deal.stageId } : d)));
        toast.error(json.error?.message || 'Failed to move deal');
      } else {
        const stage = stages.find((s) => s.id === newStageId);
        if (stage?.isWon) toast.success(`Deal "${deal.title}" won!`);
        else if (stage?.isLost) toast.info(`Deal "${deal.title}" marked as lost`);
      }
    } catch {
      setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stageId: deal.stageId } : d)));
      toast.error('Network error moving deal');
    }
  };

  // Compute summary stats
  const totalPipelineValue = deals.reduce((sum, d) => sum + Number(d.value), 0);
  const weightedValue = deals.reduce((sum, d) => {
    const stage = stages.find((s) => s.id === d.stageId);
    return sum + Number(d.value) * (stage?.probability || 0);
  }, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 p-4 border-b bg-white">
        <div className="flex items-center gap-3">
          <select
            value={selectedPipelineId}
            onChange={(e) => setSelectedPipelineId(e.target.value)}
            className="text-lg font-semibold bg-transparent border-none focus:ring-0 cursor-pointer"
          >
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4">
          {/* Stats summary */}
          <div className="hidden md:flex items-center gap-4 text-sm text-gray-500">
            <span>Total: <strong className="text-gray-900">{new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', notation: 'compact' }).format(totalPipelineValue)}</strong></span>
            <span>Weighted: <strong className="text-green-700">{new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', notation: 'compact' }).format(weightedValue)}</strong></span>
            <span>{deals.length} deals</span>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('common.search') || 'Search...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          {/* Filter icon placeholder */}
          <button className="p-2 rounded-md hover:bg-gray-100 text-gray-500">
            <Filter className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 overflow-x-auto p-4">
            <div className="flex gap-4 h-full">
              {stages.map((stage) => (
                <StageColumn
                  key={stage.id}
                  stage={stage}
                  deals={dealsByStage[stage.id] || []}
                  totalValue={(dealsByStage[stage.id] || []).reduce((s, d) => s + Number(d.value), 0)}
                  onDealClick={onDealClick}
                  onCreateDeal={onCreateDeal}
                />
              ))}
            </div>
          </div>

          <DragOverlay>
            {activeDeal ? <DealCard deal={activeDeal} isDragging /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

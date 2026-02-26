'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Warehouse as WarehouseIcon,
  ArrowLeftRight,
  History,
  AlertTriangle,
  BarChart3,
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  XCircle,
  Search,
  RefreshCcw,
  X,
  Truck,
  ClipboardCheck,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Modal,
  StatusBadge,
  StatCard,
  FilterBar,
  SelectFilter,
  DataTable,
  type Column,
  SectionCard,
  FormField,
  Input,
  Textarea,
  type BadgeVariant,
} from '@/components/admin';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useI18n } from '@/i18n/client';
import { sectionThemes } from '@/lib/admin/section-themes';
import { toast } from 'sonner';
import { addCSRFHeader } from '@/lib/csrf';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WarehouseData {
  id: string;
  name: string;
  code: string;
  address: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  _count?: { stockLevels: number; movements: number };
}

interface StockLevelData {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  reservedQty: number;
  reorderPoint: number | null;
  reorderQty: number | null;
  maxStock: number | null;
  unitCost: number;
  totalValue: number;
  costMethod: string;
  lastCountDate: string | null;
  warehouse: { id: string; name: string; code: string; isActive: boolean };
}

interface MovementData {
  id: string;
  productId: string;
  warehouseId: string;
  type: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  reference: string | null;
  referenceType: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  warehouse: { id: string; name: string; code: string };
}

interface TransferData {
  id: string;
  transferNumber: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  status: string;
  notes: string | null;
  shippedAt: string | null;
  receivedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  fromWarehouse: { id: string; name: string; code: string };
  toWarehouse: { id: string; name: string; code: string };
  items: TransferItemData[];
}

interface TransferItemData {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
}

interface ReorderAlert {
  productId: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  currentQty: number;
  reservedQty: number;
  availableQty: number;
  reorderPoint: number;
  reorderQty: number | null;
  deficit: number;
  unitCost: number;
}

interface ValuationLine {
  productId: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  quantity: number;
  unitCost: number;
  totalValue: number;
  costMethod: string;
}

interface ValuationReport {
  lines: ValuationLine[];
  totalValue: number;
  totalItems: number;
  byWarehouse: { warehouseId: string; warehouseName: string; value: number; items: number }[];
  generatedAt: string;
  costMethod: string;
}

type TabId = 'stock' | 'warehouses' | 'transfers' | 'movements' | 'alerts' | 'valuation';

// ---------------------------------------------------------------------------
// Helper: badge variants
// ---------------------------------------------------------------------------

function transferStatusBadge(status: string): BadgeVariant {
  switch (status) {
    case 'PENDING': return 'warning';
    case 'IN_TRANSIT': return 'info';
    case 'COMPLETED': return 'success';
    case 'CANCELLED': return 'error';
    default: return 'neutral';
  }
}

function movementTypeBadge(type: string): BadgeVariant {
  switch (type) {
    case 'IN':
    case 'TRANSFER_IN':
    case 'RETURN':
    case 'PRODUCTION':
      return 'success';
    case 'OUT':
    case 'TRANSFER_OUT':
    case 'CONSUMPTION':
      return 'error';
    case 'ADJUSTMENT':
      return 'warning';
    default:
      return 'neutral';
  }
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function InventairePage() {
  const { t, formatCurrency } = useI18n();
  const theme = sectionThemes.entry;

  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>('stock');

  // Shared data
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([]);
  const [loading, setLoading] = useState(false);

  // Stock levels tab
  const [stockLevels, setStockLevels] = useState<StockLevelData[]>([]);
  const [stockPage, setStockPage] = useState(1);
  const [stockTotal, setStockTotal] = useState(0);
  const [stockWarehouseFilter, setStockWarehouseFilter] = useState('');
  const [stockSearch, setStockSearch] = useState('');

  // Movements tab
  const [movements, setMovements] = useState<MovementData[]>([]);
  const [movementsPage, setMovementsPage] = useState(1);
  const [movementsTotal, setMovementsTotal] = useState(0);
  const [movementsWarehouseFilter, setMovementsWarehouseFilter] = useState('');
  const [movementsTypeFilter, setMovementsTypeFilter] = useState('');

  // Transfers tab
  const [transfers, setTransfers] = useState<TransferData[]>([]);
  const [transfersPage, setTransfersPage] = useState(1);
  const [transfersTotal, setTransfersTotal] = useState(0);
  const [transfersStatusFilter, setTransfersStatusFilter] = useState('');

  // Alerts tab
  const [alerts, setAlerts] = useState<ReorderAlert[]>([]);
  const [alertsCount, setAlertsCount] = useState(0);

  // Valuation tab
  const [valuation, setValuation] = useState<ValuationReport | null>(null);
  const [valuationCostMethod, setValuationCostMethod] = useState('WAC');
  const [valuationWarehouse, setValuationWarehouse] = useState('');

  // Modals
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseData | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<StockLevelData | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Warehouse form
  const [whName, setWhName] = useState('');
  const [whCode, setWhCode] = useState('');
  const [whAddress, setWhAddress] = useState('');
  const [whIsDefault, setWhIsDefault] = useState(false);

  // Adjust form
  const [adjustNewQty, setAdjustNewQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  // Transfer form
  const [trfFrom, setTrfFrom] = useState('');
  const [trfTo, setTrfTo] = useState('');
  const [trfNotes, setTrfNotes] = useState('');
  const [trfItems, setTrfItems] = useState<{ productId: string; productName: string; quantity: string; unitCost: string }[]>([
    { productId: '', productName: '', quantity: '', unitCost: '' },
  ]);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchWarehouses = useCallback(async () => {
    try {
      const res = await fetch('/api/accounting/inventory/warehouses?includeInactive=true');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setWarehouses(data.warehouses || []);
    } catch {
      toast.error(t('admin.inventory.adv.loadError'));
    }
  }, [t]);

  const fetchStockLevels = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(stockPage), limit: '50' });
      if (stockWarehouseFilter) params.set('warehouseId', stockWarehouseFilter);
      if (stockSearch) params.set('search', stockSearch);

      const res = await fetch(`/api/accounting/inventory?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setStockLevels(data.levels || []);
      setStockTotal(data.pagination?.total || 0);
    } catch {
      toast.error(t('admin.inventory.adv.loadError'));
    } finally {
      setLoading(false);
    }
  }, [stockPage, stockWarehouseFilter, stockSearch, t]);

  const fetchMovements = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(movementsPage), limit: '50' });
      if (movementsWarehouseFilter) params.set('warehouseId', movementsWarehouseFilter);
      if (movementsTypeFilter) params.set('type', movementsTypeFilter);

      const res = await fetch(`/api/accounting/inventory/movements?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setMovements(data.movements || []);
      setMovementsTotal(data.pagination?.total || 0);
    } catch {
      toast.error(t('admin.inventory.adv.loadError'));
    } finally {
      setLoading(false);
    }
  }, [movementsPage, movementsWarehouseFilter, movementsTypeFilter, t]);

  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(transfersPage), limit: '20' });
      if (transfersStatusFilter) params.set('status', transfersStatusFilter);

      const res = await fetch(`/api/accounting/inventory/transfers?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setTransfers(data.transfers || []);
      setTransfersTotal(data.pagination?.total || 0);
    } catch {
      toast.error(t('admin.inventory.adv.loadError'));
    } finally {
      setLoading(false);
    }
  }, [transfersPage, transfersStatusFilter, t]);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/accounting/inventory/alerts');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setAlerts(data.alerts || []);
      setAlertsCount(data.count || 0);
    } catch {
      toast.error(t('admin.inventory.adv.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchValuation = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ costMethod: valuationCostMethod });
      if (valuationWarehouse) params.set('warehouseId', valuationWarehouse);

      const res = await fetch(`/api/accounting/inventory/valuation?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setValuation(data.report || null);
    } catch {
      toast.error(t('admin.inventory.adv.loadError'));
    } finally {
      setLoading(false);
    }
  }, [valuationCostMethod, valuationWarehouse, t]);

  // Initial load
  useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  // Tab-specific data loading
  useEffect(() => {
    switch (activeTab) {
      case 'stock': fetchStockLevels(); break;
      case 'movements': fetchMovements(); break;
      case 'transfers': fetchTransfers(); break;
      case 'alerts': fetchAlerts(); break;
      case 'valuation': fetchValuation(); break;
    }
  }, [activeTab, fetchStockLevels, fetchMovements, fetchTransfers, fetchAlerts, fetchValuation]);

  // ---------------------------------------------------------------------------
  // Warehouse CRUD
  // ---------------------------------------------------------------------------

  function openCreateWarehouse() {
    setEditingWarehouse(null);
    setWhName('');
    setWhCode('');
    setWhAddress('');
    setWhIsDefault(false);
    setShowWarehouseModal(true);
  }

  function openEditWarehouse(wh: WarehouseData) {
    setEditingWarehouse(wh);
    setWhName(wh.name);
    setWhCode(wh.code);
    setWhAddress(wh.address || '');
    setWhIsDefault(wh.isDefault);
    setShowWarehouseModal(true);
  }

  async function handleSaveWarehouse() {
    if (!whName.trim() || !whCode.trim()) {
      toast.error(t('admin.inventory.adv.requiredFields'));
      return;
    }

    try {
      const payload = { name: whName, code: whCode, address: whAddress || undefined, isDefault: whIsDefault };

      if (editingWarehouse) {
        const res = await fetch(`/api/accounting/inventory/warehouses/${editingWarehouse.id}`, {
          method: 'PUT',
          headers: { ...addCSRFHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to update');
        }
        toast.success(t('admin.inventory.adv.warehouseUpdated'));
      } else {
        const res = await fetch('/api/accounting/inventory/warehouses', {
          method: 'POST',
          headers: { ...addCSRFHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to create');
        }
        toast.success(t('admin.inventory.adv.warehouseCreated'));
      }

      setShowWarehouseModal(false);
      fetchWarehouses();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('admin.inventory.adv.saveError'));
    }
  }

  async function handleDeleteWarehouse() {
    if (!deleteConfirmId) return;
    try {
      const res = await fetch(`/api/accounting/inventory/warehouses/${deleteConfirmId}`, {
        method: 'DELETE',
        headers: addCSRFHeader(),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete');
      }
      toast.success(t('admin.inventory.adv.warehouseDeleted'));
      setDeleteConfirmId(null);
      fetchWarehouses();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('admin.inventory.adv.deleteError'));
    }
  }

  // ---------------------------------------------------------------------------
  // Stock Adjustment
  // ---------------------------------------------------------------------------

  function openAdjustModal(sl: StockLevelData) {
    setAdjustTarget(sl);
    setAdjustNewQty(String(sl.quantity));
    setAdjustReason('');
    setShowAdjustModal(true);
  }

  async function handleAdjustStock() {
    if (!adjustTarget || !adjustReason.trim()) {
      toast.error(t('admin.inventory.adv.reasonRequired'));
      return;
    }

    try {
      const res = await fetch('/api/accounting/inventory', {
        method: 'PUT',
        headers: { ...addCSRFHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: adjustTarget.productId,
          warehouseId: adjustTarget.warehouseId,
          newQuantity: parseFloat(adjustNewQty),
          reason: adjustReason,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to adjust');
      }

      toast.success(t('admin.inventory.adv.stockAdjusted'));
      setShowAdjustModal(false);
      fetchStockLevels();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('admin.inventory.adv.adjustError'));
    }
  }

  // ---------------------------------------------------------------------------
  // Transfer creation
  // ---------------------------------------------------------------------------

  function openTransferModal() {
    setTrfFrom('');
    setTrfTo('');
    setTrfNotes('');
    setTrfItems([{ productId: '', productName: '', quantity: '', unitCost: '' }]);
    setShowTransferModal(true);
  }

  function addTransferItem() {
    setTrfItems([...trfItems, { productId: '', productName: '', quantity: '', unitCost: '' }]);
  }

  function removeTransferItem(index: number) {
    setTrfItems(trfItems.filter((_, i) => i !== index));
  }

  function updateTransferItem(index: number, field: string, value: string) {
    const updated = [...trfItems];
    updated[index] = { ...updated[index], [field]: value };
    setTrfItems(updated);
  }

  async function handleCreateTransfer() {
    if (!trfFrom || !trfTo) {
      toast.error(t('admin.inventory.adv.selectWarehouses'));
      return;
    }
    if (trfFrom === trfTo) {
      toast.error(t('admin.inventory.adv.differentWarehouses'));
      return;
    }

    const validItems = trfItems
      .filter((i) => i.productId && i.productName && parseFloat(i.quantity) > 0)
      .map((i) => ({
        productId: i.productId,
        productName: i.productName,
        quantity: parseFloat(i.quantity),
        unitCost: parseFloat(i.unitCost) || 0,
      }));

    if (validItems.length === 0) {
      toast.error(t('admin.inventory.adv.atLeastOneItem'));
      return;
    }

    try {
      const res = await fetch('/api/accounting/inventory/transfers', {
        method: 'POST',
        headers: { ...addCSRFHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromWarehouseId: trfFrom,
          toWarehouseId: trfTo,
          items: validItems,
          notes: trfNotes || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create transfer');
      }

      toast.success(t('admin.inventory.adv.transferCreated'));
      setShowTransferModal(false);
      fetchTransfers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('admin.inventory.adv.transferError'));
    }
  }

  async function handleTransferAction(id: string, action: 'complete' | 'cancel') {
    try {
      const res = await fetch(`/api/accounting/inventory/transfers/${id}`, {
        method: 'PUT',
        headers: { ...addCSRFHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed');
      }

      toast.success(
        action === 'complete'
          ? t('admin.inventory.adv.transferCompleted')
          : t('admin.inventory.adv.transferCancelled')
      );
      fetchTransfers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('admin.inventory.adv.transferError'));
    }
  }

  // ---------------------------------------------------------------------------
  // Tab definitions
  // ---------------------------------------------------------------------------

  const tabs: { id: TabId; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'stock', label: t('admin.inventory.adv.tabStock'), icon: <Package className="w-4 h-4" /> },
    { id: 'warehouses', label: t('admin.inventory.adv.tabWarehouses'), icon: <WarehouseIcon className="w-4 h-4" /> },
    { id: 'transfers', label: t('admin.inventory.adv.tabTransfers'), icon: <ArrowLeftRight className="w-4 h-4" /> },
    { id: 'movements', label: t('admin.inventory.adv.tabMovements'), icon: <History className="w-4 h-4" /> },
    { id: 'alerts', label: t('admin.inventory.adv.tabAlerts'), icon: <AlertTriangle className="w-4 h-4" />, count: alertsCount },
    { id: 'valuation', label: t('admin.inventory.adv.tabValuation'), icon: <BarChart3 className="w-4 h-4" /> },
  ];

  // ---------------------------------------------------------------------------
  // Stock levels columns
  // ---------------------------------------------------------------------------

  const stockColumns: Column<StockLevelData>[] = [
    {
      key: 'productId',
      header: t('admin.inventory.adv.colProductId'),
      render: (row) => <span className="font-mono text-sm">{row.productId}</span>,
    },
    {
      key: 'warehouse',
      header: t('admin.inventory.adv.colWarehouse'),
      render: (row) => (
        <span className="text-sm">
          {row.warehouse.name} <span className="text-gray-400">({row.warehouse.code})</span>
        </span>
      ),
    },
    {
      key: 'quantity',
      header: t('admin.inventory.adv.colQuantity'),
      render: (row) => {
        const isLow = row.reorderPoint !== null && row.quantity <= row.reorderPoint;
        const isZero = row.quantity <= 0;
        return (
          <span className={`font-semibold ${isZero ? 'text-red-600' : isLow ? 'text-orange-500' : 'text-green-600'}`}>
            {row.quantity.toFixed(2)}
          </span>
        );
      },
    },
    {
      key: 'reservedQty',
      header: t('admin.inventory.adv.colReserved'),
      render: (row) => <span className="text-sm text-gray-500">{row.reservedQty.toFixed(2)}</span>,
    },
    {
      key: 'available',
      header: t('admin.inventory.adv.colAvailable'),
      render: (row) => {
        const available = row.quantity - row.reservedQty;
        return <span className="font-medium">{available.toFixed(2)}</span>;
      },
    },
    {
      key: 'unitCost',
      header: t('admin.inventory.adv.colUnitCost'),
      render: (row) => <span className="text-sm">{formatCurrency(row.unitCost)}</span>,
    },
    {
      key: 'totalValue',
      header: t('admin.inventory.adv.colTotalValue'),
      render: (row) => <span className="font-medium">{formatCurrency(row.totalValue)}</span>,
    },
    {
      key: 'reorderPoint',
      header: t('admin.inventory.adv.colReorderPt'),
      render: (row) => <span className="text-sm text-gray-500">{row.reorderPoint?.toFixed(2) ?? '-'}</span>,
    },
    {
      key: 'actions',
      header: t('admin.inventory.adv.colActions'),
      render: (row) => (
        <button
          onClick={() => openAdjustModal(row)}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          title={t('admin.inventory.adv.adjustStock')}
        >
          <ClipboardCheck className="w-4 h-4" />
        </button>
      ),
    },
  ];

  // ---------------------------------------------------------------------------
  // Warehouse columns
  // ---------------------------------------------------------------------------

  const warehouseColumns: Column<WarehouseData>[] = [
    {
      key: 'name',
      header: t('admin.inventory.adv.colName'),
      render: (row) => (
        <div>
          <span className="font-medium">{row.name}</span>
          {row.isDefault && (
            <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{t('admin.inventory.adv.default')}</span>
          )}
        </div>
      ),
    },
    {
      key: 'code',
      header: t('admin.inventory.adv.colCode'),
      render: (row) => <span className="font-mono text-sm">{row.code}</span>,
    },
    {
      key: 'address',
      header: t('admin.inventory.adv.colAddress'),
      render: (row) => <span className="text-sm text-gray-500">{row.address || '-'}</span>,
    },
    {
      key: 'isActive',
      header: t('admin.inventory.adv.colStatus'),
      render: (row) => (
        <StatusBadge variant={row.isActive ? 'success' : 'error'}>
          {row.isActive ? t('admin.inventory.adv.active') : t('admin.inventory.adv.inactive')}
        </StatusBadge>
      ),
    },
    {
      key: 'stockLevels',
      header: t('admin.inventory.adv.colProducts'),
      render: (row) => <span className="text-sm">{row._count?.stockLevels ?? 0}</span>,
    },
    {
      key: 'actions',
      header: t('admin.inventory.adv.colActions'),
      render: (row) => (
        <div className="flex gap-2">
          <button onClick={() => openEditWarehouse(row)} className="text-blue-600 hover:text-blue-800">
            <Pencil className="w-4 h-4" />
          </button>
          {!row.isDefault && (
            <button onClick={() => setDeleteConfirmId(row.id)} className="text-red-600 hover:text-red-800">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  // ---------------------------------------------------------------------------
  // Transfer columns
  // ---------------------------------------------------------------------------

  const transferColumns: Column<TransferData>[] = [
    {
      key: 'transferNumber',
      header: t('admin.inventory.adv.colTransferNo'),
      render: (row) => <span className="font-mono text-sm font-medium">{row.transferNumber}</span>,
    },
    {
      key: 'from',
      header: t('admin.inventory.adv.colFrom'),
      render: (row) => <span className="text-sm">{row.fromWarehouse.name}</span>,
    },
    {
      key: 'to',
      header: t('admin.inventory.adv.colTo'),
      render: (row) => <span className="text-sm">{row.toWarehouse.name}</span>,
    },
    {
      key: 'items',
      header: t('admin.inventory.adv.colItems'),
      render: (row) => <span className="text-sm">{row.items.length}</span>,
    },
    {
      key: 'status',
      header: t('admin.inventory.adv.colStatus'),
      render: (row) => <StatusBadge variant={transferStatusBadge(row.status)}>{row.status}</StatusBadge>,
    },
    {
      key: 'createdAt',
      header: t('admin.inventory.adv.colDate'),
      render: (row) => <span className="text-sm text-gray-500">{new Date(row.createdAt).toLocaleDateString()}</span>,
    },
    {
      key: 'actions',
      header: t('admin.inventory.adv.colActions'),
      render: (row) => (
        <div className="flex gap-2">
          {row.status === 'IN_TRANSIT' && (
            <>
              <button
                onClick={() => handleTransferAction(row.id, 'complete')}
                className="text-green-600 hover:text-green-800"
                title={t('admin.inventory.adv.completeTransfer')}
              >
                <CheckCircle className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleTransferAction(row.id, 'cancel')}
                className="text-red-600 hover:text-red-800"
                title={t('admin.inventory.adv.cancelTransfer')}
              >
                <XCircle className="w-4 h-4" />
              </button>
            </>
          )}
          {row.status === 'PENDING' && (
            <button
              onClick={() => handleTransferAction(row.id, 'cancel')}
              className="text-red-600 hover:text-red-800"
              title={t('admin.inventory.adv.cancelTransfer')}
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  // ---------------------------------------------------------------------------
  // Movement columns
  // ---------------------------------------------------------------------------

  const movementColumns: Column<MovementData>[] = [
    {
      key: 'createdAt',
      header: t('admin.inventory.adv.colDate'),
      render: (row) => <span className="text-sm">{new Date(row.createdAt).toLocaleString()}</span>,
    },
    {
      key: 'type',
      header: t('admin.inventory.adv.colType'),
      render: (row) => <StatusBadge variant={movementTypeBadge(row.type)}>{row.type}</StatusBadge>,
    },
    {
      key: 'productId',
      header: t('admin.inventory.adv.colProductId'),
      render: (row) => <span className="font-mono text-sm">{row.productId}</span>,
    },
    {
      key: 'warehouse',
      header: t('admin.inventory.adv.colWarehouse'),
      render: (row) => <span className="text-sm">{row.warehouse.name}</span>,
    },
    {
      key: 'quantity',
      header: t('admin.inventory.adv.colQuantity'),
      render: (row) => <span className="font-medium">{row.quantity.toFixed(2)}</span>,
    },
    {
      key: 'unitCost',
      header: t('admin.inventory.adv.colUnitCost'),
      render: (row) => <span className="text-sm">{formatCurrency(row.unitCost)}</span>,
    },
    {
      key: 'totalCost',
      header: t('admin.inventory.adv.colTotalCost'),
      render: (row) => <span className="font-medium">{formatCurrency(row.totalCost)}</span>,
    },
    {
      key: 'reference',
      header: t('admin.inventory.adv.colReference'),
      render: (row) => <span className="text-sm text-gray-500">{row.reference || '-'}</span>,
    },
    {
      key: 'notes',
      header: t('admin.inventory.adv.colNotes'),
      render: (row) => (
        <span className="text-sm text-gray-500 truncate max-w-[200px] block">{row.notes || '-'}</span>
      ),
    },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.inventory.adv.pageTitle')}
        subtitle={t('admin.inventory.adv.pageSubtitle')}
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1 bg-red-100 text-red-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {/* ============================================================= */}
        {/* TAB: Stock Levels */}
        {/* ============================================================= */}
        {activeTab === 'stock' && (
          <div className="space-y-4">
            <FilterBar>
              <SelectFilter
                label={t('admin.inventory.adv.filterWarehouse')}
                value={stockWarehouseFilter}
                onChange={setStockWarehouseFilter}
                options={[
                  { value: '', label: t('admin.inventory.adv.allWarehouses') },
                  ...warehouses
                    .filter((w) => w.isActive)
                    .map((w) => ({ value: w.id, label: `${w.name} (${w.code})` })),
                ]}
              />
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={t('admin.inventory.adv.searchProduct')}
                  value={stockSearch}
                  onChange={(e) => setStockSearch(e.target.value)}
                  className="border rounded px-3 py-1.5 text-sm"
                />
              </div>
              <Button variant="secondary" size="sm" onClick={fetchStockLevels}>
                <RefreshCcw className="w-4 h-4 mr-1" /> {t('admin.inventory.adv.refresh')}
              </Button>
            </FilterBar>

            <DataTable
              columns={stockColumns}
              data={stockLevels}
              keyExtractor={(row) => row.id}
              loading={loading}
              emptyTitle={t('admin.inventory.adv.noStockData')}
            />

            {stockTotal > 50 && (
              <div className="flex justify-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setStockPage((p) => Math.max(1, p - 1))}
                  disabled={stockPage <= 1}
                >
                  {t('admin.inventory.adv.prev')}
                </Button>
                <span className="text-sm text-gray-500 self-center">
                  {t('admin.inventory.adv.pageOf', { page: String(stockPage), total: String(Math.ceil(stockTotal / 50)) })}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setStockPage((p) => p + 1)}
                  disabled={stockPage >= Math.ceil(stockTotal / 50)}
                >
                  {t('admin.inventory.adv.next')}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ============================================================= */}
        {/* TAB: Warehouses */}
        {/* ============================================================= */}
        {activeTab === 'warehouses' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button variant="primary" onClick={openCreateWarehouse}>
                <Plus className="w-4 h-4 mr-1" /> {t('admin.inventory.adv.createWarehouse')}
              </Button>
            </div>

            <DataTable
              columns={warehouseColumns}
              data={warehouses}
              keyExtractor={(row) => row.id}
              loading={loading}
              emptyTitle={t('admin.inventory.adv.noWarehouses')}
            />
          </div>
        )}

        {/* ============================================================= */}
        {/* TAB: Transfers */}
        {/* ============================================================= */}
        {activeTab === 'transfers' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <FilterBar>
                <SelectFilter
                  label={t('admin.inventory.adv.filterStatus')}
                  value={transfersStatusFilter}
                  onChange={setTransfersStatusFilter}
                  options={[
                    { value: '', label: t('admin.inventory.adv.allStatuses') },
                    { value: 'PENDING', label: 'PENDING' },
                    { value: 'IN_TRANSIT', label: 'IN_TRANSIT' },
                    { value: 'COMPLETED', label: 'COMPLETED' },
                    { value: 'CANCELLED', label: 'CANCELLED' },
                  ]}
                />
              </FilterBar>
              <Button variant="primary" onClick={openTransferModal}>
                <ArrowLeftRight className="w-4 h-4 mr-1" /> {t('admin.inventory.adv.newTransfer')}
              </Button>
            </div>

            <DataTable
              columns={transferColumns}
              data={transfers}
              keyExtractor={(row) => row.id}
              loading={loading}
              emptyTitle={t('admin.inventory.adv.noTransfers')}
            />

            {transfersTotal > 20 && (
              <div className="flex justify-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setTransfersPage((p) => Math.max(1, p - 1))}
                  disabled={transfersPage <= 1}
                >
                  {t('admin.inventory.adv.prev')}
                </Button>
                <span className="text-sm text-gray-500 self-center">
                  {t('admin.inventory.adv.pageOf', { page: String(transfersPage), total: String(Math.ceil(transfersTotal / 20)) })}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setTransfersPage((p) => p + 1)}
                  disabled={transfersPage >= Math.ceil(transfersTotal / 20)}
                >
                  {t('admin.inventory.adv.next')}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ============================================================= */}
        {/* TAB: Movements */}
        {/* ============================================================= */}
        {activeTab === 'movements' && (
          <div className="space-y-4">
            <FilterBar>
              <SelectFilter
                label={t('admin.inventory.adv.filterWarehouse')}
                value={movementsWarehouseFilter}
                onChange={setMovementsWarehouseFilter}
                options={[
                  { value: '', label: t('admin.inventory.adv.allWarehouses') },
                  ...warehouses.filter((w) => w.isActive).map((w) => ({ value: w.id, label: w.name })),
                ]}
              />
              <SelectFilter
                label={t('admin.inventory.adv.filterType')}
                value={movementsTypeFilter}
                onChange={setMovementsTypeFilter}
                options={[
                  { value: '', label: t('admin.inventory.adv.allTypes') },
                  { value: 'IN', label: 'IN' },
                  { value: 'OUT', label: 'OUT' },
                  { value: 'ADJUSTMENT', label: 'ADJUSTMENT' },
                  { value: 'TRANSFER_IN', label: 'TRANSFER_IN' },
                  { value: 'TRANSFER_OUT', label: 'TRANSFER_OUT' },
                  { value: 'RETURN', label: 'RETURN' },
                  { value: 'PRODUCTION', label: 'PRODUCTION' },
                  { value: 'CONSUMPTION', label: 'CONSUMPTION' },
                ]}
              />
            </FilterBar>

            <DataTable
              columns={movementColumns}
              data={movements}
              keyExtractor={(row) => row.id}
              loading={loading}
              emptyTitle={t('admin.inventory.adv.noMovements')}
            />

            {movementsTotal > 50 && (
              <div className="flex justify-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setMovementsPage((p) => Math.max(1, p - 1))}
                  disabled={movementsPage <= 1}
                >
                  {t('admin.inventory.adv.prev')}
                </Button>
                <span className="text-sm text-gray-500 self-center">
                  {t('admin.inventory.adv.pageOf', { page: String(movementsPage), total: String(Math.ceil(movementsTotal / 50)) })}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setMovementsPage((p) => p + 1)}
                  disabled={movementsPage >= Math.ceil(movementsTotal / 50)}
                >
                  {t('admin.inventory.adv.next')}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ============================================================= */}
        {/* TAB: Alerts */}
        {/* ============================================================= */}
        {activeTab === 'alerts' && (
          <div className="space-y-4">
            {alerts.length === 0 && !loading ? (
              <SectionCard>
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
                  <p className="text-lg font-medium">{t('admin.inventory.adv.noAlerts')}</p>
                  <p className="text-sm">{t('admin.inventory.adv.allStockHealthy')}</p>
                </div>
              </SectionCard>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert, idx) => (
                  <SectionCard key={idx}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-red-50 rounded-lg">
                          <AlertTriangle className="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {t('admin.inventory.adv.alertProduct')}: <span className="font-mono">{alert.productId}</span>
                          </p>
                          <p className="text-sm text-gray-500">
                            {alert.warehouseName} ({alert.warehouseCode}) &mdash;{' '}
                            {t('admin.inventory.adv.alertAvailable')}: {alert.availableQty.toFixed(2)} / {t('admin.inventory.adv.alertReorderPt')}: {alert.reorderPoint.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-red-600">
                          {t('admin.inventory.adv.alertDeficit')}: {alert.deficit.toFixed(2)}
                        </p>
                        {alert.reorderQty && (
                          <p className="text-xs text-gray-400">
                            {t('admin.inventory.adv.alertSuggestedQty')}: {alert.reorderQty.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  </SectionCard>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================= */}
        {/* TAB: Valuation */}
        {/* ============================================================= */}
        {activeTab === 'valuation' && (
          <div className="space-y-4">
            <FilterBar>
              <SelectFilter
                label={t('admin.inventory.adv.costMethod')}
                value={valuationCostMethod}
                onChange={(v) => { setValuationCostMethod(v); }}
                options={[
                  { value: 'WAC', label: 'WAC (Weighted Average Cost)' },
                  { value: 'FIFO', label: 'FIFO (First In, First Out)' },
                  { value: 'LIFO', label: 'LIFO (Last In, First Out)' },
                ]}
              />
              <SelectFilter
                label={t('admin.inventory.adv.filterWarehouse')}
                value={valuationWarehouse}
                onChange={setValuationWarehouse}
                options={[
                  { value: '', label: t('admin.inventory.adv.allWarehouses') },
                  ...warehouses.filter((w) => w.isActive).map((w) => ({ value: w.id, label: w.name })),
                ]}
              />
              <Button variant="secondary" size="sm" onClick={fetchValuation}>
                <RefreshCcw className="w-4 h-4 mr-1" /> {t('admin.inventory.adv.recalculate')}
              </Button>
            </FilterBar>

            {valuation && (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <StatCard
                    label={t('admin.inventory.adv.totalInventoryValue')}
                    value={formatCurrency(valuation.totalValue)}
                    icon={BarChart3}
                  />
                  <StatCard
                    label={t('admin.inventory.adv.totalItems')}
                    value={String(valuation.totalItems)}
                    icon={Package}
                  />
                  <StatCard
                    label={t('admin.inventory.adv.costMethodUsed')}
                    value={valuation.costMethod}
                    icon={BarChart3}
                  />
                </div>

                {/* By warehouse breakdown */}
                {valuation.byWarehouse.length > 1 && (
                  <SectionCard>
                    <h3 className="text-sm font-semibold mb-3">{t('admin.inventory.adv.byWarehouse')}</h3>
                    <div className="space-y-2">
                      {valuation.byWarehouse.map((wh) => (
                        <div key={wh.warehouseId} className="flex justify-between items-center py-2 border-b last:border-0">
                          <span className="text-sm font-medium">{wh.warehouseName}</span>
                          <div className="text-right">
                            <span className="text-sm font-semibold">{formatCurrency(wh.value)}</span>
                            <span className="text-xs text-gray-400 ml-2">({wh.items} {t('admin.inventory.adv.items')})</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                )}

                {/* Detail lines */}
                <SectionCard>
                  <h3 className="text-sm font-semibold mb-3">{t('admin.inventory.adv.valuationDetail')}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-gray-500">
                          <th className="py-2 pr-4">{t('admin.inventory.adv.colProductId')}</th>
                          <th className="py-2 pr-4">{t('admin.inventory.adv.colWarehouse')}</th>
                          <th className="py-2 pr-4 text-right">{t('admin.inventory.adv.colQuantity')}</th>
                          <th className="py-2 pr-4 text-right">{t('admin.inventory.adv.colUnitCost')}</th>
                          <th className="py-2 text-right">{t('admin.inventory.adv.colTotalValue')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {valuation.lines.map((line, idx) => (
                          <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="py-2 pr-4 font-mono">{line.productId}</td>
                            <td className="py-2 pr-4">{line.warehouseName} <span className="text-gray-400">({line.warehouseCode})</span></td>
                            <td className="py-2 pr-4 text-right">{line.quantity.toFixed(2)}</td>
                            <td className="py-2 pr-4 text-right">{formatCurrency(line.unitCost)}</td>
                            <td className="py-2 text-right font-semibold">{formatCurrency(line.totalValue)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 font-semibold">
                          <td colSpan={4} className="py-2 text-right pr-4">{t('admin.inventory.adv.grandTotal')}</td>
                          <td className="py-2 text-right">{formatCurrency(valuation.totalValue)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </SectionCard>
              </>
            )}

            {!valuation && !loading && (
              <SectionCard>
                <div className="text-center py-8 text-gray-500">
                  <p>{t('admin.inventory.adv.noValuationData')}</p>
                </div>
              </SectionCard>
            )}
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* Warehouse Modal */}
      {/* ================================================================= */}
      <Modal
        isOpen={showWarehouseModal}
        title={editingWarehouse ? t('admin.inventory.adv.editWarehouse') : t('admin.inventory.adv.createWarehouse')}
        onClose={() => setShowWarehouseModal(false)}
      >
          <div className="space-y-4">
            <FormField label={t('admin.inventory.adv.warehouseName')} required>
              <Input value={whName} onChange={(e) => setWhName(e.target.value)} placeholder={t('admin.inventory.adv.warehouseNamePh')} />
            </FormField>
            <FormField label={t('admin.inventory.adv.warehouseCode')} required>
              <Input
                value={whCode}
                onChange={(e) => setWhCode(e.target.value.toUpperCase())}
                placeholder={t('admin.inventory.adv.warehouseCodePh')}
                disabled={!!editingWarehouse}
              />
            </FormField>
            <FormField label={t('admin.inventory.adv.warehouseAddress')}>
              <Textarea value={whAddress} onChange={(e) => setWhAddress(e.target.value)} rows={2} />
            </FormField>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="wh-default"
                checked={whIsDefault}
                onChange={(e) => setWhIsDefault(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="wh-default" className="text-sm">{t('admin.inventory.adv.setAsDefault')}</label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => setShowWarehouseModal(false)}>
                {t('admin.inventory.adv.cancel')}
              </Button>
              <Button variant="primary" onClick={handleSaveWarehouse}>
                {editingWarehouse ? t('admin.inventory.adv.save') : t('admin.inventory.adv.create')}
              </Button>
            </div>
          </div>
        </Modal>

      {/* ================================================================= */}
      {/* Adjust Stock Modal */}
      {/* ================================================================= */}
      <Modal
        isOpen={showAdjustModal && !!adjustTarget}
        title={t('admin.inventory.adv.adjustStockTitle')}
        onClose={() => setShowAdjustModal(false)}
      >
          <div className="space-y-4">
            {adjustTarget && (
              <div className="bg-gray-50 p-3 rounded text-sm">
                <p><strong>{t('admin.inventory.adv.colProductId')}:</strong> {adjustTarget.productId}</p>
                <p><strong>{t('admin.inventory.adv.colWarehouse')}:</strong> {adjustTarget.warehouse.name}</p>
                <p><strong>{t('admin.inventory.adv.currentStock')}:</strong> {adjustTarget.quantity.toFixed(2)}</p>
              </div>
            )}
            <FormField label={t('admin.inventory.adv.newQuantity')} required>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={adjustNewQty}
                onChange={(e) => setAdjustNewQty(e.target.value)}
              />
            </FormField>
            <FormField label={t('admin.inventory.adv.adjustmentReason')} required>
              <Textarea
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder={t('admin.inventory.adv.adjustmentReasonPh')}
                rows={3}
              />
            </FormField>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => setShowAdjustModal(false)}>
                {t('admin.inventory.adv.cancel')}
              </Button>
              <Button variant="primary" onClick={handleAdjustStock}>
                {t('admin.inventory.adv.confirmAdjust')}
              </Button>
            </div>
          </div>
        </Modal>

      {/* ================================================================= */}
      {/* Transfer Modal */}
      {/* ================================================================= */}
      <Modal
        isOpen={showTransferModal}
        title={t('admin.inventory.adv.newTransfer')}
        onClose={() => setShowTransferModal(false)}
      >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <FormField label={t('admin.inventory.adv.fromWarehouse')} required>
                <select
                  value={trfFrom}
                  onChange={(e) => setTrfFrom(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="">{t('admin.inventory.adv.selectWarehouse')}</option>
                  {warehouses.filter((w) => w.isActive).map((w) => (
                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                  ))}
                </select>
              </FormField>
              <FormField label={t('admin.inventory.adv.toWarehouse')} required>
                <select
                  value={trfTo}
                  onChange={(e) => setTrfTo(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="">{t('admin.inventory.adv.selectWarehouse')}</option>
                  {warehouses.filter((w) => w.isActive && w.id !== trfFrom).map((w) => (
                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                  ))}
                </select>
              </FormField>
            </div>

            <FormField label={t('admin.inventory.adv.notes')}>
              <Textarea value={trfNotes} onChange={(e) => setTrfNotes(e.target.value)} rows={2} />
            </FormField>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">{t('admin.inventory.adv.transferItems')}</h4>
                <button onClick={addTransferItem} className="text-blue-600 text-sm hover:underline flex items-center gap-1">
                  <Plus className="w-3 h-3" /> {t('admin.inventory.adv.addItem')}
                </button>
              </div>

              {trfItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-gray-50 p-2 rounded">
                  <div className="col-span-3">
                    <label className="text-xs text-gray-500">{t('admin.inventory.adv.colProductId')}</label>
                    <input
                      type="text"
                      value={item.productId}
                      onChange={(e) => updateTransferItem(idx, 'productId', e.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="col-span-4">
                    <label className="text-xs text-gray-500">{t('admin.inventory.adv.productName')}</label>
                    <input
                      type="text"
                      value={item.productName}
                      onChange={(e) => updateTransferItem(idx, 'productName', e.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500">{t('admin.inventory.adv.colQuantity')}</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={item.quantity}
                      onChange={(e) => updateTransferItem(idx, 'quantity', e.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500">{t('admin.inventory.adv.colUnitCost')}</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.unitCost}
                      onChange={(e) => updateTransferItem(idx, 'unitCost', e.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    {trfItems.length > 1 && (
                      <button onClick={() => removeTransferItem(idx)} className="text-red-500 hover:text-red-700">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => setShowTransferModal(false)}>
                {t('admin.inventory.adv.cancel')}
              </Button>
              <Button variant="primary" onClick={handleCreateTransfer}>
                <Truck className="w-4 h-4 mr-1" /> {t('admin.inventory.adv.createTransferBtn')}
              </Button>
            </div>
          </div>
        </Modal>

      {/* ================================================================= */}
      {/* Delete Confirmation */}
      {/* ================================================================= */}
      <ConfirmDialog
        isOpen={!!deleteConfirmId}
        title={t('admin.inventory.adv.deleteWarehouseTitle')}
        message={t('admin.inventory.adv.deleteWarehouseMsg')}
        confirmLabel={t('admin.inventory.adv.delete')}
        onConfirm={handleDeleteWarehouse}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}

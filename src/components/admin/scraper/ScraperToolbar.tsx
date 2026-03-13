'use client';

/**
 * ScraperToolbar — Top toolbar with mode toggles for the scraper admin page.
 */

import {
  Search,
  Pencil,
  Eye,
  Layers,
  Download,
  History,
  FileSpreadsheet,
} from 'lucide-react';
import { useTranslations } from '@/hooks/useTranslations';

interface ScraperToolbarProps {
  drawingMode: boolean;
  showHeatmap: boolean;
  showStreetView: boolean;
  hasResults: boolean;
  onToggleDrawing: () => void;
  onToggleHeatmap: () => void;
  onToggleStreetView: () => void;
  onExportCsv: () => void;
  onExportExcel: () => void;
  onShowJobs: () => void;
  exporting: boolean;
  exportingExcel: boolean;
}

export default function ScraperToolbar({
  drawingMode,
  showHeatmap,
  showStreetView,
  hasResults,
  onToggleDrawing,
  onToggleHeatmap,
  onToggleStreetView,
  onExportCsv,
  onExportExcel,
  onShowJobs,
  exporting,
  exportingExcel,
}: ScraperToolbarProps) {
  const { t } = useTranslations();

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Drawing mode */}
      <button
        onClick={onToggleDrawing}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          drawingMode
            ? 'bg-blue-600 text-white'
            : 'bg-zinc-700/50 text-zinc-400 hover:bg-zinc-600/50 hover:text-white border border-zinc-600'
        }`}
      >
        <Pencil className="h-3.5 w-3.5" />
        {t('admin.scraper.drawZone')}
      </button>

      {/* Street View */}
      <button
        onClick={onToggleStreetView}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          showStreetView
            ? 'bg-blue-600 text-white'
            : 'bg-zinc-700/50 text-zinc-400 hover:bg-zinc-600/50 hover:text-white border border-zinc-600'
        }`}
      >
        <Eye className="h-3.5 w-3.5" />
        {t('admin.scraper.streetView')}
      </button>

      {/* Heatmap */}
      <button
        onClick={onToggleHeatmap}
        disabled={!hasResults}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          showHeatmap
            ? 'bg-orange-600 text-white'
            : 'bg-zinc-700/50 text-zinc-400 hover:bg-zinc-600/50 hover:text-white border border-zinc-600'
        } disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        <Layers className="h-3.5 w-3.5" />
        {t('admin.scraper.heatmap')}
      </button>

      <div className="w-px h-5 bg-zinc-700 mx-1" />

      {/* Export CSV */}
      <button
        onClick={onExportCsv}
        disabled={!hasResults || exporting}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-700/50 text-zinc-400 hover:bg-zinc-600/50 hover:text-white border border-zinc-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Download className="h-3.5 w-3.5" />
        {t('admin.scraper.exportCsv')}
      </button>

      {/* Export Excel */}
      <button
        onClick={onExportExcel}
        disabled={!hasResults || exportingExcel}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-800/40 text-green-400 hover:bg-green-700/50 hover:text-green-300 border border-green-700/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <FileSpreadsheet className="h-3.5 w-3.5" />
        {t('admin.scraper.exportExcel')}
      </button>

      {/* Job History */}
      <button
        onClick={onShowJobs}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-700/50 text-zinc-400 hover:bg-zinc-600/50 hover:text-white border border-zinc-600 transition-colors"
      >
        <History className="h-3.5 w-3.5" />
        {t('admin.scraper.jobHistory')}
      </button>
    </div>
  );
}

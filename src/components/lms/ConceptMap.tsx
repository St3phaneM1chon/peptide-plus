'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useTranslations } from '@/hooks/useTranslations';

// ── Types ────────────────────────────────────────────────────

export interface ConceptNode {
  id: string;
  name: string;
  prerequisites: string[];
  masteryLevel: number; // 0-100
  domain: string;
  description?: string;
  lessonCount?: number;
}

export interface ConceptMapProps {
  concepts: ConceptNode[];
  onConceptClick?: (concept: ConceptNode) => void;
}

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  concept: ConceptNode;
}

interface PopupData {
  concept: ConceptNode;
  x: number;
  y: number;
}

// ── Constants ───────────────────────────────────────────────

const NODE_RADIUS = 28;
const NODE_SPACING_X = 160;
const NODE_SPACING_Y = 100;
const PADDING = 60;

// ── Color helpers ───────────────────────────────────────────

function getMasteryColor(level: number): { fill: string; stroke: string; text: string; bg: string } {
  if (level === 0) return { fill: '#e5e7eb', stroke: '#9ca3af', text: '#6b7280', bg: 'bg-gray-100' };
  if (level < 30) return { fill: '#fef2f2', stroke: '#ef4444', text: '#dc2626', bg: 'bg-red-50' };
  if (level < 60) return { fill: '#fffbeb', stroke: '#f59e0b', text: '#d97706', bg: 'bg-yellow-50' };
  if (level < 85) return { fill: '#f0fdf4', stroke: '#22c55e', text: '#16a34a', bg: 'bg-green-50' };
  return { fill: '#ecfdf5', stroke: '#059669', text: '#047857', bg: 'bg-emerald-50' };
}

function getDomainColor(domain: string): string {
  const colors = [
    'rgba(59,130,246,0.08)',  // blue
    'rgba(168,85,247,0.08)',  // purple
    'rgba(236,72,153,0.08)',  // pink
    'rgba(245,158,11,0.08)', // amber
    'rgba(34,197,94,0.08)',  // green
    'rgba(20,184,166,0.08)', // teal
    'rgba(239,68,68,0.08)',  // red
    'rgba(99,102,241,0.08)', // indigo
  ];
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = domain.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getDomainBorderColor(domain: string): string {
  const colors = [
    'rgba(59,130,246,0.2)',
    'rgba(168,85,247,0.2)',
    'rgba(236,72,153,0.2)',
    'rgba(245,158,11,0.2)',
    'rgba(34,197,94,0.2)',
    'rgba(20,184,166,0.2)',
    'rgba(239,68,68,0.2)',
    'rgba(99,102,241,0.2)',
  ];
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = domain.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// ── Layout algorithm (layered DAG) ─────────────────────────

function layoutNodes(concepts: ConceptNode[]): LayoutNode[] {
  const idMap = new Map(concepts.map(c => [c.id, c]));
  const levels = new Map<string, number>();

  // Compute topological levels
  function getLevel(id: string, visited: Set<string> = new Set()): number {
    if (levels.has(id)) return levels.get(id)!;
    if (visited.has(id)) return 0; // cycle guard
    visited.add(id);
    const concept = idMap.get(id);
    if (!concept || concept.prerequisites.length === 0) {
      levels.set(id, 0);
      return 0;
    }
    const maxPre = Math.max(
      ...concept.prerequisites
        .filter(p => idMap.has(p))
        .map(p => getLevel(p, visited))
    );
    const lvl = maxPre + 1;
    levels.set(id, lvl);
    return lvl;
  }

  concepts.forEach(c => getLevel(c.id));

  // Group by level
  const byLevel = new Map<number, ConceptNode[]>();
  concepts.forEach(c => {
    const lvl = levels.get(c.id) ?? 0;
    if (!byLevel.has(lvl)) byLevel.set(lvl, []);
    byLevel.get(lvl)!.push(c);
  });

  const result: LayoutNode[] = [];
  const sortedLevels = Array.from(byLevel.keys()).sort((a, b) => a - b);

  sortedLevels.forEach((level) => {
    const nodes = byLevel.get(level)!;
    // Sort within level by domain for visual grouping
    nodes.sort((a, b) => a.domain.localeCompare(b.domain));

    nodes.forEach((concept, indexInLevel) => {
      result.push({
        id: concept.id,
        x: PADDING + level * NODE_SPACING_X + NODE_RADIUS,
        y: PADDING + indexInLevel * NODE_SPACING_Y + NODE_RADIUS,
        concept,
      });
    });
  });

  return result;
}

// ── Arrow path between nodes ────────────────────────────────

function getArrowPath(from: LayoutNode, to: LayoutNode): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return '';

  const nx = dx / dist;
  const ny = dy / dist;

  const startX = from.x + nx * (NODE_RADIUS + 4);
  const startY = from.y + ny * (NODE_RADIUS + 4);
  const endX = to.x - nx * (NODE_RADIUS + 8);
  const endY = to.y - ny * (NODE_RADIUS + 8);

  // Bezier curve for smoother edges
  const midX = (startX + endX) / 2;
  const cpOffset = Math.abs(dy) * 0.3;

  return `M ${startX} ${startY} C ${midX + cpOffset} ${startY}, ${midX - cpOffset} ${endY}, ${endX} ${endY}`;
}

// ── Component ───────────────────────────────────────────────

export default function ConceptMap({ concepts, onConceptClick }: ConceptMapProps) {
  const { t } = useTranslations();
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [popup, setPopup] = useState<PopupData | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const layoutedNodes = useMemo(() => layoutNodes(concepts), [concepts]);
  const nodeMap = useMemo(() => new Map(layoutedNodes.map(n => [n.id, n])), [layoutedNodes]);

  // Domains for legend + grouping
  const domains = useMemo(() => {
    const set = new Set(concepts.map(c => c.domain));
    return Array.from(set).sort();
  }, [concepts]);

  // Compute domain group rectangles
  const domainGroups = useMemo(() => {
    const groups: { domain: string; x: number; y: number; width: number; height: number }[] = [];
    domains.forEach(domain => {
      const nodes = layoutedNodes.filter(n => n.concept.domain === domain);
      if (nodes.length === 0) return;
      const minX = Math.min(...nodes.map(n => n.x)) - NODE_RADIUS - 20;
      const maxX = Math.max(...nodes.map(n => n.x)) + NODE_RADIUS + 20;
      const minY = Math.min(...nodes.map(n => n.y)) - NODE_RADIUS - 20;
      const maxY = Math.max(...nodes.map(n => n.y)) + NODE_RADIUS + 20;
      groups.push({ domain, x: minX, y: minY, width: maxX - minX, height: maxY - minY });
    });
    return groups;
  }, [domains, layoutedNodes]);

  // SVG dimensions
  const svgWidth = useMemo(() => {
    if (layoutedNodes.length === 0) return 400;
    return Math.max(...layoutedNodes.map(n => n.x)) + PADDING + NODE_RADIUS + 40;
  }, [layoutedNodes]);

  const svgHeight = useMemo(() => {
    if (layoutedNodes.length === 0) return 300;
    return Math.max(...layoutedNodes.map(n => n.y)) + PADDING + NODE_RADIUS + 40;
  }, [layoutedNodes]);

  // Edges
  const edges = useMemo(() => {
    const result: { from: LayoutNode; to: LayoutNode }[] = [];
    layoutedNodes.forEach(node => {
      node.concept.prerequisites.forEach(preId => {
        const fromNode = nodeMap.get(preId);
        if (fromNode) {
          result.push({ from: fromNode, to: node });
        }
      });
    });
    return result;
  }, [layoutedNodes, nodeMap]);

  const handleZoomIn = useCallback(() => setZoom(z => Math.min(z + 0.2, 2)), []);
  const handleZoomOut = useCallback(() => setZoom(z => Math.max(z - 0.2, 0.4)), []);

  const handleNodeClick = useCallback((concept: ConceptNode, svgX: number, svgY: number) => {
    setPopup({ concept, x: svgX, y: svgY });
    onConceptClick?.(concept);
  }, [onConceptClick]);

  // Close popup on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popup && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPopup(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [popup]);

  // Close popup on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPopup(null);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  if (concepts.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        {t('learn.conceptMap.noConcepts')}
      </div>
    );
  }

  return (
    <div className="w-full" ref={containerRef}>
      {/* Controls */}
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="text-sm font-semibold text-gray-700">{t('learn.conceptMap.title')}</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors"
            aria-label={t('learn.conceptMap.zoomOut')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
            </svg>
          </button>
          <span className="text-xs font-mono text-gray-400 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={handleZoomIn}
            className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors"
            aria-label={t('learn.conceptMap.zoomIn')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* SVG Graph */}
      <div className="overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm" style={{ maxHeight: '480px' }}>
        <svg
          width={svgWidth * zoom}
          height={svgHeight * zoom}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="select-none"
          role="img"
          aria-label={t('learn.conceptMap.title')}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="#9ca3af" />
            </marker>
            <marker
              id="arrowhead-active"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="#3b82f6" />
            </marker>
            <filter id="node-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.08" />
            </filter>
          </defs>

          {/* Domain group backgrounds */}
          {domainGroups.map(g => (
            <g key={`group-${g.domain}`}>
              <rect
                x={g.x}
                y={g.y}
                width={g.width}
                height={g.height}
                rx={12}
                fill={getDomainColor(g.domain)}
                stroke={getDomainBorderColor(g.domain)}
                strokeWidth={1}
              />
              <text
                x={g.x + 8}
                y={g.y + 14}
                fontSize={10}
                fill="#9ca3af"
                fontWeight={500}
              >
                {g.domain}
              </text>
            </g>
          ))}

          {/* Edges */}
          {edges.map((edge, i) => {
            const isHighlighted = hoveredNode === edge.from.id || hoveredNode === edge.to.id;
            return (
              <path
                key={`edge-${i}`}
                d={getArrowPath(edge.from, edge.to)}
                fill="none"
                stroke={isHighlighted ? '#3b82f6' : '#d1d5db'}
                strokeWidth={isHighlighted ? 2.5 : 1.5}
                strokeDasharray={isHighlighted ? undefined : '4 2'}
                markerEnd={isHighlighted ? 'url(#arrowhead-active)' : 'url(#arrowhead)'}
                className="transition-all duration-200"
              />
            );
          })}

          {/* Nodes */}
          {layoutedNodes.map(node => {
            const colors = getMasteryColor(node.concept.masteryLevel);
            const isHovered = hoveredNode === node.id;
            const r = isHovered ? NODE_RADIUS + 4 : NODE_RADIUS;

            return (
              <g
                key={node.id}
                className="cursor-pointer"
                onClick={() => handleNodeClick(node.concept, node.x, node.y)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                role="button"
                tabIndex={0}
                aria-label={`${node.concept.name}: ${node.concept.masteryLevel}%`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNodeClick(node.concept, node.x, node.y);
                }}
              >
                {/* Mastery ring (background arc) */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r + 3}
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth={3}
                />
                {/* Mastery ring (filled arc) */}
                {node.concept.masteryLevel > 0 && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={r + 3}
                    fill="none"
                    stroke={colors.stroke}
                    strokeWidth={3}
                    strokeDasharray={`${(node.concept.masteryLevel / 100) * 2 * Math.PI * (r + 3)} ${2 * Math.PI * (r + 3)}`}
                    strokeDashoffset={2 * Math.PI * (r + 3) * 0.25}
                    strokeLinecap="round"
                    className="transition-all duration-300"
                  />
                )}

                {/* Node circle */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r}
                  fill={colors.fill}
                  stroke={colors.stroke}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  filter="url(#node-shadow)"
                  className="transition-all duration-200"
                />

                {/* Mastery percentage */}
                <text
                  x={node.x}
                  y={node.y + 1}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={12}
                  fontWeight={700}
                  fill={colors.text}
                >
                  {node.concept.masteryLevel > 0 ? `${node.concept.masteryLevel}%` : '—'}
                </text>

                {/* Label below */}
                <text
                  x={node.x}
                  y={node.y + r + 16}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={500}
                  fill="#374151"
                  className="select-none"
                >
                  {node.concept.name.length > 16
                    ? node.concept.name.slice(0, 14) + '...'
                    : node.concept.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Popup */}
      {popup && (
        <div
          className="absolute z-20 w-72 bg-white rounded-xl shadow-xl border border-gray-200 p-4 animate-in fade-in slide-in-from-bottom-2 duration-200"
          style={{
            left: Math.min(popup.x * zoom + 40, (containerRef.current?.offsetWidth ?? 400) - 300),
            top: popup.y * zoom - 20,
          }}
          role="dialog"
          aria-label={popup.concept.name}
        >
          <div className="flex items-start justify-between mb-2">
            <h4 className="text-sm font-bold text-gray-900">{popup.concept.name}</h4>
            <button
              onClick={() => setPopup(null)}
              className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              aria-label={t('learn.conceptMap.close')}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 mb-2">
            {popup.concept.domain}
          </span>

          {popup.concept.description && (
            <p className="text-xs text-gray-500 mb-3 leading-relaxed">{popup.concept.description}</p>
          )}

          {/* Mastery bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-500">{t('learn.conceptMap.mastery')}</span>
              <span className="font-semibold" style={{ color: getMasteryColor(popup.concept.masteryLevel).text }}>
                {popup.concept.masteryLevel}%
              </span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${popup.concept.masteryLevel}%`,
                  backgroundColor: getMasteryColor(popup.concept.masteryLevel).stroke,
                }}
              />
            </div>
          </div>

          {/* Prerequisites */}
          {popup.concept.prerequisites.length > 0 && (
            <div className="text-xs text-gray-500">
              <span className="font-medium">{t('learn.conceptMap.prerequisites')}:</span>{' '}
              {popup.concept.prerequisites
                .map(id => concepts.find(c => c.id === id)?.name ?? id)
                .join(', ')}
            </div>
          )}

          {popup.concept.lessonCount !== undefined && (
            <div className="text-xs text-gray-400 mt-1">
              {t('learn.conceptMap.lessons', { count: popup.concept.lessonCount })}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 px-2">
        <span className="text-xs font-medium text-gray-500">{t('learn.conceptMap.legend')}:</span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-3 h-3 rounded-full bg-gray-200 border border-gray-400" />
          {t('learn.conceptMap.notStarted')}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-3 h-3 rounded-full bg-red-100 border border-red-400" />
          {t('learn.conceptMap.weak')}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-3 h-3 rounded-full bg-yellow-100 border border-yellow-400" />
          {t('learn.conceptMap.developing')}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-3 h-3 rounded-full bg-green-100 border border-green-400" />
          {t('learn.conceptMap.strong')}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-3 h-3 rounded-full bg-emerald-100 border border-emerald-500" />
          {t('learn.conceptMap.mastered')}
        </span>
      </div>
    </div>
  );
}

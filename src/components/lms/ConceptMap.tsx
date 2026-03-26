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

// ── Color helpers (dark glass mastery palette) ───────────────

function getMasteryColor(level: number): { fill: string; stroke: string; glow: string; text: string } {
  if (level === 0) return {
    fill: 'rgba(255, 255, 255, 0.05)',
    stroke: 'rgba(255, 255, 255, 0.15)',
    glow: 'none',
    text: 'rgba(255, 255, 255, 0.25)',
  };
  if (level < 30) return {
    fill: 'rgba(244, 63, 94, 0.08)',
    stroke: '#f43f5e',
    glow: '0 0 12px rgba(244, 63, 94, 0.3)',
    text: '#fb7185',
  };
  if (level < 60) return {
    fill: 'rgba(245, 158, 11, 0.08)',
    stroke: '#f59e0b',
    glow: '0 0 12px rgba(245, 158, 11, 0.3)',
    text: '#fbbf24',
  };
  if (level < 85) return {
    fill: 'rgba(16, 185, 129, 0.08)',
    stroke: '#10b981',
    glow: '0 0 12px rgba(16, 185, 129, 0.3)',
    text: '#34d399',
  };
  return {
    fill: 'rgba(5, 150, 105, 0.12)',
    stroke: '#059669',
    glow: '0 0 16px rgba(5, 150, 105, 0.4)',
    text: '#6ee7b7',
  };
}

function getDomainColor(domain: string): string {
  const colors = [
    'rgba(99, 102, 241, 0.06)',   // indigo
    'rgba(168, 85, 247, 0.06)',   // purple
    'rgba(236, 72, 153, 0.06)',   // pink
    'rgba(245, 158, 11, 0.06)',   // amber
    'rgba(16, 185, 129, 0.06)',   // emerald
    'rgba(6, 182, 212, 0.06)',    // cyan
    'rgba(244, 63, 94, 0.06)',    // rose
    'rgba(99, 102, 241, 0.06)',   // indigo
  ];
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = domain.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getDomainBorderColor(domain: string): string {
  const colors = [
    'rgba(99, 102, 241, 0.15)',
    'rgba(168, 85, 247, 0.15)',
    'rgba(236, 72, 153, 0.15)',
    'rgba(245, 158, 11, 0.15)',
    'rgba(16, 185, 129, 0.15)',
    'rgba(6, 182, 212, 0.15)',
    'rgba(244, 63, 94, 0.15)',
    'rgba(99, 102, 241, 0.15)',
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
      <div className="flex items-center justify-center py-16" style={{ color: 'var(--k-text-muted)' }}>
        {t('learn.conceptMap.noConcepts')}
      </div>
    );
  }

  return (
    <div className="w-full" ref={containerRef}>
      {/* Controls */}
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--k-text-secondary)' }}>
          {t('learn.conceptMap.title')}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="w-8 h-8 flex items-center justify-center transition-all"
            style={{
              background: 'var(--k-glass-thin)',
              border: '1px solid var(--k-border-subtle)',
              borderRadius: 'var(--k-radius-md)',
              color: 'var(--k-text-tertiary)',
            }}
            aria-label={t('learn.conceptMap.zoomOut')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
            </svg>
          </button>
          <span className="text-xs w-12 text-center" style={{ fontFamily: 'var(--k-font-mono)', color: 'var(--k-text-muted)' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="w-8 h-8 flex items-center justify-center transition-all"
            style={{
              background: 'var(--k-glass-thin)',
              border: '1px solid var(--k-border-subtle)',
              borderRadius: 'var(--k-radius-md)',
              color: 'var(--k-text-tertiary)',
            }}
            aria-label={t('learn.conceptMap.zoomIn')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* SVG Graph — transparent bg on dark page */}
      <div
        className="overflow-auto"
        style={{
          maxHeight: '480px',
          background: 'transparent',
          border: '1px solid var(--k-border-subtle)',
          borderRadius: 'var(--k-radius-xl)',
        }}
      >
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
              <polygon points="0 0, 8 3, 0 6" fill="rgba(255, 255, 255, 0.15)" />
            </marker>
            <marker
              id="arrowhead-active"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="#6366f1" />
            </marker>
            <filter id="node-glow">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#6366f1" floodOpacity="0.3" />
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
                fill="rgba(255, 255, 255, 0.25)"
                fontWeight={500}
              >
                {g.domain}
              </text>
            </g>
          ))}

          {/* Edges — subtle white lines */}
          {edges.map((edge, i) => {
            const isHighlighted = hoveredNode === edge.from.id || hoveredNode === edge.to.id;
            return (
              <path
                key={`edge-${i}`}
                d={getArrowPath(edge.from, edge.to)}
                fill="none"
                stroke={isHighlighted ? '#6366f1' : 'rgba(255, 255, 255, 0.15)'}
                strokeWidth={isHighlighted ? 2.5 : 1.5}
                strokeDasharray={isHighlighted ? undefined : '4 2'}
                markerEnd={isHighlighted ? 'url(#arrowhead-active)' : 'url(#arrowhead)'}
                className="transition-all duration-200"
              />
            );
          })}

          {/* Nodes — glass circles with mastery-based glow */}
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
                  stroke="rgba(255, 255, 255, 0.08)"
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

                {/* Node circle — glass fill */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r}
                  fill={colors.fill}
                  stroke={colors.stroke}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  filter={isHovered ? 'url(#node-glow)' : undefined}
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
                  {node.concept.masteryLevel > 0 ? `${node.concept.masteryLevel}%` : '\u2014'}
                </text>

                {/* Label below */}
                <text
                  x={node.x}
                  y={node.y + r + 16}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={500}
                  fill="rgba(255, 255, 255, 0.6)"
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

      {/* Popup — glass surface with backdrop-blur */}
      {popup && (
        <div
          className="absolute z-20 w-72 p-4 animate-in fade-in slide-in-from-bottom-2 duration-200"
          style={{
            left: Math.min(popup.x * zoom + 40, (containerRef.current?.offsetWidth ?? 400) - 300),
            top: popup.y * zoom - 20,
            background: 'var(--k-glass-thick)',
            backdropFilter: 'blur(var(--k-blur-xl))',
            WebkitBackdropFilter: 'blur(var(--k-blur-xl))',
            border: '1px solid var(--k-border-default)',
            borderRadius: 'var(--k-radius-xl)',
            boxShadow: 'var(--k-shadow-xl)',
          }}
          role="dialog"
          aria-label={popup.concept.name}
        >
          <div className="flex items-start justify-between mb-2">
            <h4 className="text-sm font-bold" style={{ color: 'var(--k-text-primary)' }}>{popup.concept.name}</h4>
            <button
              onClick={() => setPopup(null)}
              className="p-0.5 rounded transition-all"
              style={{ color: 'var(--k-text-muted)' }}
              aria-label={t('learn.conceptMap.close')}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <span
            className="inline-block text-xs px-2 py-0.5 mb-2"
            style={{
              background: 'var(--k-glass-thin)',
              border: '1px solid var(--k-border-subtle)',
              borderRadius: 'var(--k-radius-pill)',
              color: 'var(--k-text-secondary)',
            }}
          >
            {popup.concept.domain}
          </span>

          {popup.concept.description && (
            <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--k-text-secondary)' }}>
              {popup.concept.description}
            </p>
          )}

          {/* Mastery bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span style={{ color: 'var(--k-text-tertiary)' }}>{t('learn.conceptMap.mastery')}</span>
              <span className="font-semibold" style={{ color: getMasteryColor(popup.concept.masteryLevel).text }}>
                {popup.concept.masteryLevel}%
              </span>
            </div>
            <div
              className="w-full h-2 overflow-hidden"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: 'var(--k-radius-pill)',
              }}
            >
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${popup.concept.masteryLevel}%`,
                  backgroundColor: getMasteryColor(popup.concept.masteryLevel).stroke,
                  borderRadius: 'var(--k-radius-pill)',
                }}
              />
            </div>
          </div>

          {/* Prerequisites */}
          {popup.concept.prerequisites.length > 0 && (
            <div className="text-xs" style={{ color: 'var(--k-text-tertiary)' }}>
              <span className="font-medium">{t('learn.conceptMap.prerequisites')}:</span>{' '}
              {popup.concept.prerequisites
                .map(id => concepts.find(c => c.id === id)?.name ?? id)
                .join(', ')}
            </div>
          )}

          {popup.concept.lessonCount !== undefined && (
            <div className="text-xs mt-1" style={{ color: 'var(--k-text-muted)' }}>
              {t('learn.conceptMap.lessons', { count: popup.concept.lessonCount })}
            </div>
          )}
        </div>
      )}

      {/* Legend — dark glass tokens */}
      <div className="mt-4 flex flex-wrap items-center gap-4 px-2">
        <span className="text-xs font-medium" style={{ color: 'var(--k-text-tertiary)' }}>{t('learn.conceptMap.legend')}:</span>
        <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--k-text-tertiary)' }}>
          <span className="w-3 h-3 rounded-full" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.15)' }} />
          {t('learn.conceptMap.notStarted')}
        </span>
        <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--k-text-tertiary)' }}>
          <span className="w-3 h-3 rounded-full" style={{ background: 'rgba(244, 63, 94, 0.08)', border: '1px solid #f43f5e' }} />
          {t('learn.conceptMap.weak')}
        </span>
        <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--k-text-tertiary)' }}>
          <span className="w-3 h-3 rounded-full" style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid #f59e0b' }} />
          {t('learn.conceptMap.developing')}
        </span>
        <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--k-text-tertiary)' }}>
          <span className="w-3 h-3 rounded-full" style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid #10b981' }} />
          {t('learn.conceptMap.strong')}
        </span>
        <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--k-text-tertiary)' }}>
          <span className="w-3 h-3 rounded-full" style={{ background: 'rgba(5, 150, 105, 0.12)', border: '1px solid #059669' }} />
          {t('learn.conceptMap.mastered')}
        </span>
      </div>
    </div>
  );
}

'use client';

import { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  NodeProps,
  EdgeProps,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
  Connection,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Zap,
  Mail,
  MessageSquare,
  ClipboardList,
  Bell,
  Globe,
  UserPlus,
  GitBranch,
  Tag,
  Clock,
  Plus,
  Trash2,
  Settings,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface WorkflowStep {
  id?: string;
  actionType: string;
  config: Record<string, unknown>;
  delayMinutes: number;
  conditionJson?: Record<string, unknown> | null;
}

export interface WorkflowBuilderProps {
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  steps: WorkflowStep[];
  onStepsChange: (
    steps: Array<{
      actionType: string;
      config: Record<string, unknown>;
      delayMinutes: number;
      conditionJson?: Record<string, unknown> | null;
    }>
  ) => void;
  onNodeSelect: (nodeId: string | null) => void;
  readOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Internal node data shapes
// ---------------------------------------------------------------------------

interface TriggerNodeData {
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

interface ActionNodeData {
  stepIndex: number;
  actionType: string;
  config: Record<string, unknown>;
  delayMinutes: number;
  hasCondition: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDelete: (stepIndex: number) => void;
  readOnly: boolean;
}

interface ConditionNodeData {
  stepIndex: number;
  conditionJson: Record<string, unknown>;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDelete: (stepIndex: number) => void;
  readOnly: boolean;
}

interface WaitNodeData {
  stepIndex: number;
  delayMinutes: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
  readOnly: boolean;
}

interface AddButtonEdgeData {
  stepIndex: number;
  onAddAfter: (stepIndex: number) => void;
  readOnly: boolean;
}

// ---------------------------------------------------------------------------
// Constants & maps
// ---------------------------------------------------------------------------

const VERTICAL_GAP = 200;
const NODE_WIDTH = 280;
const CANVAS_CENTER_X = 400;
const START_Y = 60;

const ACTION_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  SEND_EMAIL: Mail,
  SEND_SMS: MessageSquare,
  CREATE_TASK: ClipboardList,
  NOTIFY_AGENT: Bell,
  WEBHOOK: Globe,
  ASSIGN_TO: UserPlus,
  MOVE_STAGE: GitBranch,
  ADD_TAG: Tag,
  REMOVE_TAG: Tag,
  WAIT: Clock,
  UPDATE_FIELD: Settings,
};

const ACTION_LABEL_MAP: Record<string, string> = {
  SEND_EMAIL: 'Send Email',
  SEND_SMS: 'Send SMS',
  CREATE_TASK: 'Create Task',
  UPDATE_FIELD: 'Update Field',
  NOTIFY_AGENT: 'Notify Agent',
  WEBHOOK: 'Call Webhook',
  ASSIGN_TO: 'Assign To',
  MOVE_STAGE: 'Move Stage',
  ADD_TAG: 'Add Tag',
  REMOVE_TAG: 'Remove Tag',
  WAIT: 'Wait',
};

const TRIGGER_LABEL_MAP: Record<string, string> = {
  DEAL_STAGE_CHANGE: 'Deal Stage Change',
  LEAD_STATUS_CHANGE: 'Lead Status Change',
  LEAD_SCORE_THRESHOLD: 'Lead Score Threshold',
  NEW_LEAD: 'New Lead',
  NEW_DEAL: 'New Deal',
  TIME_BASED: 'Time Based',
  MANUAL: 'Manual Trigger',
  FORM_SUBMISSION: 'Form Submission',
};

interface PaletteItem {
  actionType: string;
  label: string;
  bgClass: string;
  textClass: string;
}

const PALETTE_ITEMS: PaletteItem[] = [
  { actionType: 'SEND_EMAIL',   label: 'Send Email',   bgClass: 'bg-blue-50 border-blue-200',   textClass: 'text-blue-700' },
  { actionType: 'SEND_SMS',     label: 'Send SMS',     bgClass: 'bg-blue-50 border-blue-200',   textClass: 'text-blue-700' },
  { actionType: 'CREATE_TASK',  label: 'Create Task',  bgClass: 'bg-blue-50 border-blue-200',   textClass: 'text-blue-700' },
  { actionType: 'NOTIFY_AGENT', label: 'Notify Agent', bgClass: 'bg-blue-50 border-blue-200',   textClass: 'text-blue-700' },
  { actionType: 'WEBHOOK',      label: 'Webhook',      bgClass: 'bg-blue-50 border-blue-200',   textClass: 'text-blue-700' },
  { actionType: 'ASSIGN_TO',    label: 'Assign To',    bgClass: 'bg-blue-50 border-blue-200',   textClass: 'text-blue-700' },
  { actionType: 'MOVE_STAGE',   label: 'Move Stage',   bgClass: 'bg-blue-50 border-blue-200',   textClass: 'text-blue-700' },
  { actionType: 'ADD_TAG',      label: 'Add Tag',      bgClass: 'bg-blue-50 border-blue-200',   textClass: 'text-blue-700' },
  { actionType: 'REMOVE_TAG',   label: 'Remove Tag',   bgClass: 'bg-blue-50 border-blue-200',   textClass: 'text-blue-700' },
  { actionType: 'UPDATE_FIELD', label: 'Update Field', bgClass: 'bg-blue-50 border-blue-200',   textClass: 'text-blue-700' },
  { actionType: 'WAIT',         label: 'Wait / Delay', bgClass: 'bg-gray-50 border-gray-200',   textClass: 'text-gray-600' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function configPreview(actionType: string, config: Record<string, unknown>): string {
  switch (actionType) {
    case 'SEND_EMAIL':   return config.subject    ? `Subject: ${config.subject}`                     : 'No subject set';
    case 'SEND_SMS':     return config.message    ? String(config.message).slice(0, 40)               : 'No message set';
    case 'CREATE_TASK':  return config.taskTitle  ? String(config.taskTitle)                          : 'No title set';
    case 'NOTIFY_AGENT': return config.message    ? String(config.message).slice(0, 40)               : 'No message';
    case 'WEBHOOK':      return config.url        ? String(config.url).slice(0, 40)                   : 'No URL set';
    case 'ASSIGN_TO':    return config.assigneeId ? `To: ${config.assigneeId}`                        : 'Assignee not set';
    case 'MOVE_STAGE':   return config.stageId    ? `Stage: ${config.stageId}`                        : 'Stage not set';
    case 'ADD_TAG':
    case 'REMOVE_TAG':   return config.tag        ? `Tag: ${config.tag}`                              : 'Tag not set';
    case 'UPDATE_FIELD': return config.fieldName  ? `${config.fieldName} = ${config.fieldValue ?? '?'}` : 'Field not set';
    case 'WAIT':         return config.waitMinutes ? `${config.waitMinutes} minutes`                  : 'Duration not set';
    default:             return '';
  }
}

function conditionPreview(cond: Record<string, unknown>): string {
  if (cond.field && cond.operator) {
    return `${cond.field} ${cond.operator} ${cond.value ?? ''}`;
  }
  const keys = Object.keys(cond);
  return keys.length > 0 ? `${keys[0]}: ${String(cond[keys[0]])}` : 'Condition set';
}

function formatDelay(minutes: number): string {
  if (minutes === 0) return 'Immediately';
  if (minutes < 60) return `After ${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `After ${h}h ${m}m` : `After ${h}h`;
}

// ---------------------------------------------------------------------------
// Custom node: TriggerNode
// ---------------------------------------------------------------------------

function TriggerNode({ id, data }: NodeProps<TriggerNodeData>) {
  return (
    <div
      onClick={() => data.onSelect(id)}
      className={[
        'relative cursor-pointer select-none w-[280px] rounded-xl border-2 p-0 overflow-hidden',
        'shadow-lg transition-all duration-150',
        data.isSelected
          ? 'border-purple-500 shadow-purple-200 shadow-xl ring-2 ring-purple-300 ring-offset-1'
          : 'border-purple-300 hover:border-purple-400 hover:shadow-purple-100',
      ].join(' ')}
    >
      {/* Purple header */}
      <div className="bg-purple-600 px-4 py-2.5 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-purple-100 uppercase tracking-wider">Trigger</p>
          <p className="text-sm font-bold text-white truncate leading-tight">
            {TRIGGER_LABEL_MAP[data.triggerType] ?? data.triggerType}
          </p>
        </div>
      </div>

      {/* Config preview */}
      <div className="bg-white px-4 py-2.5">
        {Object.keys(data.triggerConfig).length > 0 ? (
          <div className="space-y-0.5">
            {Object.entries(data.triggerConfig)
              .slice(0, 2)
              .map(([k, v]) => (
                <p key={k} className="text-xs text-gray-500 truncate">
                  <span className="font-medium text-gray-700">{k}:</span> {String(v)}
                </p>
              ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">No trigger config</p>
        )}
      </div>

      {/* Source handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#9333ea', width: 10, height: 10, border: '2px solid white' }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom node: ActionNode
// ---------------------------------------------------------------------------

function ActionNode({ id, data }: NodeProps<ActionNodeData>) {
  const Icon = ACTION_ICON_MAP[data.actionType] ?? Settings;
  const preview = configPreview(data.actionType, data.config);

  return (
    <div
      onClick={() => data.onSelect(id)}
      className={[
        'relative cursor-pointer select-none w-[280px] rounded-xl border-2 p-0 overflow-hidden',
        'shadow-md transition-all duration-150',
        data.isSelected
          ? 'border-blue-500 shadow-blue-200 shadow-xl ring-2 ring-blue-300 ring-offset-1'
          : 'border-blue-200 hover:border-blue-400 hover:shadow-blue-100',
      ].join(' ')}
    >
      {/* Target handle */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#3b82f6', width: 10, height: 10, border: '2px solid white' }}
      />

      {/* Blue header */}
      <div className="bg-blue-500 px-4 py-2.5 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-blue-100 uppercase tracking-wider">
            Step {data.stepIndex + 1}
          </p>
          <p className="text-sm font-bold text-white truncate leading-tight">
            {ACTION_LABEL_MAP[data.actionType] ?? data.actionType}
          </p>
        </div>
        {!data.readOnly && (
          <button
            onClick={e => { e.stopPropagation(); data.onDelete(data.stepIndex); }}
            className="flex-shrink-0 w-6 h-6 rounded-md bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
            title="Delete step"
          >
            <Trash2 className="h-3.5 w-3.5 text-white" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="bg-white px-4 py-2.5 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-gray-400 flex-shrink-0" />
          <span className="text-xs text-gray-500">{formatDelay(data.delayMinutes)}</span>
        </div>
        {preview && <p className="text-xs text-gray-600 truncate">{preview}</p>}
        {data.hasCondition && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-xs text-orange-600">
            <GitBranch className="h-3 w-3" />
            Conditional
          </span>
        )}
      </div>

      {/* Source handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#3b82f6', width: 10, height: 10, border: '2px solid white' }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom node: ConditionNode
// ---------------------------------------------------------------------------

function ConditionNode({ id, data }: NodeProps<ConditionNodeData>) {
  const preview = conditionPreview(data.conditionJson);

  return (
    <div
      onClick={() => data.onSelect(id)}
      className={[
        'relative cursor-pointer select-none w-[280px] rounded-xl border-2 p-0 overflow-hidden',
        'shadow-md transition-all duration-150',
        data.isSelected
          ? 'border-orange-500 shadow-orange-200 shadow-xl ring-2 ring-orange-300 ring-offset-1'
          : 'border-orange-300 hover:border-orange-400 hover:shadow-orange-100',
      ].join(' ')}
    >
      {/* Target handle */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#f97316', width: 10, height: 10, border: '2px solid white' }}
      />

      {/* Orange header */}
      <div className="bg-orange-500 px-4 py-2.5 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
          <GitBranch className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-orange-100 uppercase tracking-wider">Condition</p>
          <p className="text-sm font-bold text-white truncate leading-tight">If / When</p>
        </div>
        {!data.readOnly && (
          <button
            onClick={e => { e.stopPropagation(); data.onDelete(data.stepIndex); }}
            className="flex-shrink-0 w-6 h-6 rounded-md bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
            title="Remove condition"
          >
            <Trash2 className="h-3.5 w-3.5 text-white" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="bg-white px-4 py-2.5">
        <p className="text-xs text-gray-600 truncate">{preview}</p>
      </div>

      {/* Source handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#f97316', width: 10, height: 10, border: '2px solid white' }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom node: WaitNode
// ---------------------------------------------------------------------------

function WaitNode({ id, data }: NodeProps<WaitNodeData>) {
  return (
    <div
      onClick={() => data.onSelect(id)}
      className={[
        'relative cursor-pointer select-none w-[280px] rounded-xl border-2 p-0 overflow-hidden',
        'shadow-md transition-all duration-150',
        data.isSelected
          ? 'border-gray-500 shadow-gray-200 shadow-xl ring-2 ring-gray-300 ring-offset-1'
          : 'border-gray-300 hover:border-gray-400 hover:shadow-gray-100',
      ].join(' ')}
    >
      {/* Target handle */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#6b7280', width: 10, height: 10, border: '2px solid white' }}
      />

      {/* Gray header */}
      <div className="bg-gray-500 px-4 py-2.5 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
          <Clock className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-gray-100 uppercase tracking-wider">Wait</p>
          <p className="text-sm font-bold text-white truncate leading-tight">Delay</p>
        </div>
      </div>

      {/* Body */}
      <div className="bg-white px-4 py-2.5">
        <p className="text-xs text-gray-600">{formatDelay(data.delayMinutes)}</p>
      </div>

      {/* Source handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#6b7280', width: 10, height: 10, border: '2px solid white' }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom edge: AnimatedPurpleEdge with + insert button
// ---------------------------------------------------------------------------

function AddButtonEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<AddButtonEdgeData>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ stroke: '#9333ea', strokeWidth: 2 }}
      />
      {data && !data.readOnly && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <button
              onClick={() => data.onAddAfter(data.stepIndex)}
              className={[
                'w-6 h-6 rounded-full flex items-center justify-center',
                'bg-purple-600 hover:bg-purple-700 text-white',
                'shadow-md shadow-purple-200 border-2 border-white',
                'transition-all duration-150 hover:scale-110',
              ].join(' ')}
              title="Insert step here"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// nodeTypes & edgeTypes — defined OUTSIDE the component (ReactFlow requirement)
// ---------------------------------------------------------------------------

const nodeTypes = {
  trigger:   TriggerNode,
  action:    ActionNode,
  condition: ConditionNode,
  wait:      WaitNode,
} as const;

const edgeTypes = {
  addButton: AddButtonEdge,
} as const;

// ---------------------------------------------------------------------------
// Builder: convert steps → ReactFlow nodes + edges
// ---------------------------------------------------------------------------

function buildGraph(
  triggerType: string,
  triggerConfig: Record<string, unknown>,
  steps: WorkflowStep[],
  selectedId: string | null,
  onSelect: (id: string) => void,
  onDelete: (idx: number) => void,
  onAddAfter: (idx: number) => void,
  readOnly: boolean
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const left = CANVAS_CENTER_X - NODE_WIDTH / 2;

  // Trigger node
  nodes.push({
    id: 'trigger',
    type: 'trigger',
    position: { x: left, y: START_Y },
    draggable: false,
    data: {
      triggerType,
      triggerConfig,
      isSelected: selectedId === 'trigger',
      onSelect,
    } satisfies TriggerNodeData,
  });

  let prevId = 'trigger';
  let y = START_Y + VERTICAL_GAP;

  steps.forEach((step, i) => {
    const hasCondition =
      step.conditionJson != null &&
      typeof step.conditionJson === 'object' &&
      Object.keys(step.conditionJson).length > 0;

    // Condition sub-node (sits above the action)
    if (hasCondition && step.conditionJson) {
      const condId = `cond-${i}`;
      nodes.push({
        id: condId,
        type: 'condition',
        position: { x: left, y },
        draggable: false,
        data: {
          stepIndex: i,
          conditionJson: step.conditionJson,
          isSelected: selectedId === condId,
          onSelect,
          onDelete,
          readOnly,
        } satisfies ConditionNodeData,
      });
      // Edge: prev → condition (with + button)
      edges.push({
        id: `e-${prevId}-${condId}`,
        source: prevId,
        target: condId,
        type: 'addButton',
        data: { stepIndex: i - 1, onAddAfter, readOnly } satisfies AddButtonEdgeData,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#9333ea' },
        style: { stroke: '#9333ea', strokeWidth: 2 },
        animated: true,
      });
      prevId = condId;
      y += VERTICAL_GAP;
    }

    const stepId = `step-${i}`;

    // WAIT node vs Action node
    if (step.actionType === 'WAIT') {
      nodes.push({
        id: stepId,
        type: 'wait',
        position: { x: left, y },
        draggable: false,
        data: {
          stepIndex: i,
          delayMinutes: step.delayMinutes,
          isSelected: selectedId === stepId,
          onSelect,
          readOnly,
        } satisfies WaitNodeData,
      });
    } else {
      nodes.push({
        id: stepId,
        type: 'action',
        position: { x: left, y },
        draggable: false,
        data: {
          stepIndex: i,
          actionType: step.actionType,
          config: step.config,
          delayMinutes: step.delayMinutes,
          hasCondition,
          isSelected: selectedId === stepId,
          onSelect,
          onDelete,
          readOnly,
        } satisfies ActionNodeData,
      });
    }

    // Edge: prev → step
    // Add the + button only when there is no condition node already carrying it
    const showAddBtn = !hasCondition;
    edges.push({
      id: `e-${prevId}-${stepId}`,
      source: prevId,
      target: stepId,
      type: showAddBtn ? 'addButton' : 'default',
      data: showAddBtn
        ? ({ stepIndex: i - 1, onAddAfter, readOnly } satisfies AddButtonEdgeData)
        : undefined,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#9333ea' },
      style: { stroke: '#9333ea', strokeWidth: 2 },
      animated: true,
    });

    prevId = stepId;
    y += VERTICAL_GAP;
  });

  // Trailing ghost node + dashed edge so the last + button renders
  if (!readOnly) {
    const ghostId = '__ghost__';
    nodes.push({
      id: ghostId,
      type: 'default',
      position: { x: left + NODE_WIDTH / 2 - 1, y },
      draggable: false,
      selectable: false,
      style: { opacity: 0, width: 2, height: 2, padding: 0, minWidth: 0 },
      data: {},
    });
    edges.push({
      id: `e-${prevId}-${ghostId}`,
      source: prevId,
      target: ghostId,
      type: 'addButton',
      data: {
        stepIndex: steps.length - 1,
        onAddAfter,
        readOnly,
      } satisfies AddButtonEdgeData,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#9333ea' },
      style: { stroke: '#9333ea', strokeWidth: 2, opacity: 0.35, strokeDasharray: '5 5' },
      animated: false,
    });
  }

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Palette sidebar
// ---------------------------------------------------------------------------

function PaletteSidebar({ onAppend }: { onAppend: (actionType: string) => void }) {
  const handleDragStart = (e: React.DragEvent, actionType: string) => {
    e.dataTransfer.setData('application/workflow-action', actionType);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="w-52 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</p>
        <p className="text-xs text-gray-400 mt-0.5">Drag onto canvas or click</p>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
        {PALETTE_ITEMS.map(item => {
          const Icon = ACTION_ICON_MAP[item.actionType] ?? Settings;
          return (
            <div
              key={item.actionType}
              draggable
              onDragStart={e => handleDragStart(e, item.actionType)}
              onClick={() => onAppend(item.actionType)}
              className={[
                'flex items-center gap-2.5 px-3 py-2 rounded-lg border',
                'cursor-grab active:cursor-grabbing select-none',
                'hover:shadow-sm transition-all duration-100',
                item.bgClass,
              ].join(' ')}
            >
              <Icon className={`h-4 w-4 flex-shrink-0 ${item.textClass}`} />
              <span className={`text-xs font-medium ${item.textClass}`}>{item.label}</span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="px-3 py-3 border-t border-gray-100 space-y-1.5">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Node types</p>
        {[
          { color: 'bg-purple-500', label: 'Trigger' },
          { color: 'bg-blue-500',   label: 'Action' },
          { color: 'bg-orange-400', label: 'Condition' },
          { color: 'bg-gray-400',   label: 'Wait' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${l.color} flex-shrink-0`} />
            <span className="text-xs text-gray-500">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WorkflowBuilder — main component
// ---------------------------------------------------------------------------

export default function WorkflowBuilder({
  triggerType,
  triggerConfig,
  steps,
  onStepsChange,
  onNodeSelect,
  readOnly = false,
}: WorkflowBuilderProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ── callbacks ────────────────────────────────────────────────────────────

  const handleNodeSelect = useCallback(
    (id: string) => {
      setSelectedId(prev => {
        const next = prev === id ? null : id;
        onNodeSelect(next);
        return next;
      });
    },
    [onNodeSelect]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedId(null);
    onNodeSelect(null);
  }, [onNodeSelect]);

  /** Insert a blank step at position stepIndex+1 */
  const handleAddAfter = useCallback(
    (stepIndex: number) => {
      const blank: WorkflowStep = {
        actionType: 'SEND_EMAIL',
        config: {},
        delayMinutes: 0,
        conditionJson: null,
      };
      const next = [...steps];
      next.splice(stepIndex + 1, 0, blank);
      onStepsChange(next);
    },
    [steps, onStepsChange]
  );

  /** Delete step at index */
  const handleDelete = useCallback(
    (idx: number) => {
      onStepsChange(steps.filter((_, i) => i !== idx));
      setSelectedId(null);
      onNodeSelect(null);
    },
    [steps, onStepsChange, onNodeSelect]
  );

  /** Append a new step at the end (from palette) */
  const handleAppend = useCallback(
    (actionType: string) => {
      const blank: WorkflowStep = {
        actionType,
        config: {},
        delayMinutes: 0,
        conditionJson: null,
      };
      onStepsChange([...steps, blank]);
    },
    [steps, onStepsChange]
  );

  // ── build graph ──────────────────────────────────────────────────────────

  const { nodes: builtNodes, edges: builtEdges } = buildGraph(
    triggerType,
    triggerConfig,
    steps,
    selectedId,
    handleNodeSelect,
    handleDelete,
    handleAddAfter,
    readOnly
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(builtNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(builtEdges);

  // Re-sync whenever inputs change
  useEffect(() => {
    const { nodes: n, edges: e } = buildGraph(
      triggerType,
      triggerConfig,
      steps,
      selectedId,
      handleNodeSelect,
      handleDelete,
      handleAddAfter,
      readOnly
    );
    setNodes(n);
    setEdges(e);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerType, triggerConfig, steps, selectedId, readOnly]);

  const onConnect = useCallback(
    (params: Connection) => {
      if (!readOnly) setEdges(eds => addEdge(params, eds));
    },
    [readOnly, setEdges]
  );

  // ── drag-drop from palette onto canvas ───────────────────────────────────

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (readOnly) return;
      const actionType = e.dataTransfer.getData('application/workflow-action');
      if (actionType) handleAppend(actionType);
    },
    [readOnly, handleAppend]
  );

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
      {/* Left palette — hidden when readOnly */}
      {!readOnly && <PaletteSidebar onAppend={handleAppend} />}

      {/* Canvas */}
      <div
        className="relative flex-1"
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onPaneClick={handlePaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.3, maxZoom: 1.1 }}
          minZoom={0.25}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          style={{ background: '#fafafa' }}
        >
          <Background color="#e2e8f0" gap={20} size={1} />

          <Controls
            showInteractive={false}
            style={{ bottom: 16, left: 16, top: 'auto' }}
          />

          <MiniMap
            nodeColor={node => {
              const t = node.type;
              if (t === 'trigger')   return '#9333ea';
              if (t === 'action')    return '#3b82f6';
              if (t === 'condition') return '#f97316';
              if (t === 'wait')      return '#6b7280';
              return '#e5e7eb';
            }}
            style={{
              bottom: 16,
              right: 16,
              top: 'auto',
              width: 140,
              height: 90,
              border: '1px solid #e5e7eb',
              borderRadius: 8,
            }}
          />
        </ReactFlow>

        {/* Empty-state hint (only when no steps yet) */}
        {steps.length === 0 && !readOnly && (
          <div
            className="absolute inset-x-0 flex justify-center pointer-events-none"
            style={{ top: '52%' }}
          >
            <div className="bg-white/90 backdrop-blur-sm rounded-xl border border-dashed border-purple-200 px-6 py-3 text-center shadow-sm">
              <p className="text-sm font-medium text-gray-500">
                Drag an action from the left panel
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                or click any action to append it
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export helper: serialise steps for API save
// ---------------------------------------------------------------------------

/**
 * Converts the live steps array to a clean serialisable form ready to POST/PATCH.
 */
export function exportSteps(
  steps: WorkflowStep[]
): Array<{
  actionType: string;
  config: Record<string, unknown>;
  delayMinutes: number;
  conditionJson: Record<string, unknown> | null;
}> {
  return steps.map(({ actionType, config, delayMinutes, conditionJson }) => ({
    actionType,
    config,
    delayMinutes,
    conditionJson: conditionJson ?? null,
  }));
}

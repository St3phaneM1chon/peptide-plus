'use client';

import { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  ArrowLeft, Save, Play, Pause,
  Mail, Clock, GitMerge, Zap, MessageSquare,
} from 'lucide-react';
import TriggerNode from './nodes/TriggerNode';
import EmailNode from './nodes/EmailNode';
import DelayNode from './nodes/DelayNode';
import ConditionNode from './nodes/ConditionNode';
import SMSNode from './nodes/SMSNode';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

const nodeTypes = {
  trigger: TriggerNode,
  email: EmailNode,
  delay: DelayNode,
  condition: ConditionNode,
  sms: SMSNode,
};

interface FlowEditorProps {
  flowId?: string;
  onBack: () => void;
}

export default function FlowEditor({ flowId, onBack }: FlowEditorProps) {
  const { t, locale: _locale } = useI18n();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [flowName, setFlowName] = useState(t('admin.emails.flows.newWorkflow'));
  const [flowDescription, setFlowDescription] = useState('');
  const [flowTrigger, setFlowTrigger] = useState('order.created');
  const [isActive, setIsActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const NODE_TEMPLATES = [
    { type: 'trigger', label: t('admin.emails.flows.nodeTrigger'), icon: Zap, color: 'bg-purple-100 text-purple-700' },
    { type: 'email', label: t('admin.emails.flows.nodeEmail'), icon: Mail, color: 'bg-sky-100 text-sky-700' },
    { type: 'delay', label: t('admin.emails.flows.nodeDelay'), icon: Clock, color: 'bg-amber-100 text-amber-700' },
    { type: 'condition', label: t('admin.emails.flows.nodeCondition'), icon: GitMerge, color: 'bg-orange-100 text-orange-700' },
    { type: 'sms', label: t('admin.emails.flows.nodeSms'), icon: MessageSquare, color: 'bg-green-100 text-green-700' },
  ];

  useEffect(() => {
    if (flowId) {
      fetchFlow();
    }
  }, [flowId]);

  const fetchFlow = async () => {
    try {
      const res = await fetch(`/api/admin/emails/flows/${flowId}`);
      if (res.ok) {
        const data = await res.json();
        const flow = data.flow;
        setFlowName(flow.name);
        setFlowDescription(flow.description || '');
        setFlowTrigger(flow.trigger);
        setIsActive(flow.isActive);
        setNodes(flow.nodes || []);
        setEdges(flow.edges || []);
      }
    } catch (error) {
      console.error(error);
      toast.error(t('common.errorOccurred'));
    }
  };

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#94a3b8' } }, eds)),
    [setEdges]
  );

  const addNode = (type: string) => {
    const id = `${type}-${Date.now()}`;
    const newNode: Node = {
      id,
      type,
      position: { x: 250, y: (nodes.length + 1) * 120 },
      data: {
        label: type === 'trigger' ? t('admin.emails.flows.nodeTrigger') :
               type === 'email' ? t('admin.emails.flows.newEmail') :
               type === 'delay' ? t('admin.emails.flows.wait') :
               type === 'condition' ? t('admin.emails.flows.nodeCondition') :
               type === 'sms' ? 'SMS' : type,
        ...(type === 'delay' ? { delayAmount: 1, delayUnit: 'days' } : {}),
        ...(type === 'email' ? { subject: '', htmlContent: '' } : {}),
        ...(type === 'condition' ? { conditionField: '', conditionOperator: 'equals', conditionValue: '' } : {}),
        ...(type === 'trigger' ? { triggerEvent: flowTrigger } : {}),
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const saveFlow = async () => {
    setSaving(true);
    try {
      const body = {
        name: flowName,
        description: flowDescription,
        trigger: flowTrigger,
        nodes,
        edges,
        isActive,
      };

      const url = flowId ? `/api/admin/emails/flows/${flowId}` : '/api/admin/emails/flows';
      const method = flowId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        onBack();
      }
    } catch (error) {
      console.error(error);
      toast.error(t('common.errorOccurred'));
    } finally {
      setSaving(false);
    }
  };

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const updateNodeData = (nodeId: string, data: Record<string, unknown>) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n))
    );
    if (selectedNode?.id === nodeId) {
      setSelectedNode((prev) => prev ? { ...prev, data: { ...prev.data, ...data } } : null);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 p-3 border-b border-slate-200 bg-slate-50">
        <button onClick={onBack} className="p-1.5 hover:bg-slate-200 rounded">
          <ArrowLeft className="h-4 w-4 text-slate-500" />
        </button>

        <input
          type="text"
          value={flowName}
          onChange={(e) => setFlowName(e.target.value)}
          className="text-sm font-semibold text-slate-900 bg-transparent border-0 focus:outline-none focus:ring-0 flex-1"
          placeholder={t('admin.emails.flows.workflowNamePlaceholder')}
        />

        <select
          value={flowTrigger}
          onChange={(e) => setFlowTrigger(e.target.value)}
          className="text-xs px-2 py-1.5 border border-slate-200 rounded-lg"
        >
          <option value="order.created">{t('admin.emails.flows.triggerOrderCreated')}</option>
          <option value="order.shipped">{t('admin.emails.flows.triggerOrderShipped')}</option>
          <option value="order.delivered">{t('admin.emails.flows.triggerOrderDelivered')}</option>
          <option value="cart.abandoned">{t('admin.emails.flows.triggerCartAbandoned')}</option>
          <option value="user.registered">{t('admin.emails.flows.triggerUserRegistered')}</option>
          <option value="user.birthday">{t('admin.emails.flows.triggerBirthday')}</option>
          <option value="winback.eligible">{t('admin.emails.flows.triggerWinback')}</option>
          <option value="reorder.due">{t('admin.emails.flows.triggerReorder')}</option>
          <option value="review.received">{t('admin.emails.flows.triggerReviewReceived')}</option>
          <option value="stock.low">{t('admin.emails.flows.triggerStockLow')}</option>
          <option value="stock.back">{t('admin.emails.flows.triggerStockBack')}</option>
        </select>

        <button
          onClick={() => setIsActive(!isActive)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
            isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {isActive ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          {isActive ? t('admin.emails.flows.active') : t('admin.emails.flows.inactive')}
        </button>

        <button
          onClick={saveFlow}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-sky-500 hover:bg-sky-600 rounded-lg disabled:opacity-50"
        >
          <Save className="h-3 w-3" />
          {saving ? t('admin.emails.flows.saving') : t('admin.emails.flows.save')}
        </button>
      </div>

      <div className="flex flex-1">
        {/* Node palette */}
        <div className="w-48 border-r border-slate-200 p-3 bg-slate-50 space-y-2">
          <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">{t('admin.emails.flows.nodes')}</h4>
          {NODE_TEMPLATES.map((tmpl) => {
            const Icon = tmpl.icon;
            return (
              <button
                key={tmpl.type}
                onClick={() => addNode(tmpl.type)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${tmpl.color} hover:opacity-80 transition-opacity`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tmpl.label}
              </button>
            );
          })}
        </div>

        {/* React Flow canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            className="bg-slate-50"
          >
            <Background color="#e2e8f0" gap={16} />
            <Controls />
            <MiniMap nodeColor="#94a3b8" />
          </ReactFlow>
        </div>

        {/* Node inspector */}
        {selectedNode && (
          <div className="w-72 border-l border-slate-200 p-4 bg-white overflow-y-auto">
            <h4 className="text-sm font-semibold text-slate-900 mb-3">
              {t('admin.emails.flows.properties')}: {selectedNode.data.label}
            </h4>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500">{t('admin.emails.flows.label')}</label>
                <input
                  type="text"
                  value={selectedNode.data.label || ''}
                  onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
                  className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded"
                />
              </div>

              {selectedNode.type === 'email' && (
                <>
                  <div>
                    <label className="text-xs text-slate-500">{t('admin.emails.flows.emailSubject')}</label>
                    <input
                      type="text"
                      value={selectedNode.data.subject || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, { subject: e.target.value })}
                      className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">{t('admin.emails.flows.htmlContent')}</label>
                    <textarea
                      value={selectedNode.data.htmlContent || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, { htmlContent: e.target.value })}
                      className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded font-mono"
                      rows={6}
                    />
                  </div>
                </>
              )}

              {selectedNode.type === 'delay' && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-slate-500">{t('admin.emails.flows.duration')}</label>
                    <input
                      type="number"
                      value={selectedNode.data.delayAmount || 1}
                      onChange={(e) => updateNodeData(selectedNode.id, { delayAmount: parseInt(e.target.value) })}
                      className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded"
                      min={1}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-slate-500">{t('admin.emails.flows.unit')}</label>
                    <select
                      value={selectedNode.data.delayUnit || 'days'}
                      onChange={(e) => updateNodeData(selectedNode.id, { delayUnit: e.target.value })}
                      className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded"
                    >
                      <option value="minutes">{t('admin.emails.flows.unitMinutes')}</option>
                      <option value="hours">{t('admin.emails.flows.unitHours')}</option>
                      <option value="days">{t('admin.emails.flows.unitDays')}</option>
                      <option value="weeks">{t('admin.emails.flows.unitWeeks')}</option>
                    </select>
                  </div>
                </div>
              )}

              {selectedNode.type === 'condition' && (
                <>
                  <div>
                    <label className="text-xs text-slate-500">{t('admin.emails.flows.field')}</label>
                    <input
                      type="text"
                      value={selectedNode.data.conditionField || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, { conditionField: e.target.value })}
                      className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded"
                      placeholder="ex: hasOrdered, tier, totalSpent"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">{t('admin.emails.flows.operator')}</label>
                    <select
                      value={selectedNode.data.conditionOperator || 'equals'}
                      onChange={(e) => updateNodeData(selectedNode.id, { conditionOperator: e.target.value })}
                      className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded"
                    >
                      <option value="equals">{t('admin.emails.flows.opEquals')}</option>
                      <option value="not_equals">{t('admin.emails.flows.opNotEquals')}</option>
                      <option value="greater_than">{t('admin.emails.flows.opGreaterThan')}</option>
                      <option value="less_than">{t('admin.emails.flows.opLessThan')}</option>
                      <option value="contains">{t('admin.emails.flows.opContains')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">{t('admin.emails.flows.value')}</label>
                    <input
                      type="text"
                      value={selectedNode.data.conditionValue || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, { conditionValue: e.target.value })}
                      className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded"
                    />
                  </div>
                </>
              )}

              {selectedNode.type === 'sms' && (
                <div>
                  <label className="text-xs text-slate-500">{t('admin.emails.flows.smsMessage')}</label>
                  <textarea
                    value={selectedNode.data.smsMessage || ''}
                    onChange={(e) => updateNodeData(selectedNode.id, { smsMessage: e.target.value })}
                    className="w-full mt-1 px-2 py-1.5 text-sm border border-slate-200 rounded"
                    rows={3}
                    maxLength={160}
                  />
                  <span className="text-[10px] text-slate-400">{(selectedNode.data.smsMessage || '').length}/160</span>
                </div>
              )}

              <button
                onClick={() => {
                  setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
                  setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
                  setSelectedNode(null);
                }}
                className="w-full mt-4 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg"
              >
                {t('admin.emails.flows.deleteNode')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

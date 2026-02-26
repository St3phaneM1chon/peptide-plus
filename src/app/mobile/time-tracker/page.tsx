'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, Square, Clock } from 'lucide-react';
import { addCSRFHeader } from '@/lib/csrf';

interface TimerData {
  running: { id: string; startTime: string; projectName: string | null; description: string } | null;
  todayEntries: Array<{ id: string; description: string; startTime: string; endTime: string | null; duration: number | null; projectName: string | null }>;
  todayTotal: number;
  weekTotal: number;
}

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

function fmtElapsed(startTime: string): string {
  const diff = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function MobileTimeTracker() {
  const [data, setData] = useState<TimerData | null>(null);
  const [elapsed, setElapsed] = useState('00:00:00');
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout>();

  const load = async () => {
    try {
      const res = await fetch('/api/mobile/time');
      if (res.ok) setData(await res.json());
    } catch { /* offline */ }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (data?.running) {
      intervalRef.current = setInterval(() => setElapsed(fmtElapsed(data.running!.startTime)), 1000);
      return () => clearInterval(intervalRef.current);
    } else {
      setElapsed('00:00:00');
    }
  }, [data?.running]);

  const toggleTimer = async () => {
    setLoading(true);
    try {
      await fetch('/api/mobile/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...addCSRFHeader() },
        body: JSON.stringify({ action: data?.running ? 'stop' : 'start' }),
      });
      await load();
    } catch { /* offline */ }
    setLoading(false);
  };

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-900">Chronomètre</h2>

      {/* Timer Display */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
        <p className="text-5xl font-mono font-bold text-gray-900 tracking-wider">{elapsed}</p>
        {data?.running?.projectName && <p className="text-sm text-purple-600 mt-2 font-medium">{data.running.projectName}</p>}
        <button onClick={toggleTimer} disabled={loading} className={`mt-6 w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-lg transition-all ${data?.running ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}>
          {data?.running ? <Square className="w-8 h-8 text-white fill-white" /> : <Play className="w-8 h-8 text-white fill-white ml-1" />}
        </button>
        <p className="text-xs text-gray-400 mt-3">{data?.running ? 'Appuyez pour arrêter' : 'Appuyez pour démarrer'}</p>
      </div>

      {/* Today / Week Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
          <Clock className="w-4 h-4 text-purple-500 mx-auto mb-1" />
          <p className="text-xs text-gray-500">Aujourd&apos;hui</p>
          <p className="text-lg font-bold text-gray-900">{fmtDuration(data?.todayTotal || 0)}</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
          <Clock className="w-4 h-4 text-indigo-500 mx-auto mb-1" />
          <p className="text-xs text-gray-500">Cette semaine</p>
          <p className="text-lg font-bold text-gray-900">{fmtDuration(data?.weekTotal || 0)}</p>
        </div>
      </div>

      {/* Today's Entries */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 px-4 pt-3 pb-2">Aujourd&apos;hui</h3>
        <div className="divide-y divide-gray-50">
          {(data?.todayEntries || []).map(e => (
            <div key={e.id} className="px-4 py-2.5 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-800">{e.description || e.projectName || 'Sans projet'}</p>
                <p className="text-xs text-gray-400">
                  {new Date(e.startTime).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
                  {e.endTime && ` - ${new Date(e.endTime).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}`}
                </p>
              </div>
              {e.duration != null && <span className="text-sm font-semibold text-gray-600">{fmtDuration(e.duration)}</span>}
            </div>
          ))}
          {(data?.todayEntries || []).length === 0 && <p className="px-4 py-4 text-sm text-gray-400 text-center">Aucune entrée aujourd&apos;hui</p>}
        </div>
      </div>
    </div>
  );
}

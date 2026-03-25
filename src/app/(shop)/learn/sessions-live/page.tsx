'use client';

import { useState, useEffect } from 'react';
import { Video, Calendar, ExternalLink, Users } from 'lucide-react';

export default function SessionsLivePage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/lms/live-sessions?upcoming=true')
      .then(r => r.json())
      .then(d => setSessions(d.data ?? []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Chargement...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
        <Video className="h-8 w-8 text-red-500" /> Sessions en direct
      </h1>
      <p className="text-muted-foreground mb-8">Webinaires et sessions live a venir.</p>

      {sessions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Aucune session planifiee pour le moment.</div>
      ) : (
        <div className="space-y-4">
          {sessions.map((s: any) => (
            <div key={s.id} className="rounded-xl border p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{s.title}</h2>
                  {s.description && <p className="text-sm text-muted-foreground mt-1">{s.description}</p>}
                  <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {new Date(s.startsAt).toLocaleString('fr-CA')}</span>
                    <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {s._count?.attendees ?? 0} inscrit(s)</span>
                    <span className="uppercase text-xs font-medium px-2 py-0.5 rounded-full bg-muted">{s.platform}</span>
                  </div>
                </div>
                {s.meetingUrl && (
                  <a href={s.meetingUrl} target="_blank" rel="noopener noreferrer"
                     className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
                    <ExternalLink className="h-4 w-4" /> Rejoindre
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

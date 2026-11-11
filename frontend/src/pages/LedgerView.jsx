import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const ICONS = {
  ORDER_CREATED: '🧾',
  ESCROW_LOCKED: '🔒',
  PROOF_SUBMITTED: '📤',
  AI_VERDICT: '🤖',
  ESCROW_RELEASED: '💸',
  ESCROW_REFUNDED: '↩️',
  NEEDS_REVIEW: '⚠️',
};

export default function LedgerView() {
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const load = () => api.ledger().then((d) => setEvents(d.events)).catch(() => {});
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, []);

  const filtered = events.filter((e) => !filter || e.milestoneId?.includes(filter.toUpperCase()));

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-white">Proof Ledger — Immutable Audit Trail</h2>
          <p className="text-sm text-slate-400">Every event is SHA-256 hashed and timestamped. Live-refreshed.</p>
        </div>
        <input
          className="input max-w-xs"
          placeholder="Filter by milestone id…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-slate-500 text-sm">No events yet.</p>
      ) : (
        <ol className="relative border-l border-white/10 pl-6 space-y-5">
          {filtered.map((e, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[33px] top-0 flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 ring-1 ring-white/10 text-lg">
                {ICONS[e.type] || '•'}
              </span>
              <div className="rounded-xl bg-slate-950/50 ring-1 ring-white/5 p-4">
                <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
                  <div>
                    <span className="font-mono text-xs text-slate-500">{e.milestoneId}</span>
                    <span className="ml-3 font-bold text-sm text-white">{e.type}</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">{new Date(e.timestamp).toLocaleString()}</span>
                </div>
                <pre className="text-[11px] text-slate-300 bg-black/40 p-2 rounded-md overflow-x-auto">
                  {JSON.stringify(e.details, null, 2)}
                </pre>
                <div className="text-[10px] text-slate-600 font-mono mt-2">hash: {e.eventHash?.slice(0, 32)}…</div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

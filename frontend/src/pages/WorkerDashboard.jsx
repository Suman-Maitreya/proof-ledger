import React, { useEffect, useState } from 'react';
import { api, statusColor } from '../lib/api.js';

export default function WorkerDashboard() {
  const [milestones, setMilestones] = useState([]);
  const [selected, setSelected] = useState(null);
  const [file, setFile] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function load() {
    const { milestones } = await api.list();
    setMilestones(milestones);
  }
  useEffect(() => { load(); }, []);

  const active = milestones.filter((m) => m.status === 'ESCROW_LOCKED' || m.status === 'NEEDS_REVIEW');

  async function submit(e) {
    e.preventDefault();
    if (!selected || !file) return;
    setLoading(true); setError(null); setVerdict(null);
    try {
      const res = await api.submitProof(selected.id, file);
      setVerdict(res.verdict);
      await load();
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  return (
    <div className="grid lg:grid-cols-5 gap-8">
      <section className="lg:col-span-2">
        <div className="card p-6">
          <h2 className="text-xl font-bold text-white mb-1">Submit Proof of Work</h2>
          <p className="text-sm text-slate-400 mb-6">Upload a photo/document. The AI oracle verifies against criteria and autonomously captures via PayPal.</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Active Milestone</label>
              <select
                className="input"
                value={selected?.id || ''}
                onChange={(e) => setSelected(active.find((m) => m.id === e.target.value) || null)}
                required
              >
                <option value="">— choose a locked milestone —</option>
                {active.map((m) => (
                  <option key={m.id} value={m.id}>{m.id} · {m.currency} {m.amount} · {m.title}</option>
                ))}
              </select>
            </div>

            {selected && (
              <div className="rounded-xl bg-slate-950/60 ring-1 ring-white/5 p-4 text-sm">
                <div className="text-xs uppercase text-slate-400 font-bold mb-2">Criteria</div>
                <ul className="list-disc list-inside space-y-1 text-slate-300">
                  {selected.specifications.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}

            <div>
              <label className="label">Proof file (image recommended)</label>
              <input className="input" type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
            </div>

            {error && <div className="text-rose-300 text-sm bg-rose-500/10 ring-1 ring-rose-500/30 rounded-lg p-3">{error}</div>}

            <button className="btn-primary w-full" disabled={loading || !selected || !file}>
              {loading ? '🔎 AI Verifying…' : '🤖 Submit & Auto-Verify'}
            </button>
          </form>
        </div>
      </section>

      <section className="lg:col-span-3">
        {verdict ? (
          <VerdictCard verdict={verdict} />
        ) : (
          <div className="card p-10 text-center text-slate-500">
            <div className="text-5xl mb-3">🔍</div>
            <p>Oracle output will appear here after you submit proof.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function VerdictCard({ verdict }) {
  const isPass = verdict.verdict === 'PASS';
  const isFail = verdict.verdict === 'FAIL';
  const color = isPass ? 'emerald' : isFail ? 'rose' : 'amber';
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-white">AI Oracle Verdict</h2>
        <span className={`pill bg-${color}-500/15 text-${color}-300 ring-1 ring-${color}-500/30`}>
          {verdict.verdict} · {verdict.confidence_score}%
        </span>
      </div>

      <div className="mb-4">
        <div className="text-xs text-slate-400 uppercase font-bold mb-2">Confidence</div>
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
          <div className={`h-full bg-${color}-500`} style={{ width: `${verdict.confidence_score}%` }} />
        </div>
      </div>

      <div className="mb-4">
        <div className="text-xs text-slate-400 uppercase font-bold mb-2">Criteria Checklist</div>
        <ul className="space-y-2">
          {verdict.criteria_checklist?.map((c, i) => (
            <li key={i} className="rounded-lg bg-slate-950/50 ring-1 ring-white/5 p-3">
              <div className="flex items-start gap-2">
                <span className={c.satisfied ? 'text-emerald-400' : 'text-rose-400'}>
                  {c.satisfied ? '✓' : '✗'}
                </span>
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-white">{c.criterion}</div>
                  <div className="text-xs text-slate-400 mt-1">{c.visual_evidence}</div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="text-xs text-slate-400 uppercase font-bold mb-2">Reasoning</div>
        <p className="text-sm text-slate-300 bg-slate-950/50 ring-1 ring-white/5 rounded-lg p-3">{verdict.summary_reasoning}</p>
      </div>

      {isPass && (
        <div className="mt-5 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/40 p-4 text-sm text-emerald-200">
          ✅ Payment captured autonomously via PayPal. Funds released to worker.
        </div>
      )}
      {isFail && (
        <div className="mt-5 rounded-xl bg-rose-500/10 ring-1 ring-rose-500/40 p-4 text-sm text-rose-200">
          ⛔ Authorization voided. 100% refunded to client — no dispute fees.
        </div>
      )}
      {!isPass && !isFail && (
        <div className="mt-5 rounded-xl bg-amber-500/10 ring-1 ring-amber-500/40 p-4 text-sm text-amber-200">
          ⚠ Flagged for human mutual review.
        </div>
      )}
    </div>
  );
}

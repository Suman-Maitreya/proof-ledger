import React, { useEffect, useState } from 'react';
import { api, statusColor } from '../lib/api.js';

const SAMPLE = {
  title: 'HVAC Capacitor Replacement & Pressure Calibration',
  description: 'Replace failed dual-run capacitor, verify stable pressure, clean work area.',
  amount: '250.00',
  specifications: [
    'Original malfunctioning capacitor removed',
    'New brand-name dual run capacitor securely wired',
    'Analog or digital manifold gauge showing stable pressure reading between 60–70 PSI',
    'Work area clean with no exposed cut copper',
  ],
};

export default function ClientDashboard() {
  const [form, setForm] = useState({
    title: SAMPLE.title,
    description: SAMPLE.description,
    amount: SAMPLE.amount,
    currency: 'USD',
    specifications: SAMPLE.specifications.join('\n'),
  });
  const [loading, setLoading] = useState(false);
  const [milestones, setMilestones] = useState([]);
  const [lastApproval, setLastApproval] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    try {
      const { milestones } = await api.list();
      setMilestones(milestones);
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const payload = {
        ...form,
        amount: Number(form.amount),
        specifications: form.specifications.split('\n').map((s) => s.trim()).filter(Boolean),
      };
      const res = await api.create(payload);
      setLastApproval({ url: res.approvalUrl, milestoneId: res.milestone.id });
      await load();
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  return (
    <div className="grid lg:grid-cols-5 gap-8">
      <section className="lg:col-span-2">
        <div className="card p-6">
          <h2 className="text-xl font-bold text-white mb-1">Create a Milestone</h2>
          <p className="text-sm text-slate-400 mb-6">Define deliverable criteria. Funds lock in PayPal via <code className="text-paypal-gold">intent=AUTHORIZE</code>.</p>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Title</label>
              <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input min-h-[70px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="label">Amount</label>
                <input className="input" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
              </div>
              <div>
                <label className="label">Currency</label>
                <input className="input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">Deliverable criteria (one per line)</label>
              <textarea className="input min-h-[120px] font-mono text-xs" value={form.specifications} onChange={(e) => setForm({ ...form, specifications: e.target.value })} />
            </div>
            {error && <div className="text-rose-300 text-sm bg-rose-500/10 ring-1 ring-rose-500/30 rounded-lg p-3">{error}</div>}
            <button className="btn-gold w-full" disabled={loading}>
              {loading ? 'Creating…' : '🔒 Lock Escrow with PayPal'}
            </button>
          </form>

          {lastApproval && (
            <div className="mt-6 p-4 rounded-xl bg-paypal-light/10 ring-1 ring-paypal-light/40">
              <div className="text-xs uppercase text-sky-300 font-bold mb-2">Milestone {lastApproval.milestoneId} · Awaiting Buyer Approval</div>
              <a href={lastApproval.url} target="_blank" rel="noreferrer" className="btn-primary w-full">
                Approve in PayPal Sandbox ↗
              </a>
              <p className="text-[11px] text-slate-400 mt-2">Sign in with a sandbox personal account, approve, you'll be redirected back here.</p>
            </div>
          )}
        </div>
      </section>

      <section className="lg:col-span-3">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold text-white">Milestones</h2>
            <button onClick={load} className="btn-ghost text-sm px-3 py-1.5">↻ Refresh</button>
          </div>
          {milestones.length === 0 ? (
            <p className="text-slate-500 text-sm">No milestones yet. Create one on the left.</p>
          ) : (
            <ul className="space-y-3">
              {milestones.map((m) => (
                <li key={m.id} className="rounded-xl bg-slate-950/50 ring-1 ring-white/5 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-slate-500">{m.id}</span>
                        <span className={`pill ${statusColor(m.status)}`}>{m.status}</span>
                      </div>
                      <div className="font-semibold text-white truncate">{m.title}</div>
                      <div className="text-xs text-slate-400 mt-1">
                        {m.currency} {m.amount} · {m.specifications?.length || 0} criteria
                      </div>
                      {m.aiVerdict && (
                        <div className="text-xs mt-2">
                          AI: <span className="font-bold">{m.aiVerdict.verdict}</span> · confidence {m.aiVerdict.confidence_score}%
                        </div>
                      )}
                    </div>
                    <div className="text-right text-[11px] text-slate-500 shrink-0">
                      {new Date(m.createdAt).toLocaleString()}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

const base = '/api/escrow';

async function req(path, opts = {}) {
  const res = await fetch(`${base}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export const api = {
  list: () => req('/milestones'),
  get: (id) => req(`/milestones/${id}`),
  create: (body) => req('/create', { method: 'POST', body: JSON.stringify(body) }),
  authorize: (id) => req(`/authorize/${id}`, { method: 'POST' }),
  submitProof: async (id, file) => {
    const fd = new FormData();
    fd.append('proof', file);
    const res = await fetch(`${base}/submit-proof/${id}`, { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  },
  manualRelease: (id) => req(`/manual-release/${id}`, { method: 'POST' }),
  manualVoid: (id) => req(`/manual-void/${id}`, { method: 'POST' }),
  ledger: () => req('/ledger'),
  health: () => fetch('/api/health').then((r) => r.json()),
};

export function statusColor(status) {
  return (
    {
      ORDER_CREATED: 'bg-slate-500/20 text-slate-300 ring-1 ring-slate-500/30',
      ESCROW_LOCKED: 'bg-paypal-light/20 text-sky-300 ring-1 ring-paypal-light/40',
      NEEDS_REVIEW: 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40',
      ESCROW_RELEASED: 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40',
      ESCROW_REFUNDED: 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40',
    }[status] || 'bg-slate-500/20 text-slate-300'
  );
}

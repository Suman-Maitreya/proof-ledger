import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function EscrowApproved({ cancelled = false }) {
  const [params] = useSearchParams();
  const milestoneId = params.get('milestone');
  const [status, setStatus] = useState(cancelled ? 'cancelled' : 'authorizing');
  const [milestone, setMilestone] = useState(null);
  const [error, setError] = useState(null);
  const firedRef = useRef(false); // guard against StrictMode double-invoke

  useEffect(() => {
    if (cancelled || !milestoneId) return;
    if (firedRef.current) return;
    firedRef.current = true;
    (async () => {
      try {
        const res = await api.authorize(milestoneId);
        setMilestone(res.milestone);
        setStatus('locked');
      } catch (e) {
        setError(e.message);
        setStatus('error');
      }
    })();
  }, [milestoneId, cancelled]);

  return (
    <div className="max-w-xl mx-auto card p-8 text-center">
      {cancelled ? (
        <>
          <div className="text-5xl mb-3">↩️</div>
          <h2 className="text-xl font-bold text-white">Escrow approval cancelled</h2>
          <p className="text-slate-400 mt-2">No funds were locked.</p>
        </>
      ) : status === 'authorizing' ? (
        <>
          <div className="text-5xl mb-3 animate-pulse">🔒</div>
          <h2 className="text-xl font-bold text-white">Authorizing on PayPal…</h2>
        </>
      ) : status === 'locked' ? (
        <>
          <div className="text-5xl mb-3">✅</div>
          <h2 className="text-xl font-bold text-white">Escrow locked</h2>
          <p className="text-slate-400 mt-2">
            <span className="font-mono">{milestone?.id}</span> · {milestone?.currency} {milestone?.amount} held
          </p>
          <p className="text-xs text-slate-500 mt-1">Authorization ID: <span className="font-mono">{milestone?.authorizationId}</span></p>
        </>
      ) : (
        <>
          <div className="text-5xl mb-3">⚠️</div>
          <h2 className="text-xl font-bold text-white">Authorization failed</h2>
          <p className="text-rose-300 mt-2 text-sm break-all">{error}</p>
        </>
      )}
      <div className="mt-6 flex gap-3 justify-center">
        <Link to="/client" className="btn-ghost">Client</Link>
        <Link to="/worker" className="btn-primary">Worker view →</Link>
      </div>
    </div>
  );
}

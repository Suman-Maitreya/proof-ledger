import React, { useEffect, useState } from 'react';
import { Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom';
import ClientDashboard from './pages/ClientDashboard.jsx';
import WorkerDashboard from './pages/WorkerDashboard.jsx';
import LedgerView from './pages/LedgerView.jsx';
import EscrowApproved from './pages/EscrowApproved.jsx';
import { api } from './lib/api.js';

function Nav() {
  const link = ({ isActive }) =>
    `px-4 py-2 rounded-xl text-sm font-semibold transition ${
      isActive ? 'bg-paypal-light/20 text-white ring-1 ring-paypal-light/40' : 'text-slate-400 hover:text-white hover:bg-white/5'
    }`;
  return (
    <nav className="flex items-center gap-2">
      <NavLink to="/client" className={link}>Client</NavLink>
      <NavLink to="/worker" className={link}>Worker</NavLink>
      <NavLink to="/ledger" className={link}>Proof Ledger</NavLink>
    </nav>
  );
}

export default function App() {
  const [health, setHealth] = useState(null);
  useEffect(() => { api.health().then(setHealth).catch(() => {}); }, []);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 backdrop-blur bg-ink/70 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">⚖️</div>
            <div>
              <div className="text-lg font-extrabold tracking-tight text-white">ProofLedger</div>
              <div className="text-[11px] uppercase tracking-widest text-slate-400">Autonomous AI Escrow · PayPal</div>
            </div>
          </div>
          <Nav />
          <div className="flex items-center gap-2 text-xs">
            {health && (
              <>
                <span className={`pill ${health.paypal ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30' : 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30'}`}>
                  {health.paypal ? '● PayPal Sandbox' : '● PayPal not configured'}
                </span>
                <span className={`pill ${health.aiMock ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30' : 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30'}`}>
                  {health.aiMock ? '◎ AI mock' : '◉ AI live'}
                </span>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <Routes>
          <Route path="/" element={<ClientDashboard />} />
          <Route path="/client" element={<ClientDashboard />} />
          <Route path="/worker" element={<WorkerDashboard />} />
          <Route path="/ledger" element={<LedgerView />} />
          <Route path="/escrow/approved" element={<EscrowApproved />} />
          <Route path="/escrow/cancelled" element={<EscrowApproved cancelled />} />
        </Routes>
      </main>

      <footer className="max-w-7xl mx-auto px-6 pb-10 text-center text-xs text-slate-500">
        ProofLedger · built for the PayPal AI Hackathon · {new Date().getFullYear()}
      </footer>
    </div>
  );
}

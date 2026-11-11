# ⚖️ ProofLedger

**Autonomous AI Escrow & Milestone Verification powered by PayPal.**

Built for the PayPal AI Hackathon — targets Grand Prize, Best Use of Agentic Commerce, Best Use of PayPal + AI, and Most Impactful.

---

## What it does

1. **Client** creates a milestone with deliverable criteria and clicks **Lock Escrow with PayPal** → funds locked via `intent=AUTHORIZE` (not captured).
2. **Worker** uploads proof of completion.
3. A **multimodal AI Verification Oracle** inspects the proof against every criterion.
4. If `verdict = PASS` (score ≥ 85) → backend autonomously calls `/v2/payments/authorizations/{id}/capture` — funds released to worker.
5. If `verdict = FAIL` → autonomous `/void` — 100% refunded to client, no dispute fees.
6. If `NEEDS_REVIEW` → flagged for human decision (manual release/void endpoints).
7. Every event (order, proof hash, AI verdict, capture ID) is SHA-256 hashed and timestamped into an immutable **Proof Ledger** for dispute defense.

---

## Stack

- **Backend**: Node.js 18+ · Express · `multer` for uploads · OpenAI (optional, for live AI)
- **Frontend**: React 18 · Vite · Tailwind CSS · React Router
- **PayPal**: REST API v2 — OAuth2, Orders (AUTHORIZE), Authorizations (capture / void)
- **Storage**: JSON ledger file (swap for Postgres/SQLite in prod)

---

## Setup

### 1. PayPal Sandbox
1. Go to <https://developer.paypal.com/dashboard/applications/sandbox>.
2. Create an app → copy `Client ID` and `Secret`.
3. Create two sandbox accounts:
   - **Business** (seller, receives captures)
   - **Personal** with preloaded balance (buyer, approves authorizations)

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# edit .env → paste PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET
# AI_MOCK_MODE=true gives you a deterministic PASS verdict for the demo
# or add OPENAI_API_KEY to use GPT-4o vision for real
npm run dev
```

Backend runs on <http://localhost:4000>.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on <http://localhost:5173> and proxies `/api` → 4000.

---

## Demo Flow (3-minute script)

1. **0:00–0:30** — Open `/client`, fill in the pre-populated HVAC capacitor milestone, click **Lock Escrow with PayPal**.
2. **0:30–1:15** — Click the approval link → sign in with sandbox *personal* account → approve. Redirect back → UI shows `ESCROW_LOCKED`.
3. **1:15–2:05** — Switch to `/worker`. Select the locked milestone, upload a proof image, submit. AI Oracle scans → verdict renders live with confidence score + criteria checklist.
4. **2:05–2:35** — PASS → autonomous capture. Open `/ledger` → see every event hashed and timestamped.
5. **2:35–3:00** — Close with impact statement.

---

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Service + config state |
| `POST` | `/api/escrow/create` | Create milestone + PayPal AUTHORIZE order |
| `POST` | `/api/escrow/authorize/:id` | Finalize hold after buyer approval |
| `POST` | `/api/escrow/submit-proof/:id` | Upload proof → AI verify → auto capture/void |
| `POST` | `/api/escrow/manual-release/:id` | Human override capture |
| `POST` | `/api/escrow/manual-void/:id` | Human override void |
| `GET` | `/api/escrow/milestones` | List all |
| `GET` | `/api/escrow/milestones/:id` | Milestone + events |
| `GET` | `/api/escrow/ledger` | Full audit trail |

---

## File structure

```
proofledger/
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── paypal.js        PayPal REST client (OAuth, Orders, Auth)
│       ├── ai-oracle.js     Multimodal verification (GPT-4o vision or mock)
│       ├── ledger.js        JSON-backed immutable ledger with SHA-256
│       └── routes/
│           └── escrow.js    Lifecycle endpoints
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── App.jsx
        ├── main.jsx
        ├── lib/api.js
        └── pages/
            ├── ClientDashboard.jsx
            ├── WorkerDashboard.jsx
            ├── LedgerView.jsx
            └── EscrowApproved.jsx
```

// Escrow lifecycle routes
import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';
import {
  createEscrowOrder,
  authorizeOrder,
  captureAuthorization,
  voidAuthorization,
  getOrder,
  approvalLink,
} from '../paypal.js';
import { verifyProof } from '../ai-oracle.js';
import {
  createMilestone,
  updateMilestone,
  getMilestone,
  listMilestones,
  recordEvent,
  eventsForMilestone,
  allEvents,
  sha256File,
} from '../ledger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.resolve(__dirname, '..', '..', 'data', 'uploads');

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}-${nanoid(6)}-${safe}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const router = express.Router();

router.get('/milestones', (_req, res) => {
  res.json({ milestones: listMilestones() });
});

router.get('/milestones/:id', (req, res) => {
  const ms = getMilestone(req.params.id);
  if (!ms) return res.status(404).json({ error: 'not found' });
  res.json({ milestone: ms, events: eventsForMilestone(req.params.id) });
});

router.post('/create', async (req, res) => {
  try {
    const { title, description, amount, currency = 'USD', specifications = [], clientEmail, workerEmail } = req.body;
    if (!title || !amount) return res.status(400).json({ error: 'title and amount required' });

    const id = `MS-${nanoid(8).toUpperCase()}`;
    const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:5173';

    const order = await createEscrowOrder({
      milestoneId: id,
      description: description || title,
      amount,
      currency,
      returnUrl: `${FRONTEND}/escrow/approved?milestone=${id}`,
      cancelUrl: `${FRONTEND}/escrow/cancelled?milestone=${id}`,
    });

    const ms = createMilestone({
      id,
      title,
      description,
      amount: Number(amount).toFixed(2),
      currency,
      specifications,
      clientEmail,
      workerEmail,
      status: 'ORDER_CREATED',
      paypalOrderId: order.id,
      authorizationId: null,
      captureId: null,
      createdAt: new Date().toISOString(),
    });

    recordEvent({
      milestoneId: id,
      type: 'ORDER_CREATED',
      details: { orderId: order.id, amount: ms.amount, currency },
    });

    res.json({ milestone: ms, approvalUrl: approvalLink(order), orderId: order.id });
  } catch (err) {
    console.error('create escrow failed:', err);
    res.status(500).json({ error: err.message, details: err.body });
  }
});

/**
 * Finalize the hold after buyer approval.
 * Idempotent: handles ORDER_ALREADY_AUTHORIZED by fetching the existing authorization id.
 */
router.post('/authorize/:milestoneId', async (req, res) => {
  try {
    const ms = getMilestone(req.params.milestoneId);
    if (!ms) return res.status(404).json({ error: 'milestone not found' });

    // Already-authorized shortcut
    if (ms.authorizationId) {
      return res.json({ milestone: ms, note: 'already authorized (cached)' });
    }

    let authId;
    try {
      const auth = await authorizeOrder(ms.paypalOrderId);
      authId = auth.purchase_units?.[0]?.payments?.authorizations?.[0]?.id;
    } catch (err) {
      // If PayPal says already authorized, recover by inspecting the order
      const issue = err.body?.details?.[0]?.issue;
      if (issue === 'ORDER_ALREADY_AUTHORIZED') {
        const order = await getOrder(ms.paypalOrderId);
        authId =
          order.purchase_units?.[0]?.payments?.authorizations?.find((a) => a.status === 'CREATED' || a.status === 'PENDING')?.id ||
          order.purchase_units?.[0]?.payments?.authorizations?.[0]?.id;
        if (!authId) throw err;
      } else {
        throw err;
      }
    }

    if (!authId) throw new Error('authorization_id missing in PayPal response');

    const updated = updateMilestone(ms.id, {
      status: 'ESCROW_LOCKED',
      authorizationId: authId,
    });
    recordEvent({
      milestoneId: ms.id,
      type: 'ESCROW_LOCKED',
      details: { authorizationId: authId, amount: ms.amount },
    });
    res.json({ milestone: updated, authorizationId: authId });
  } catch (err) {
    console.error('authorize failed:', err);
    res.status(500).json({ error: err.message, details: err.body });
  }
});

router.post('/submit-proof/:milestoneId', upload.single('proof'), async (req, res) => {
  try {
    const ms = getMilestone(req.params.milestoneId);
    if (!ms) return res.status(404).json({ error: 'milestone not found' });
    if (!ms.authorizationId) return res.status(400).json({ error: 'escrow not yet locked' });
    if (!req.file) return res.status(400).json({ error: 'proof file required' });

    const proofPath = req.file.path;
    const proofHash = sha256File(proofPath);
    const proofUrl = `/uploads/${path.basename(proofPath)}`;

    recordEvent({
      milestoneId: ms.id,
      type: 'PROOF_SUBMITTED',
      details: { proofUrl, proofHash, filename: req.file.originalname, size: req.file.size },
    });

    const verdict = await verifyProof({ milestone: ms, proofImagePath: proofPath });

    recordEvent({ milestoneId: ms.id, type: 'AI_VERDICT', details: verdict });

    let updated;
    if (verdict.verdict === 'PASS') {
      const capture = await captureAuthorization(ms.authorizationId, {
        amount: ms.amount,
        currency: ms.currency,
        note: `ProofLedger AI: Deliverable verified (${verdict.confidence_score}%). Released.`,
      });
      updated = updateMilestone(ms.id, {
        status: 'ESCROW_RELEASED',
        captureId: capture.id,
        proofUrl,
        proofHash,
        aiVerdict: verdict,
      });
      recordEvent({
        milestoneId: ms.id,
        type: 'ESCROW_RELEASED',
        details: { captureId: capture.id, amount: ms.amount, confidence: verdict.confidence_score },
      });
    } else if (verdict.verdict === 'FAIL') {
      await voidAuthorization(ms.authorizationId);
      updated = updateMilestone(ms.id, {
        status: 'ESCROW_REFUNDED',
        proofUrl,
        proofHash,
        aiVerdict: verdict,
      });
      recordEvent({
        milestoneId: ms.id,
        type: 'ESCROW_REFUNDED',
        details: { reason: 'AI verification failed', confidence: verdict.confidence_score },
      });
    } else {
      updated = updateMilestone(ms.id, {
        status: 'NEEDS_REVIEW',
        proofUrl,
        proofHash,
        aiVerdict: verdict,
      });
      recordEvent({
        milestoneId: ms.id,
        type: 'NEEDS_REVIEW',
        details: { confidence: verdict.confidence_score },
      });
    }

    res.json({ milestone: updated, verdict, proofUrl, proofHash });
  } catch (err) {
    console.error('submit-proof failed:', err);
    res.status(500).json({ error: err.message, details: err.body });
  }
});

router.post('/manual-release/:milestoneId', async (req, res) => {
  try {
    const ms = getMilestone(req.params.milestoneId);
    if (!ms || !ms.authorizationId) return res.status(404).json({ error: 'not found' });
    const capture = await captureAuthorization(ms.authorizationId, {
      amount: ms.amount,
      currency: ms.currency,
      note: 'ProofLedger: Manual human-approved release.',
    });
    const updated = updateMilestone(ms.id, { status: 'ESCROW_RELEASED', captureId: capture.id });
    recordEvent({
      milestoneId: ms.id,
      type: 'ESCROW_RELEASED',
      details: { captureId: capture.id, mode: 'manual' },
    });
    res.json({ milestone: updated });
  } catch (err) {
    res.status(500).json({ error: err.message, details: err.body });
  }
});

router.post('/manual-void/:milestoneId', async (req, res) => {
  try {
    const ms = getMilestone(req.params.milestoneId);
    if (!ms || !ms.authorizationId) return res.status(404).json({ error: 'not found' });
    await voidAuthorization(ms.authorizationId);
    const updated = updateMilestone(ms.id, { status: 'ESCROW_REFUNDED' });
    recordEvent({ milestoneId: ms.id, type: 'ESCROW_REFUNDED', details: { mode: 'manual' } });
    res.json({ milestone: updated });
  } catch (err) {
    res.status(500).json({ error: err.message, details: err.body });
  }
});

router.get('/order/:orderId', async (req, res) => {
  try {
    const order = await getOrder(req.params.orderId);
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message, details: err.body });
  }
});

router.get('/ledger', (_req, res) => {
  res.json({ events: allEvents() });
});

export default router;

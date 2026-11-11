import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import escrowRouter from './src/routes/escrow.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'data', 'uploads')));

app.get('/api/health', (_req, res) =>
  res.json({
    ok: true,
    service: 'ProofLedger',
    paypal: !!process.env.PAYPAL_CLIENT_ID,
    aiMock: process.env.AI_MOCK_MODE === 'true' || !process.env.OPENAI_API_KEY,
  })
);

app.use('/api/escrow', escrowRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\n⚡ ProofLedger API listening on http://localhost:${PORT}`);
  console.log(`   PayPal: ${process.env.PAYPAL_API_BASE || 'sandbox'}`);
  console.log(`   AI Mock: ${process.env.AI_MOCK_MODE === 'true' || !process.env.OPENAI_API_KEY}`);
});

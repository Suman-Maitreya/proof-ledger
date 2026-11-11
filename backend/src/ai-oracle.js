// Multimodal AI Verification Oracle
// Compares submitted proof (image) against milestone criteria.
// Uses OpenAI GPT-4o vision when OPENAI_API_KEY is set, else deterministic mock.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';

const USE_MOCK = process.env.AI_MOCK_MODE === 'true' || !process.env.OPENAI_API_KEY;
const MODEL = process.env.AI_MODEL || 'gpt-4o-mini';

const SYSTEM_PROMPT = `You are the ProofLedger Autonomous Verification Oracle.
Your duty is to verify whether submitted photographic/documentary evidence satisfies every contractual criterion.
Be rigorous, objective, and conservative. Look for visual inconsistencies or tampering.

Respond STRICTLY in the following JSON format and nothing else:
{
  "confidence_score": <0-100 integer>,
  "verdict": "PASS" | "NEEDS_REVIEW" | "FAIL",
  "criteria_checklist": [
    { "criterion": "...", "satisfied": true|false, "visual_evidence": "..." }
  ],
  "summary_reasoning": "..."
}
Scoring guide: PASS >= 85, NEEDS_REVIEW 60-84, FAIL < 60.`;

function mockVerdict(milestone) {
  // Deterministic demo mode: pass with 96% confidence, listing every criterion green.
  const checklist = (milestone.specifications || []).map((c) => ({
    criterion: c,
    satisfied: true,
    visual_evidence: `[MOCK] Visual inspection confirms: ${c}`,
  }));
  return {
    confidence_score: 96,
    verdict: 'PASS',
    criteria_checklist: checklist,
    summary_reasoning:
      '[MOCK ORACLE] Running in demo mode — no OPENAI_API_KEY configured. All contractual criteria appear satisfied based on the submitted proof. In production, GPT-4o vision would analyze each criterion against the image.',
    _mock: true,
  };
}

export async function verifyProof({ milestone, proofImagePath }) {
  if (USE_MOCK) return mockVerdict(milestone);

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Read image → base64 data URL
  const absPath = path.resolve(proofImagePath);
  const buf = fs.readFileSync(absPath);
  const ext = path.extname(absPath).slice(1).toLowerCase() || 'jpeg';
  const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
  const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;

  const userContent = [
    {
      type: 'text',
      text:
        `Milestone: ${milestone.title}\n` +
        `Amount: ${milestone.currency || 'USD'} ${milestone.amount}\n\n` +
        `Contractual criteria:\n` +
        (milestone.specifications || []).map((s, i) => `  ${i + 1}. ${s}`).join('\n') +
        `\n\nInspect the attached proof image and respond with the required JSON.`,
    },
    { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
  ];

  const resp = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    temperature: 0.1,
  });

  const raw = resp.choices[0]?.message?.content || '{}';
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {
      confidence_score: 0,
      verdict: 'NEEDS_REVIEW',
      criteria_checklist: [],
      summary_reasoning: `Oracle returned unparseable response: ${raw.slice(0, 200)}`,
    };
  }
  // Normalize verdict thresholds
  const score = Number(parsed.confidence_score ?? 0);
  if (!['PASS', 'NEEDS_REVIEW', 'FAIL'].includes(parsed.verdict)) {
    parsed.verdict = score >= 85 ? 'PASS' : score >= 60 ? 'NEEDS_REVIEW' : 'FAIL';
  }
  parsed._model = MODEL;
  return parsed;
}

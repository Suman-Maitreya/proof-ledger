// Immutable Proof Ledger — JSON-file backed (hackathon-grade; swap for a DB in prod).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const LEDGER_FILE = path.join(DATA_DIR, 'ledger.json');

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(LEDGER_FILE)) {
    fs.writeFileSync(LEDGER_FILE, JSON.stringify({ milestones: {}, events: [] }, null, 2));
  }
}

function load() {
  ensure();
  return JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8'));
}

function save(db) {
  fs.writeFileSync(LEDGER_FILE, JSON.stringify(db, null, 2));
}

export function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function sha256Json(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

export function createMilestone(ms) {
  const db = load();
  db.milestones[ms.id] = ms;
  save(db);
  return ms;
}

export function updateMilestone(id, patch) {
  const db = load();
  if (!db.milestones[id]) throw new Error(`Milestone ${id} not found`);
  db.milestones[id] = { ...db.milestones[id], ...patch, updatedAt: new Date().toISOString() };
  save(db);
  return db.milestones[id];
}

export function getMilestone(id) {
  return load().milestones[id];
}

export function listMilestones() {
  const db = load();
  return Object.values(db.milestones).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export function recordEvent(evt) {
  const db = load();
  const entry = {
    ...evt,
    timestamp: new Date().toISOString(),
    eventHash: '',
  };
  entry.eventHash = sha256Json({ ...entry, eventHash: '' });
  db.events.push(entry);
  save(db);
  return entry;
}

export function eventsForMilestone(milestoneId) {
  return load().events.filter((e) => e.milestoneId === milestoneId);
}

export function allEvents() {
  return load().events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

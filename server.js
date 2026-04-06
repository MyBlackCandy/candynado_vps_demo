import express from 'express';
import path from 'path'; // เพิ่มการนำเข้า path เพื่อจัดการตำแหน่งไฟล์
import { fileURLToPath } from 'url';
import pkg from 'pg';

const { Pool } = pkg;
const app = express();

// จัดการเรื่อง __dirname สำหรับ ES Modules (เนื่องจากคุณใช้ import)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Config ---
const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL || '';

app.use(express.json());

// แก้ไขจุดนี้: ระบุตำแหน่งโฟลเดอร์ public ให้ชัดเจน
app.use(express.static(path.join(__dirname, 'public')));

// --- Optional Postgres pool ---
let pool = null;
if (DATABASE_URL) {
  pool = new Pool({ connectionString: DATABASE_URL, ssl: sslOption(DATABASE_URL) });
  (async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS pageviews(id SERIAL PRIMARY KEY, at TIMESTAMP DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS writes(id SERIAL PRIMARY KEY, at TIMESTAMP DEFAULT NOW());
      `);
      console.log('DB ready');
    } catch (e) {
      console.error('DB init error:', e.message);
      pool = null; 
    }
  })();
}

function sslOption(cs) {
  return /amazonaws|render|railway|supabase|azure|gcp|neon|timescale|heroku/i.test(cs)
    ? { rejectUnauthorized: false }
    : undefined;
}

// --- Routes ---

// หน้าแรก
app.get('/', async (req, res) => {
  try {
    if (pool) await pool.query('INSERT INTO pageviews DEFAULT VALUES;');
    else mem.pageViews++;
  } catch {}
  // ส่งไฟล์ index.html จากในโฟลเดอร์ public
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// หน้าประวัติ (เพื่อป้องกันหน้าขาว และให้เข้าผ่าน leorio.online/fullhistory ได้เลย)
app.get('/fullhistory', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'fullhistory.html'));
});

// --- Demo endpoints ---
let mem = { pageViews: 0, writes: 0 };

app.get('/api/time', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.post('/api/demo-write', async (_req, res) => {
  try {
    if (pool) {
      await pool.query('INSERT INTO writes DEFAULT VALUES;');
      const total = (await pool.query('SELECT COUNT(*)::int AS n FROM writes')).rows[0].n;
      return res.json({ ok: true, total });
    } else {
      mem.writes++;
      return res.json({ ok: true, total: mem.writes });
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/metrics', async (_req, res) => {
  try {
    if (pool) {
      const pv = (await pool.query('SELECT COUNT(*)::int AS n FROM pageviews')).rows[0].n;
      const wr = (await pool.query('SELECT COUNT(*)::int AS n FROM writes')).rows[0].n;
      res.json({ pageViews: pv, writes: wr, db: true });
    } else {
      res.json({ pageViews: mem.pageViews, writes: mem.writes, db: false });
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Listening on ${PORT}`));

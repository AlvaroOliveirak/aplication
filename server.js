import express from 'express';
import pkg from 'pg';
import cors from 'cors';

const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

const db = new Pool({
  user: 'postgres',
  host: 'postgres',
  database: 'tsa',
  password: 'postgres',
  port: 5432
});

/* ================= DASHBOARDS ================= */

// salvar dashboard
app.post('/api/dashboard', async (req, res) => {
  const { name, layout } = req.body;

  const result = await db.query(
    'INSERT INTO dashboards (name, layout) VALUES ($1, $2) RETURNING *',
    [name, layout]
  );

  res.json(result.rows[0]);
});

// listar dashboards
app.get('/api/dashboard', async (req, res) => {
  const result = await db.query('SELECT * FROM dashboards ORDER BY id DESC');
  res.json(result.rows);
});

// carregar dashboard
app.get('/api/dashboard/:id', async (req, res) => {
  const result = await db.query('SELECT * FROM dashboards WHERE id=$1', [req.params.id]);
  res.json(result.rows[0]);
});

/* ================= PROMETHEUS ================= */

app.post('/api/query', async (req, res) => {
  const { query } = req.body;

  const r = await fetch(`http://prometheus:9090/api/v1/query?query=${encodeURIComponent(query)}`);
  const data = await r.json();

  res.json(data);
});

app.listen(3000, () => console.log('SaaS API rodando'));
import express from "express";
import path from "path";
import handlebars from "express-handlebars";
import { fileURLToPath } from 'url';
import client from 'prom-client';
import bcrypt from 'bcryptjs';
import db from "./models/db.js";
import Post from './models/post.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.engine('handlebars', handlebars.engine({
  extname: '.handlebars',
  runtimeOptions: {
    allowProtoPropertiesByDefault: true,
    allowProtoMethodsByDefault: true,
  }
}));

app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

if (process.env.NODE_ENV !== 'production') {
  app.set('view cache', false);
}

app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src * 'unsafe-inline' 'unsafe-eval'; frame-src *;"
  );
  next();
});

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.use(express.static(path.join(__dirname, "public")));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let dashboards = [];
let nextId = 1;
let alerts = [];
let alertId = 1;
let alertLogs = [];

function addAlertLog(alert, value, status) {
  alertLogs.unshift({
    id: alertId++,
    alertId: alert.id,
    metricId: alert.metricId,
    metricName: alert.metricName,
    query: alert.query,
    threshold: alert.threshold,
    value: Number(value).toFixed(2),
    status,
    unit: alert.unit || "%",
    createdAt: new Date().toISOString()
  });

  alertLogs = alertLogs.slice(0, 50);
}

app.get("/", (req, res) => {
  res.render('main', { layout: 'main' });
});

client.collectDefaultMetrics();

app.get('/register', (req, res) => {
  res.render('register', { layout: 'register' });
});

app.post('/register', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!email || !password) {
    return res.redirect('/register');
  }

  try {
    const existingUser = await Post.findOne({ where: { email } });

    if (existingUser) {
      existingUser.password = password;
      await existingUser.save();
    } else {
      await Post.create({ email, password });
    }

    res.redirect('/login');
  } catch (err) {
    res.status(500).send('Houve um erro: ' + err.message);
  }
});

app.get('/login', (req, res) => {
  res.render('login', { layout: 'login' });
});

app.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  Post.findOne({ where: { email } }).then(async (post) => {
    if (!post) {
      return res.redirect('/login');
    }

    const match = await bcrypt.compare(password, post.password);

    if (match) {
      res.redirect('/dashboard');
    } else {
      res.redirect('/login');
    }
  });
});

app.get('/dashboard', (req, res) => {
  res.render('dashboard', {
    layout: 'dashboard'
  });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

app.post('/api/query', async (req, res) => {
  try {
    const {
      query,
      range = 300 // default = 5 minutos
    } = req.body;

    const end = Math.floor(Date.now() / 1000);
    const start = end - Number(range);

    // step inteligente
    let step = 5;

    if (range >= 86400) {
      step = 120;
    } else if (range >= 43200) {
      step = 60;
    } else if (range >= 21600) {
      step = 30;
    } else if (range >= 3600) {
      step = 15;
    }

    const url =
      `http://prometheus:9090/api/v1/query_range` +
      `?query=${encodeURIComponent(query)}` +
      `&start=${start}` +
      `&end=${end}` +
      `&step=${step}`;

    const response = await fetch(url);
    const json = await response.json();

    if (!json.data || !json.data.result) {
      return res.json([]);
    }

    for (const alert of alerts) {
      if (alert.query !== query) {
        continue;
      }

      const series = json.data.result || [];
      let currentValue = 0;

      for (const s of series) {
        const last = s.values?.[s.values.length - 1];

        if (!last) {
          continue;
        }

        const value = Number(last[1]);

        if (value > currentValue) {
          currentValue = value;
        }
      }

      const previousStatus = alert.status;
      const percent = (currentValue / alert.threshold) * 100;
      let nextStatus = "OK";

      if (currentValue >= alert.threshold) {
        nextStatus = "CRITICAL";
      } else if (percent >= 80) {
        nextStatus = "WARNING";
      }

      alert.lastValue = currentValue.toFixed(2);
      alert.status = nextStatus;

      if (nextStatus !== "OK" && nextStatus !== previousStatus) {
        addAlertLog(alert, currentValue, nextStatus);
        console.log(`ALERTA ${nextStatus}: ${alert.metricName} = ${currentValue.toFixed(2)}`);
      }
    }
    

    res.json(json.data.result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/dashboard", (req, res) => {
  res.json(dashboards);
});

app.post("/api/dashboard", (req, res) => {
 const { query, metricId } = req.body;

  const exists = dashboards.find(d => d.query === query);

  if (exists) {
    if (metricId) {
      exists.metricId = metricId;
    }

    return res.json(exists);
  }

  const dashboard = {
  id: nextId++,
  query,
  metricId
};
  dashboards.push(dashboard);

  res.json(dashboard);
});

app.delete("/api/dashboard/:id", (req, res) => {
  const id = Number(req.params.id);

  dashboards = dashboards.filter(d => d.id !== id);

  res.json({ ok: true });
});

app.get("/api/alerts", (req, res) => {
  res.json(alerts);
});

app.post("/api/alert", (req, res) => {
  const threshold = Number(req.body.threshold);

  if (!Number.isFinite(threshold)) {
    return res.status(400).json({
      error: "Threshold invalido"
    });
  }

  const metricId = req.body.metricId || req.body.query;
  const exists = alerts.find(a => a.query === req.body.query)
    || alerts.find(a => a.metricId === metricId);

  if (exists) {
    exists.metricName = req.body.metricName;
    exists.query = req.body.query;
    exists.metricId = metricId;
    exists.threshold = threshold;
    exists.unit = req.body.unit || "%";
    exists.status = "OK";
    exists.lastValue = 0;

    return res.json(exists);
  }

  const alert = {
    id: alertId++,
    metricId,
    metricName: req.body.metricName,
    query: req.body.query,
    threshold,
    status: "OK",
    lastValue: 0,
    unit: req.body.unit || "%"
  };

  alerts.push(alert);

  res.json(alert);

});

app.get("/api/alert-logs", (req, res) => {
  res.json(alertLogs);
});

app.delete("/api/alert/:id", (req, res) => {

  const id = Number(req.params.id);

  alerts = alerts.filter(a => a.id !== id);

  res.json({
    ok: true
  });

});

/*app.get('/teste', (req, res) => {
  res.send('<iframe src="http://192.168.1.8:3002/d-solo/gndc46/new-dashboard?orgId=1&timezone=browser&editIndex=0&panelId=panel-1" width="800" height="400"></iframe>');
});*/

async function iniciar() {
  try {
    await db.sequelize.authenticate();
    console.log("Banco conectado");

    await db.sequelize.sync();
    console.log("Tabela users criada");

    app.listen(3000, '0.0.0.0', () => {
      console.log("Servidor rodando");
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

iniciar();

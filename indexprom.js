import express from "express";
import path from "path";
import handlebars from "express-handlebars";
import { fileURLToPath } from 'url';
import client from 'prom-client';
import bcrypt from 'bcryptjs';
import session from 'express-session';
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

app.use(session({
  secret: 'seu_segredo_aqui',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // definido como false para HTTP
}));

// Middleware de autenticação
const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  // Se não estiver logado, redireciona para o login salvando a página de destino
  res.redirect(`/login?redirectTo=${req.originalUrl}`);
};

let dashboards = [];
let nextId = 1;
let alerts = [];
let alertId = 1;
let alertLogs = [];

function resolveThresholds(alert) {
  const criticalThreshold = Number(alert.criticalThreshold ?? alert.threshold);
  const warningThreshold = Number(
    alert.warningThreshold ?? (Number.isFinite(criticalThreshold) ? criticalThreshold * 0.8 : NaN)
  );

  return { warningThreshold, criticalThreshold };
}

function evaluateAlertStatus(value, alert) {
  const { warningThreshold, criticalThreshold } = resolveThresholds(alert);

  if (!Number.isFinite(value) || !Number.isFinite(warningThreshold) || !Number.isFinite(criticalThreshold)) {
    return "OK";
  }

  if (value >= criticalThreshold) {
    return "CRITICAL";
  }

  if (value >= warningThreshold) {
    return "WARNING";
  }

  return "OK";
}

function addAlertLog(alert, value, status) {
  const { warningThreshold, criticalThreshold } = resolveThresholds(alert);

  alertLogs.unshift({
    id: alertId++,
    alertId: alert.id,
    metricId: alert.metricId,
    metricName: alert.metricName,
    query: alert.query,
    warningThreshold,
    criticalThreshold,
    threshold: criticalThreshold,
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
  const redirectTo = req.query.redirectTo || '/dashboard';

  Post.findOne({ where: { email } }).then(async (post) => {
    if (!post) {
      return res.redirect(`/login?redirectTo=${redirectTo}`);
    }

    const match = await bcrypt.compare(password, post.password);

    if (match) {
      req.session.user = { id: post.id, email: post.email };
      res.redirect(redirectTo);
    } else {
      res.redirect(`/login?redirectTo=${redirectTo}`);
    }
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.get('/dashboard', isAuthenticated, (req, res) => {
  res.render('dashboard', {
    layout: 'dashboard',
    user: req.session.user
  });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

function buildQueryRangeParams(rangeSec) {
  const range = Math.max(Number(rangeSec) || 300, 60);
  const end = Math.floor(Date.now() / 1000);
  const lookback = 300;
  const displayStart = end - range;
  const queryStart = displayStart - lookback;

  let step = Math.max(Math.ceil(range / 240), 5);

  if (range >= 86400) {
    step = 120;
  } else if (range >= 43200) {
    step = 60;
  } else if (range >= 21600) {
    step = 30;
  } else if (range >= 10800) {
    step = 20;
  } else if (range >= 3600) {
    step = 10;
  }

  const alignedStart = Math.floor(queryStart / step) * step;

  return { range, end, displayStart, alignedStart, step };
}

function filterSeriesToWindow(series, displayStart) {
  return series.map((item) => ({
    ...item,
    values: (item.values || []).filter(([timestamp, value]) => {
      if (Number(timestamp) < displayStart) {
        return false;
      }

      if (value === null || value === undefined || value === "NaN") {
        return false;
      }

      return true;
    })
  }));
}

app.post('/api/query', async (req, res) => {
  try {
    const { query, range: rangeInput = 300 } = req.body;
    const { range, end, displayStart, alignedStart, step } = buildQueryRangeParams(rangeInput);

    const url =
      `http://prometheus:9090/api/v1/query_range` +
      `?query=${encodeURIComponent(query)}` +
      `&start=${alignedStart}` +
      `&end=${end}` +
      `&step=${step}`;

    const response = await fetch(url);
    const json = await response.json();

    if (!json.data || !json.data.result) {
      return res.json({
        series: [],
        start: displayStart,
        end,
        step,
        range
      });
    }

    const series = filterSeriesToWindow(json.data.result, displayStart);

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
      const nextStatus = evaluateAlertStatus(currentValue, alert);

      alert.lastValue = currentValue.toFixed(2);
      alert.status = nextStatus;

      if (nextStatus !== "OK" && nextStatus !== previousStatus) {
        addAlertLog(alert, currentValue, nextStatus);
        console.log(`ALERTA ${nextStatus}: ${alert.metricName} = ${currentValue.toFixed(2)}`);
      }
    }

    res.json({
      series,
      start: displayStart,
      end,
      step,
      range
    });
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
  const warningThreshold = Number(req.body.warningThreshold);
  const criticalThreshold = Number(req.body.criticalThreshold ?? req.body.threshold);

  if (!Number.isFinite(warningThreshold) || !Number.isFinite(criticalThreshold)) {
    return res.status(400).json({
      error: "Informe os limites de atencao e alerta"
    });
  }

  if (warningThreshold >= criticalThreshold) {
    return res.status(400).json({
      error: "O limite de atencao deve ser menor que o limite de alerta"
    });
  }

  const metricId = req.body.metricId || req.body.query;
  const exists = alerts.find(a => a.query === req.body.query)
    || alerts.find(a => a.metricId === metricId);

  if (exists) {
    exists.metricName = req.body.metricName;
    exists.query = req.body.query;
    exists.metricId = metricId;
    exists.warningThreshold = warningThreshold;
    exists.criticalThreshold = criticalThreshold;
    exists.threshold = criticalThreshold;
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
    warningThreshold,
    criticalThreshold,
    threshold: criticalThreshold,
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

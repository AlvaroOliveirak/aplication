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

app.get("/", (req, res) => {
  res.render('main', { layout: 'main' });
});

client.collectDefaultMetrics();

app.get('/register', (req, res) => {
  res.render('register', { layout: 'register' });
});

app.post('/register', async (req, res) => {
  console.log(req.body);
  const hashedPassword = await bcrypt.hash(req.body.password, 10);

  Post.create({
    email: req.body.email,
    password: hashedPassword
  })
    .then(() => {
      res.redirect('/login');
    })
    .catch((err) => {
      res.send('Houve um erro: ' + err);
    });
});

app.get('/login', (req, res) => {
  res.render('login', { layout: 'login' });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  Post.findOne({ where: { email: email } }).then(async (post) => {
    if (!post) {
      return res.send("Usuário não encontrado");
    }

    const match = await bcrypt.compare(password, post.password);

    if (match) {
      res.send("Login realizado com sucesso");
    } else {
      res.send("Senha incorreta");
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

    // ALERTAS
for (const alert of alerts) {

  // usa metricId OU query
  if (
    alert.query !== query
  ) {
    continue;
  }

  const series =
    json.data.result || [];

  let currentValue = 0;

  for (const s of series) {

    const last =
      s.values?.[s.values.length - 1];

    if (!last) {
      continue;
    }

    const value =
      Number(last[1]);

    if (value > currentValue) {
      currentValue = value;
    }

  }

  alert.lastValue =
    currentValue.toFixed(2);

  const percent =
    (currentValue / alert.threshold) * 100;

  if (currentValue >= alert.threshold) {

    alert.status = "CRITICAL";

    console.log(
      `🚨 ALERTA CRÍTICO: ${alert.metricName} = ${currentValue}`
    );

  } else if (percent >= 80) {

    alert.status = "WARNING";

    console.log(
      `⚠️ ALERTA WARNING: ${alert.metricName} = ${currentValue}`
    );

  } else {

    alert.status = "OK";

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

  const alert = {
  id: Date.now(),

  metricId: req.body.metricId,

  metricName: req.body.metricName,

  query: req.body.query,

  threshold: Number(req.body.threshold),

  status: "OK",

  lastValue: 0,

  unit: req.body.unit || "%"
};

  alerts.push(alert);

  res.json(alert);

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

import express from "express";
import path from "path";
import handlebars from "express-handlebars";
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer } from 'http';
import crypto from 'crypto';
import client from 'prom-client';
import bcrypt from 'bcryptjs';
import session from 'express-session';
import { Server } from 'socket.io';
import nodemailer from 'nodemailer';
import db from "./models/db.js";
import Post from './models/post.js';
import Dashboard from './models/dashboard.js';
import Alert from './models/alert.js';
import AlertLog from './models/alertLog.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const io = new Server(server);

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

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'troque_este_segredo_em_producao',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.COOKIE_SECURE === 'true',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
});

app.use(sessionMiddleware);

io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

io.on('connection', (socket) => {
  const user = socket.request.session?.user;

  if (user?.id) {
    socket.join(`user:${user.id}`);
    socket.emit('session:ready', { user });
  }
});

// Middleware de autenticação
const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  // Se não estiver logado, redireciona para o login salvando a página de destino
  res.redirect(`/login?redirectTo=${req.originalUrl}`);
};

const isApiAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }

  res.status(401).json({ error: 'Sessao expirada. Faca login novamente.' });
};

function safeRedirect(value) {
  const redirectTo = String(value || '/dashboard');
  return redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/dashboard';
}

const metricCatalog = [
  {
    id: "cpu",
    name: "Uso de CPU (%)",
    unit: "%",
    query: "100 - (avg by(instance)(rate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100)"
  },
  {
    id: "ram",
    name: "Uso de Memoria (%)",
    unit: "%",
    query: "100 * (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes))"
  },
  {
    id: "disco",
    name: "Uso de Disco (%)",
    unit: "%",
    query: "100 * (1 - (node_filesystem_avail_bytes / node_filesystem_size_bytes))"
  },
  {
    id: "rede_rx",
    name: "Entrada de Rede (RX)",
    unit: "B/s",
    query: "rate(node_network_receive_bytes_total[5m])"
  },
  {
    id: "rede_tx",
    name: "Saida de Rede (TX)",
    unit: "B/s",
    query: "rate(node_network_transmit_bytes_total[5m])"
  },
  {
    id: "load_1m",
    name: "Load Average (1m)",
    unit: "",
    query: "node_load1"
  },
  {
    id: "load_5m",
    name: "Load Average (5m)",
    unit: "",
    query: "node_load5"
  }
];

function inferMetric(query, series = []) {
  const normalized = String(query || '').toLowerCase();
  const exact = metricCatalog.find(metric => metric.query.toLowerCase() === normalized);

  if (exact) {
    return exact;
  }

  if (normalized.includes('node_cpu_seconds_total') && normalized.includes('idle')) {
    return metricCatalog[0];
  }

  if (normalized.includes('node_memory_memavailable_bytes')) {
    return metricCatalog[1];
  }

  if (normalized.includes('node_filesystem')) {
    return metricCatalog[2];
  }

  if (normalized.includes('node_network_receive_bytes_total')) {
    return metricCatalog[3];
  }

  if (normalized.includes('node_network_transmit_bytes_total')) {
    return metricCatalog[4];
  }

  if (normalized.includes('node_load1')) {
    return metricCatalog[5];
  }

  if (normalized.includes('node_load5')) {
    return metricCatalog[6];
  }

  const metricName = series[0]?.metric?.__name__;

  return {
    id: crypto.createHash('sha1').update(String(query)).digest('hex').slice(0, 12),
    name: metricName ? beautifyMetric(metricName) : beautifyMetric(query),
    unit: '',
    query
  };
}

function beautifyMetric(name) {
  return String(name || 'Metrica personalizada')
    .replace(/node_/g, '')
    .replace(/_seconds_total/g, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function flattenValues(series) {
  return (series || [])
    .flatMap(item => item.values || [])
    .map(([timestamp, value]) => ({ timestamp: Number(timestamp), value: Number(value) }))
    .filter(point => Number.isFinite(point.value));
}

function calculateAnomaly(series) {
  const values = flattenValues(series);

  if (values.length < 8) {
    return { isAnomaly: false, zScore: 0, movingAverage: null, trend: 0 };
  }

  const sample = values.slice(-30);
  const previous = sample.slice(0, -1).map(point => point.value);
  const current = sample[sample.length - 1].value;
  const mean = previous.reduce((sum, value) => sum + value, 0) / previous.length;
  const variance = previous.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / previous.length;
  const deviation = Math.sqrt(variance);
  const zScore = deviation > 0 ? (current - mean) / deviation : 0;
  const trendWindow = sample.slice(-6).map(point => point.value);
  const trend = trendWindow[trendWindow.length - 1] - trendWindow[0];

  return {
    isAnomaly: Math.abs(zScore) >= 2.5 && Math.abs(current - mean) > 0.01,
    zScore,
    movingAverage: mean,
    trend
  };
}

function buildAlertReport(alert, value, anomaly) {
  const trendDirection = anomaly.trend > 0 ? 'alta' : anomaly.trend < 0 ? 'queda' : 'estavel';
  const parts = [
    `Alerta ${alert.status} em ${alert.metricName}.`,
    `Valor observado: ${Number(value).toFixed(2)}${alert.unit || ''}.`,
    `Media movel: ${Number(anomaly.movingAverage || 0).toFixed(2)}; z-score: ${Number(anomaly.zScore || 0).toFixed(2)}; tendencia recente: ${trendDirection}.`
  ];

  if (String(alert.metricName).toLowerCase().includes('cpu')) {
    parts.push('Verifique processos com alto consumo, saturacao de filas e limites de CPU do container/host.');
  } else if (String(alert.metricName).toLowerCase().includes('mem')) {
    parts.push('Confira vazamentos de memoria, cache crescente, swap e reinicios recentes de servicos.');
  } else if (String(alert.metricName).toLowerCase().includes('disco')) {
    parts.push('Analise crescimento de logs, retencao de dados e espaco livre nos volumes persistentes.');
  } else {
    parts.push('Compare com deploys recentes, mudancas de trafego e eventos do sistema no mesmo horario.');
  }

  return parts.join(' ');
}

async function sendAlertEmail(user, alert, log) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !user?.email) {
    return false;
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const from = process.env.ALERT_FROM || process.env.SMTP_USER;
  const subject = `[Temporal Series] ${log.status}: ${alert.metricName}`;
  const body = [
    log.report,
    '',
    `Status: ${log.status}`,
    `Metrica: ${alert.metricName}`,
    `Query Prometheus: ${alert.query}`,
    '',
    'Recomendacao:',
    buildAlertRecommendation(alert.metricName)
  ].join('\n');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED === 'true'
    }
  });

  try {
    await transporter.verify();
    await transporter.sendMail({
      from,
      to: user.email,
      subject,
      text: body,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.55;color:#132033">
          <h2 style="margin:0 0 12px">Temporal Series - ${log.status}</h2>
          <p>${escapeHtml(log.report)}</p>
          <p><strong>Metrica:</strong> ${escapeHtml(alert.metricName)}</p>
          <p><strong>Query Prometheus:</strong><br><code>${escapeHtml(alert.query)}</code></p>
          <h3>Recomendacao</h3>
          <p>${escapeHtml(buildAlertRecommendation(alert.metricName))}</p>
        </div>
      `
    });
    return true;
  } catch (err) {
    console.error('Falha ao enviar email de alerta:', err.message);
    return false;
  }
}

function buildAlertRecommendation(metricName) {
  const name = String(metricName || '').toLowerCase();

  if (name.includes('cpu')) {
    return 'Verifique processos em pico, limites de CPU do container/host, filas de trabalho e deploys recentes. Se o pico persistir, considere escalar replicas ou reduzir tarefas concorrentes.';
  }

  if (name.includes('mem') || name.includes('ram')) {
    return 'Procure crescimento continuo de heap/cache, vazamentos de memoria e uso de swap. Reinicie servicos apenas como mitigacao temporaria e investigue o processo que mais consome memoria.';
  }

  if (name.includes('disco')) {
    return 'Confira logs, retencao de dados, volumes e arquivos temporarios. Libere espaco com seguranca e ajuste politicas de rotacao antes que o volume sature.';
  }

  if (name.includes('rede')) {
    return 'Compare trafego recebido/enviado com padroes recentes, verifique erros de interface, chamadas externas e possiveis aumentos de carga ou retries.';
  }

  return 'Compare o horario do alerta com deploys, alteracoes de carga, logs de aplicacao e eventos do sistema. Priorize metricas correlacionadas que tambem tenham mudado no mesmo intervalo.';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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


app.get('/teste-email', async (req, res) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })

    await transporter.sendMail({
      from: process.env.ALERT_FROM,
      to: 'seuemail@gmail.com',
      subject: 'Teste',
      text: 'Email funcionando!'
    })

    res.send('Email enviado!')
  } catch (err) {
    console.error(err)
    res.send('Erro ao enviar email')
  }
});


app.get("/", (req, res) => {
  res.render('main', { layout: 'main', user: req.session.user });
});

client.collectDefaultMetrics();

app.get('/register', (req, res) => {
  res.render('register', { layout: 'register' });
});

app.post('/register', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!email || !password) {
    return res.redirect('/register?error=missing-fields');
  }

  if (password.length < 8) {
    return res.redirect('/register?error=weak-password');
  }

  try {
    const existingUser = await Post.findOne({ where: { email } });

    if (existingUser) {
      return res.redirect('/register?error=email-exists');
    }

    await Post.create({ email, password, authProvider: 'local' });
    res.redirect('/login?registered=1');
  } catch (err) {
    console.error('Erro no registro:', err);
    res.redirect('/register?error=registration-failed');
  }
});

app.get('/login', (req, res) => {
  res.render('login', { layout: 'login' });
});

app.get('/auth/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_CALLBACK_URL || `${req.protocol}://${req.get('host')}/auth/google/callback`;

  if (!clientId) {
    return res.status(503).send('Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET para habilitar login com Google.');
  }

  const state = crypto.randomBytes(18).toString('hex');
  req.session.oauthState = state;
  req.session.redirectAfterOAuth = safeRedirect(req.query.redirectTo);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'select_account'
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

app.get('/auth/google/callback', async (req, res) => {
  try {
    if (!req.query.code || req.query.state !== req.session.oauthState) {
      return res.redirect('/login?error=google');
    }

    const redirectUri = process.env.GOOGLE_CALLBACK_URL || `${req.protocol}://${req.get('host')}/auth/google/callback`;
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: req.query.code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });
    const tokenPayload = await tokenResponse.json();

    if (!tokenResponse.ok) {
      throw new Error(tokenPayload.error_description || 'Falha ao obter token Google');
    }

    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenPayload.access_token}` }
    });
    const profile = await profileResponse.json();

    if (!profile.email) {
      throw new Error('Conta Google sem email retornado');
    }

    const email = String(profile.email).toLowerCase();
    const [user] = await Post.findOrCreate({
      where: { email },
      defaults: {
        email,
        googleId: profile.sub,
        name: profile.name,
        authProvider: 'google'
      }
    });

    if (!user.googleId) {
      user.googleId = profile.sub;
      user.name = user.name || profile.name;
      user.authProvider = user.authProvider === 'local' ? 'local+google' : 'google';
      await user.save();
    }

    req.session.user = { id: user.id, email: user.email, name: user.name, theme: user.theme };
    const redirectTo = req.session.redirectAfterOAuth || '/dashboard';
    delete req.session.oauthState;
    delete req.session.redirectAfterOAuth;
    res.redirect(redirectTo);
  } catch (err) {
    console.error(err);
    res.redirect('/login?error=google');
  }
});

app.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const redirectTo = safeRedirect(req.query.redirectTo);

  try {
    const post = await Post.findOne({ where: { email } });

    if (!post || !post.password) {
      return res.redirect(`/login?error=invalid-credentials&redirectTo=${encodeURIComponent(redirectTo)}`);
    }

    const match = await bcrypt.compare(password, post.password);

    if (match) {
      req.session.user = { id: post.id, email: post.email, name: post.name, theme: post.theme };
      res.redirect(redirectTo);
    } else {
      res.redirect(`/login?error=invalid-credentials&redirectTo=${encodeURIComponent(redirectTo)}`);
    }
  } catch (err) {
    console.error('Erro no login:', err);
    res.redirect(`/login?error=login-failed&redirectTo=${encodeURIComponent(redirectTo)}`);
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.get('/dashboard', isAuthenticated, (req, res) => {
  res.render('dashboard', {
    layout: 'dashboard',
    user: req.session.user,
    theme: req.session.user.theme || 'dark'
  });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

function buildQueryRangeParams(rangeSec, startInput, endInput) {
  const now = Math.floor(Date.now() / 1000);
  
  // Se tivermos endInput, usamos ele, senão usamos o agora
  const end = endInput ? Math.floor(new Date(endInput).getTime() / 1000) : now;
  
  // Se tivermos startInput, usamos ele. Senão, calculamos baseado no rangeSec retrocedendo a partir do end
  const start = startInput ? Math.floor(new Date(startInput).getTime() / 1000) : (end - (Number(rangeSec) || 300));
  
  const range = Math.max(end - start, 60);
  const displayStart = start;
  
  // Precisamos de um pequeno lookback para funções de rate/irate funcionarem bem no início do gráfico
  const lookback = 300; 
  const queryStart = displayStart - lookback;

  // Calcula o step para ter aproximadamente 720 pontos (resolução do gráfico)
  let step = Math.max(Math.ceil(range / 720), 5);

  // Alinha o start para o Prometheus
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

app.get('/api/metrics/catalog', isApiAuthenticated, (req, res) => {
  res.json(metricCatalog);
});

app.post('/api/preferences', isApiAuthenticated, async (req, res) => {
  const theme = req.body.theme === 'light' ? 'light' : 'dark';
  const refreshInterval = Number(req.body.refreshInterval);
  const user = await Post.findByPk(req.session.user.id);

  if (user) {
    user.theme = theme;
    await user.save();
    req.session.user.theme = theme;
  }

  res.json({
    theme,
    refreshInterval: Number.isFinite(refreshInterval) ? refreshInterval : undefined
  });
});

app.post('/api/alerts/test-email', isApiAuthenticated, async (req, res) => {
  const fakeAlert = {
    metricName: 'Teste de email',
    query: 'up',
    status: 'INFO',
    unit: ''
  };
  const fakeLog = {
    status: 'INFO',
    report: 'Este e um email de teste do Temporal Series. Se voce recebeu esta mensagem, o SMTP esta configurado corretamente.'
  };

  const ok = await sendAlertEmail(req.session.user, fakeAlert, fakeLog);
  res.status(ok ? 200 : 503).json({
    ok,
    error: ok ? undefined : 'SMTP nao configurado ou falhou no envio.'
  });
});

app.post('/api/metrics/infer', isApiAuthenticated, async (req, res) => {
  const query = String(req.body.query || '').trim();

  if (!query) {
    return res.status(400).json({ error: 'Informe uma query Prometheus.' });
  }

  try {
    const { end, alignedStart, step } = buildQueryRangeParams(300);
    const url =
      `http://prometheus:9090/api/v1/query_range` +
      `?query=${encodeURIComponent(query)}` +
      `&start=${alignedStart}` +
      `&end=${end}` +
      `&step=${step}`;
    const response = await fetch(url);
    const json = await response.json();
    const series = json.data?.result || [];
    res.json(inferMetric(query, series));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/query', isApiAuthenticated, async (req, res) => {
  try {
    const { query, range: rangeInput = 300, start, end: endInput } = req.body;
    const { range, end, displayStart, alignedStart, step } = buildQueryRangeParams(rangeInput, start, endInput);

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
    let comparisonSeries = [];

    if (req.body.comparePrevious) {
      const previousEnd = displayStart;
      const previousStart = Math.max(displayStart - range, 0);
      const previousUrl =
        `http://prometheus:9090/api/v1/query_range` +
        `?query=${encodeURIComponent(query)}` +
        `&start=${previousStart}` +
        `&end=${previousEnd}` +
        `&step=${step}`;
      const previousResponse = await fetch(previousUrl);
      const previousJson = await previousResponse.json();
      comparisonSeries = filterSeriesToWindow(previousJson.data?.result || [], previousStart);
    }

    const userAlerts = await Alert.findAll({ where: { userId: req.session.user.id } });

    for (const alert of userAlerts) {
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
      const anomaly = calculateAnomaly(series);
      let nextStatus = evaluateAlertStatus(currentValue, alert);

      if (nextStatus === "OK" && alert.anomalyEnabled && anomaly.isAnomaly) {
        nextStatus = anomaly.trend > 0 ? "WARNING" : "WARNING";
      }

      alert.lastValue = currentValue;
      alert.status = nextStatus;
      await alert.save();

      if (nextStatus !== "OK" && nextStatus !== previousStatus) {
        const report = buildAlertReport(alert, currentValue, anomaly);
        const log = await AlertLog.create({
          userId: req.session.user.id,
          alertId: alert.id,
          metricId: alert.metricId,
          metricName: alert.metricName,
          query: alert.query,
          warningThreshold: alert.warningThreshold,
          criticalThreshold: alert.criticalThreshold,
          threshold: alert.criticalThreshold,
          value: currentValue,
          zScore: anomaly.zScore,
          movingAverage: anomaly.movingAverage,
          trend: anomaly.trend,
          status: nextStatus,
          unit: alert.unit || "%",
          report
        });
        io.to(`user:${req.session.user.id}`).emit('alert:created', log.toJSON());
        await sendAlertEmail(req.session.user, alert, log);
        console.log(`ALERTA ${nextStatus}: ${alert.metricName} = ${currentValue.toFixed(2)}`);
      }
    }

    res.json({
      series,
      comparisonSeries,
      start: displayStart,
      end,
      step,
      range
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/dashboard", isApiAuthenticated, async (req, res) => {
  const dashboards = await Dashboard.findAll({
    where: { userId: req.session.user.id },
    order: [['createdAt', 'DESC']]
  });

  res.json(dashboards);
});

app.post("/api/dashboard", isApiAuthenticated, async (req, res) => {
 const { query, metricId, chartType = 'line', aggregation = 'none' } = req.body;

  const metric = inferMetric(query);
  const resolvedMetricId = metricId || metric.id;
  const exists = await Dashboard.findOne({
    where: {
      userId: req.session.user.id,
      query
    }
  });

  if (exists) {
    exists.metricId = resolvedMetricId;
    exists.name = metric.name;
    exists.chartType = chartType;
    exists.aggregation = aggregation;
    await exists.save();

    return res.json(exists);
  }

  const dashboard = await Dashboard.create({
    userId: req.session.user.id,
    name: metric.name,
    query,
    metricId: resolvedMetricId,
    chartType,
    aggregation
  });

  res.json(dashboard);
});

app.delete("/api/dashboard/:id", isApiAuthenticated, async (req, res) => {
  await Dashboard.destroy({
    where: {
      id: Number(req.params.id),
      userId: req.session.user.id
    }
  });

  res.json({ ok: true });
});

app.get("/api/alerts", isApiAuthenticated, async (req, res) => {
  const alerts = await Alert.findAll({
    where: { userId: req.session.user.id },
    order: [['createdAt', 'DESC']]
  });

  res.json(alerts);
});

app.post("/api/alert", isApiAuthenticated, async (req, res) => {
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
  const metric = inferMetric(req.body.query);
  const exists = await Alert.findOne({
    where: {
      userId: req.session.user.id,
      metricId
    }
  }) || await Alert.findOne({
    where: {
      userId: req.session.user.id,
      query: req.body.query
    }
  });

  if (exists) {
    exists.metricName = req.body.metricName || metric.name;
    exists.query = req.body.query;
    exists.metricId = metricId;
    exists.warningThreshold = warningThreshold;
    exists.criticalThreshold = criticalThreshold;
    exists.threshold = criticalThreshold;
    exists.unit = req.body.unit || "%";
    exists.status = "OK";
    exists.lastValue = 0;
    exists.anomalyEnabled = req.body.anomalyEnabled !== false;
    await exists.save();

    return res.json(exists);
  }

  const alert = await Alert.create({
    userId: req.session.user.id,
    metricId,
    metricName: req.body.metricName || metric.name,
    query: req.body.query,
    warningThreshold,
    criticalThreshold,
    threshold: criticalThreshold,
    status: "OK",
    lastValue: 0,
    unit: req.body.unit || metric.unit || "%",
    anomalyEnabled: req.body.anomalyEnabled !== false
  });

  res.json(alert);

});

app.get("/api/alert-logs", isApiAuthenticated, async (req, res) => {
  const logs = await AlertLog.findAll({
    where: { userId: req.session.user.id },
    order: [['createdAt', 'DESC']],
    limit: 100
  });

  res.json(logs);
});

app.delete("/api/alert/:id", isApiAuthenticated, async (req, res) => {
  await Alert.destroy({
    where: {
      id: Number(req.params.id),
      userId: req.session.user.id
    }
  });

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

    await db.sequelize.sync({ alter: true });
    console.log("Tabelas sincronizadas");

    server.listen(3000, '0.0.0.0', () => {
      console.log("Servidor rodando com Socket.IO");
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

iniciar();

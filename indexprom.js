import express from "express";
import path from "path";
import handlebars from "express-handlebars";
import { fileURLToPath } from 'url';
import client from 'prom-client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.engine('handlebars', handlebars.engine({
  extname: '.handlebars',
  runtimeOptions: {
    allowProtoPropertiesByDefault: true,
    allowProtoMethodsByDefault: true,
  }
}));

app.set('view engine', '.handlebars');
app.set('views', path.join(__dirname, 'views'));

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

app.get("/", (req, res) => {
  res.render('main', { layout: 'main' });
});

client.collectDefaultMetrics();

app.get('/login', (req, res) => {
  res.render('login', { layout: 'login' });
});

app.get('/dashboard', (req, res) => {
  const grafanaurl = 'http://192.168.1.8:3002/d-solo/gmq9kt/new-dashboard?orgId=1&timezone=browser&panelId=1';
  res.render('dashboard', { 
    layout: 'dashboard',
    grafanaurl: grafanaurl
  });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

/*app.get('/teste', (req, res) => {
  res.send('<iframe src="http://192.168.1.8:3002/d-solo/gndc46/new-dashboard?orgId=1&timezone=browser&editIndex=0&panelId=panel-1" width="800" height="400"></iframe>');
});*/

app.listen(3000, '0.0.0.0', () => {
  console.log("Servidor rodando na porta 3000");
});
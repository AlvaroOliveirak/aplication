import express from "express";
import path from "path";
import handlebars from "express-handlebars";
import { fileURLToPath } from 'url';
import client from 'prom-client';
import bcrypt from 'bcryptjs';
import db from "./models/db.js";
import Post from './models/post.js';
import { json } from "sequelize";


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

app.get("/", (req, res) => {
  res.render('main', { layout: 'main' });
});

client.collectDefaultMetrics();

app.get('/register', (req, res) => {
  res.render('register', { layout: 'register' });
});

app.post('/register', async (req, res) => {
   console.log(req.body)
  Post.create({
        email: req.body.email,
        password: req.body.password
}).then(() => {
    res.redirect('/login')
}).catch((err) => {
    res.send('Houve um erro: ' + err)
})
});

app.get('/login', (req,res)=>{
  res.render('login', { layout: 'login' });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  Post.findOne({ where: { email: email } }).then(async (post) => {
        if (!post) {
            return res.send("Usuário não encontrado")
        }
        const match = await bcrypt.compare(password, post.password)
        
        if (match) {
            res.send("Login realizado com sucesso")
        } else {
            res.send("Senha incorreta")
        }
    })
})

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
    const { query } = req.body;

    const end = Math.floor(Date.now() / 1000);
    const start = end - 300;

    const url = `http://prometheus:9090/api/v1/query_range?query=${encodeURIComponent(query)}&start=${start}&end=${end}&step=5`;

    const response = await fetch(url);
    const json = await response.json();

    if (!json.data || !json.data.result) {
      return res.json([]);
    }

    res.json(json.data.result);

  } catch (err) {
    console.error("ERRO API QUERY:", err);
    res.status(500).json({ error: err.message });
  }
});

let dashboards = [];

app.get("/api/dashboard", (req, res) => {
  res.json(dashboards);
});

app.post("/api/dashboard", (req, res) => {
  dashboards.push(req.body);
  res.json({ ok: true });
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
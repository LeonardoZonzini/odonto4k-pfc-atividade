'use strict';
// App web "IA 4K de Fotos" — Máquina Odonto 4K.
// A foto vai pro servidor, é corrigida (lib/melhorar.js), fica em memória por 30 min
// e some. Nada é gravado em disco.
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const { melhorar, PERFIS } = require('./lib/melhorar');
const auth = require('./lib/auth');

const PORTA = Number(process.env.PORT) || 4300;
const TTL_RESULTADO_MS = 30 * 60 * 1000;
const TAMANHO_MAXIMO = 25 * 1024 * 1024;
const MAX_PARALELO = 2;
const MAX_FILA = 10;
const LIMITE_POR_MINUTO = 12;

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

// ---- login: tudo exige sessão, menos a tela de entrada e as rotas de entrar/cadastrar ----
const PUBLICAS = new Set(['/entrar.html', '/api/entrar', '/api/cadastrar', '/api/eu']);
const tentativas = new Map();
function limitarLogin(req, res, next) {
  const agora = Date.now();
  const lista = (tentativas.get(req.ip) || []).filter((t) => agora - t < 60 * 1000);
  if (lista.length >= 10) return res.status(429).json({ erro: 'Muitas tentativas. Aguarde um minuto.' });
  lista.push(agora);
  tentativas.set(req.ip, lista);
  next();
}
app.use((req, res, next) => {
  if (PUBLICAS.has(req.path)) return next();
  req.usuario = auth.usuarioDaRequisicao(req);
  if (req.usuario) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ erro: 'Entre na sua conta para continuar.' });
  res.redirect('/entrar.html');
});
app.get('/api/eu', (req, res) => {
  const email = auth.usuarioDaRequisicao(req);
  email ? res.json({ email }) : res.status(401).json({ erro: 'Sem sessão.' });
});
app.post('/api/entrar', limitarLogin, express.json({ limit: '2kb' }), (req, res) => {
  const r = auth.entrar((req.body || {}).email, (req.body || {}).senha);
  if (r.erro) return res.status(401).json(r);
  auth.abrirSessao(req, res, r.email);
  res.json({ email: r.email });
});
app.post('/api/cadastrar', limitarLogin, express.json({ limit: '2kb' }), (req, res) => {
  const r = auth.cadastrar((req.body || {}).email, (req.body || {}).senha);
  if (r.erro) return res.status(400).json(r);
  auth.abrirSessao(req, res, r.email);
  res.json({ email: r.email });
});
app.post('/api/sair', (_req, res) => { auth.fecharSessao(res); res.json({ ok: true }); });

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: TAMANHO_MAXIMO, files: 1 } });

// ---- resultados em memória, com validade ----
const resultados = new Map();
setInterval(() => {
  const agora = Date.now();
  for (const [id, r] of resultados) if (r.expira < agora) resultados.delete(id);
}, 60 * 1000).unref();

// ---- limite simples por IP ----
const acessos = new Map();
function limitar(req, res, next) {
  const agora = Date.now();
  const lista = (acessos.get(req.ip) || []).filter((t) => agora - t < 60 * 1000);
  if (lista.length >= LIMITE_POR_MINUTO) {
    return res.status(429).json({ erro: 'Muitas fotos em pouco tempo. Aguarde um minuto e tente de novo.' });
  }
  lista.push(agora);
  acessos.set(req.ip, lista);
  next();
}

// ---- fila: no máximo 2 correções ao mesmo tempo ----
let ativos = 0;
const fila = [];
function entrarNaFila() {
  return new Promise((resolve, reject) => {
    if (ativos < MAX_PARALELO) { ativos++; return resolve(); }
    if (fila.length >= MAX_FILA) return reject(new Error('ocupado'));
    fila.push(resolve);
  });
}
function sairDaFila() {
  const proximo = fila.shift();
  if (proximo) proximo(); else ativos--;
}

app.get('/api/tipos', (_req, res) => {
  res.json(Object.entries(PERFIS).map(([id, p]) => ({ id, rotulo: p.rotulo })));
});

app.post('/api/melhorar', limitar, upload.single('foto'), async (req, res) => {
  if (!req.file) return res.status(400).json({ erro: 'Envie uma foto.' });
  const tipo = PERFIS[req.body.tipo] ? req.body.tipo : 'sorriso';
  try {
    await entrarNaFila();
  } catch {
    return res.status(503).json({ erro: 'O app está com muitas fotos agora. Tente de novo em instantes.' });
  }
  try {
    const r = await melhorar(req.file.buffer, tipo);
    const id = crypto.randomUUID();
    resultados.set(id, { buffer: r.buffer, expira: Date.now() + TTL_RESULTADO_MS });
    res.json({ id, url: `/api/resultado/${id}`, largura: r.info.largura, altura: r.info.altura, validadeMin: TTL_RESULTADO_MS / 60000 });
  } catch (e) {
    console.error('falha ao melhorar:', e.message);
    res.status(422).json({ erro: 'Não consegui abrir essa foto. Tente enviar em JPG ou PNG.' });
  } finally {
    sairDaFila();
  }
});

app.get('/api/resultado/:id', (req, res) => {
  const r = resultados.get(req.params.id);
  if (!r || r.expira < Date.now()) return res.status(404).json({ erro: 'Essa foto já expirou. Envie de novo.' });
  res.set({
    'Content-Type': 'image/jpeg',
    'Cache-Control': 'no-store',
    'Content-Disposition': 'inline; filename="odonto4k-foto-melhorada.jpg"',
  });
  res.send(r.buffer);
});

app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0 }));

// ---- erros (upload grande, arquivo inválido) ----
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Foto muito grande. O limite é 25 MB.' : 'Não foi possível receber a foto.';
    return res.status(413).json({ erro: msg });
  }
  console.error(err);
  res.status(500).json({ erro: 'Algo deu errado. Tente de novo.' });
});

app.listen(PORTA, () => console.log(`IA 4K de Fotos rodando em http://localhost:${PORTA}`));

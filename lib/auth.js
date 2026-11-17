'use strict';
// Login e cadastro. Senhas com scrypt; sessão em cookie assinado (HMAC), sem banco.
// Usuários cadastrados ficam em data/usuarios.json. A conta de demonstração vem no código
// (só o hash, nunca a senha) e funciona mesmo se o arquivo de usuários sumir.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ARQUIVO = path.join(__dirname, '..', 'data', 'usuarios.json');
const SEGREDO = process.env.SESSAO_SEGREDO || crypto.randomBytes(32).toString('hex');
const DURACAO_MS = 7 * 24 * 60 * 60 * 1000;
const COOKIE = 'o4k_sessao';

const DEMO = {
  email: process.env.DEMO_EMAIL || 'professor@odonto4k.app',
  hash: process.env.DEMO_HASH ||
    '63f27adcaaadf3ee7aee9430ea2bfa5e:cb2264a68fbdeef83b979fce5954fa7979f1f68f1344350aba35a552fc57d374da72475259f91090d8d15a0f6468cb721794df72529f50d22d39c938d7f4bbd3',
};

function hashSenha(senha) {
  const sal = crypto.randomBytes(16);
  return sal.toString('hex') + ':' + crypto.scryptSync(senha, sal, 64).toString('hex');
}
function confere(senha, guardado) {
  const [sal, h] = guardado.split(':');
  const calc = crypto.scryptSync(senha, Buffer.from(sal, 'hex'), 64);
  const esperado = Buffer.from(h, 'hex');
  return calc.length === esperado.length && crypto.timingSafeEqual(calc, esperado);
}

function lerUsuarios() {
  try { return JSON.parse(fs.readFileSync(ARQUIVO, 'utf8')); } catch { return {}; }
}
function gravarUsuarios(u) {
  fs.mkdirSync(path.dirname(ARQUIVO), { recursive: true });
  fs.writeFileSync(ARQUIVO, JSON.stringify(u, null, 2));
}
const normalizar = (email) => String(email || '').trim().toLowerCase();
const emailValido = (e) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(e);

function cadastrar(email, senha) {
  email = normalizar(email);
  if (!emailValido(email)) return { erro: 'Digite um e-mail válido.' };
  if (String(senha || '').length < 6) return { erro: 'A senha precisa ter pelo menos 6 caracteres.' };
  const usuarios = lerUsuarios();
  if (usuarios[email] || email === DEMO.email) return { erro: 'Esse e-mail já tem conta. Use a aba Entrar.' };
  usuarios[email] = { hash: hashSenha(senha), criado: new Date().toISOString() };
  gravarUsuarios(usuarios);
  return { email };
}

function entrar(email, senha) {
  email = normalizar(email);
  const guardado = email === DEMO.email ? DEMO.hash : (lerUsuarios()[email] || {}).hash;
  // faz o scrypt mesmo sem usuário, pra não revelar por tempo de resposta quais e-mails existem
  const ok = confere(String(senha || ''), guardado || DEMO.hash) && Boolean(guardado);
  return ok ? { email } : { erro: 'E-mail ou senha incorretos.' };
}

// ---- sessão ----
function assinar(texto) { return crypto.createHmac('sha256', SEGREDO).update(texto).digest('hex'); }
function criarToken(email) {
  const corpo = Buffer.from(JSON.stringify({ e: email, x: Date.now() + DURACAO_MS })).toString('base64url');
  return corpo + '.' + assinar(corpo);
}
function lerCookie(req) {
  const m = (req.headers.cookie || '').split(';').map((s) => s.trim()).find((s) => s.startsWith(COOKIE + '='));
  return m ? m.slice(COOKIE.length + 1) : '';
}
function usuarioDaRequisicao(req) {
  const [corpo, ass] = lerCookie(req).split('.');
  if (!corpo || !ass) return null;
  const esperado = Buffer.from(assinar(corpo));
  const recebido = Buffer.from(ass);
  if (esperado.length !== recebido.length || !crypto.timingSafeEqual(esperado, recebido)) return null;
  try {
    const d = JSON.parse(Buffer.from(corpo, 'base64url').toString());
    return d.x > Date.now() ? d.e : null;
  } catch { return null; }
}
function abrirSessao(req, res, email) {
  const seguro = req.secure ? '; Secure' : '';
  res.append('Set-Cookie', `${COOKIE}=${criarToken(email)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${DURACAO_MS / 1000}${seguro}`);
}
function fecharSessao(res) {
  res.append('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

module.exports = { cadastrar, entrar, usuarioDaRequisicao, abrirSessao, fecharSessao, DEMO_EMAIL: DEMO.email };

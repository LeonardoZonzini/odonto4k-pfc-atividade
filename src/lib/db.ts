import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

export const DATA_DIR = path.resolve(process.env.DATA_DIR || (process.env.VERCEL ? "/tmp/odonto4k" : "./data"));
export const ARQUIVOS_DIR = path.join(DATA_DIR, "arquivos");

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  whatsapp TEXT NOT NULL DEFAULT '',
  senha_hash TEXT NOT NULL,
  email_verificado INTEGER NOT NULL DEFAULT 0,
  clinica_nome TEXT NOT NULL DEFAULT '',
  clinica_logo TEXT NOT NULL DEFAULT '',
  perfil TEXT NOT NULL DEFAULT '{}',
  onboarding_ok INTEGER NOT NULL DEFAULT 0,
  tutorial_ok INTEGER NOT NULL DEFAULT 0,
  plano TEXT NOT NULL DEFAULT 'teste',
  plano_status TEXT NOT NULL DEFAULT 'ativo',
  plano_ciclo TEXT NOT NULL DEFAULT 'mensal',
  pago_ate INTEGER NOT NULL DEFAULT 0,
  proxima_recarga INTEGER NOT NULL DEFAULT 0,
  teste_fim INTEGER NOT NULL DEFAULT 0,
  inativo_desde INTEGER NOT NULL DEFAULT 0,
  ip_cadastro TEXT NOT NULL DEFAULT '',
  criado_em INTEGER NOT NULL,
  ultimo_acesso INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS users_whatsapp ON users(whatsapp);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  criado_em INTEGER NOT NULL,
  expira_em INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tipo TEXT NOT NULL,
  expira_em INTEGER NOT NULL,
  usado_em INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  bolsa TEXT NOT NULL,
  delta INTEGER NOT NULL,
  motivo TEXT NOT NULL,
  ref TEXT NOT NULL DEFAULT '',
  criado_em INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ledger_user ON ledger(user_id);
CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  nascimento TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  consentimento_em INTEGER NOT NULL,
  demo INTEGER NOT NULL DEFAULT 0,
  criado_em INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS patients_user ON patients(user_id);
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  foto TEXT NOT NULL DEFAULT '',
  foto_w INTEGER NOT NULL DEFAULT 0,
  foto_h INTEGER NOT NULL DEFAULT 0,
  resultado TEXT NOT NULL DEFAULT '',
  estado TEXT NOT NULL DEFAULT '{}',
  criado_em INTEGER NOT NULL,
  atualizado_em INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS plans_patient ON plans(patient_id);
CREATE TABLE IF NOT EXISTS generations (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  tipo TEXT NOT NULL,
  params TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL,
  erro TEXT NOT NULL DEFAULT '',
  imagens TEXT NOT NULL DEFAULT '[]',
  uso TEXT NOT NULL DEFAULT '{}',
  criado_em INTEGER NOT NULL,
  concluido_em INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS generations_plan ON generations(plan_id);
CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  antes TEXT NOT NULL,
  depois TEXT NOT NULL,
  titulo TEXT NOT NULL,
  texto TEXT NOT NULL DEFAULT '',
  valor TEXT NOT NULL DEFAULT '',
  visualizacoes INTEGER NOT NULL DEFAULT 0,
  criado_em INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS proposals_plan ON proposals(plan_id);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL DEFAULT '',
  nome TEXT NOT NULL,
  dados TEXT NOT NULL DEFAULT '',
  criado_em INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS events_nome ON events(nome, criado_em);
CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  assunto TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberto',
  criado_em INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS compras_pendentes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  dados TEXT NOT NULL,
  criado_em INTEGER NOT NULL,
  aplicado_em INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS kiwify_eventos (
  id TEXT PRIMARY KEY,
  criado_em INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS emails_enviados (
  user_id TEXT NOT NULL,
  tipo TEXT NOT NULL,
  criado_em INTEGER NOT NULL,
  PRIMARY KEY (user_id, tipo)
);
`;

type Global = typeof globalThis & { __o4kDb?: DatabaseSync };

function abrir(): DatabaseSync {
  const g = globalThis as Global;
  if (g.__o4kDb) return g.__o4kDb;
  fs.mkdirSync(ARQUIVOS_DIR, { recursive: true });
  const db = new DatabaseSync(path.join(DATA_DIR, "odonto4k.db"));
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
  db.exec(ESQUEMA);
  g.__o4kDb = db;
  return db;
}

type Param = string | number | bigint | null | Uint8Array;

export function um<T = Record<string, unknown>>(sql: string, ...params: Param[]): T | undefined {
  const linha = abrir().prepare(sql).get(...params);
  return linha ? ({ ...linha } as T) : undefined;
}

export function todos<T = Record<string, unknown>>(sql: string, ...params: Param[]): T[] {
  return abrir()
    .prepare(sql)
    .all(...params)
    .map((l) => ({ ...l }) as T);
}

export function rodar(sql: string, ...params: Param[]) {
  return abrir().prepare(sql).run(...params);
}

export function transacao<T>(fn: () => T): T {
  const db = abrir();
  db.exec("BEGIN IMMEDIATE");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function novoId(bytes = 12) {
  return randomBytes(bytes).toString("base64url");
}

export function agora() {
  return Date.now();
}

export const DIA = 24 * 60 * 60 * 1000;

export function evento(userId: string, nome: string, dados: unknown = "") {
  try {
    rodar(
      "INSERT INTO events (user_id, nome, dados, criado_em) VALUES (?,?,?,?)",
      userId,
      nome,
      typeof dados === "string" ? dados : JSON.stringify(dados),
      agora(),
    );
  } catch {}
}

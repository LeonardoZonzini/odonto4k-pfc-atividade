import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { agora, DIA, rodar, um } from "./db";
import { SESSAO_DIAS, ehAdmin } from "./config";
import { marcarAtividade, sincronizarCreditos, Usuario } from "./creditos";

const COOKIE = "o4k_sessao";

export function hashSenha(senha: string) {
  const sal = randomBytes(16);
  const h = scryptSync(senha, sal, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${sal.toString("base64")}$${h.toString("base64")}`;
}

export function conferirSenha(senha: string, guardado: string) {
  const [alg, sal, h] = guardado.split("$");
  if (alg !== "scrypt" || !sal || !h) return false;
  const esperado = Buffer.from(h, "base64");
  const obtido = scryptSync(senha, Buffer.from(sal, "base64"), esperado.length, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(esperado, obtido);
}

export function sha(valor: string) {
  return createHash("sha256").update(valor).digest("hex");
}

export async function criarSessao(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const t = agora();
  rodar(
    "INSERT INTO sessions (token_hash, user_id, criado_em, expira_em) VALUES (?,?,?,?)",
    sha(token),
    userId,
    t,
    t + SESSAO_DIAS * DIA,
  );
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSAO_DIAS * 24 * 60 * 60,
  });
}

export async function encerrarSessao() {
  const loja = await cookies();
  const token = loja.get(COOKIE)?.value;
  if (token) rodar("DELETE FROM sessions WHERE token_hash = ?", sha(token));
  loja.delete(COOKIE);
  loja.delete("o4k_visto");
}

export const usuarioAtual = cache(async (): Promise<Usuario | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const s = um<{ user_id: string; expira_em: number }>(
    "SELECT user_id, expira_em FROM sessions WHERE token_hash = ?",
    sha(token),
  );
  if (!s || s.expira_em < agora()) return null;
  let u = um<Usuario>("SELECT * FROM users WHERE id = ?", s.user_id);
  if (!u) return null;
  u = sincronizarCreditos(u);
  marcarAtividade(u);
  if (agora() - u.ultimo_acesso > 10 * 60 * 1000) {
    rodar("UPDATE users SET ultimo_acesso = ? WHERE id = ?", agora(), u.id);
  }
  return u;
});

export async function exigirUsuario(): Promise<Usuario> {
  const u = await usuarioAtual();
  if (!u) redirect("/entrar");
  return u;
}

export async function exigirAdmin(): Promise<Usuario> {
  const u = await exigirUsuario();
  if (!ehAdmin(u.email)) redirect("/app");
  return u;
}

export function criarToken(userId: string, tipo: "verificar" | "reset", validadeMs: number) {
  const token = randomBytes(32).toString("base64url");
  rodar(
    "INSERT INTO tokens (token_hash, user_id, tipo, expira_em) VALUES (?,?,?,?)",
    sha(token),
    userId,
    tipo,
    agora() + validadeMs,
  );
  return token;
}

export function consumirToken(token: string, tipo: "verificar" | "reset"): string | null {
  const t = um<{ user_id: string; expira_em: number; usado_em: number }>(
    "SELECT user_id, expira_em, usado_em FROM tokens WHERE token_hash = ? AND tipo = ?",
    sha(token),
    tipo,
  );
  if (!t || t.usado_em || t.expira_em < agora()) return null;
  rodar("UPDATE tokens SET usado_em = ? WHERE token_hash = ?", agora(), sha(token));
  return t.user_id;
}

export async function ipDoPedido() {
  const h = await headers();
  return (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || "local";
}

type Balde = { n: number; ate: number };
const g = globalThis as typeof globalThis & { __o4kLimite?: Map<string, Balde> };
const baldes = (g.__o4kLimite ??= new Map<string, Balde>());

export function dentroDoLimite(chave: string, maximo: number, janelaMs: number) {
  const t = agora();
  if (baldes.size > 5000) for (const [k, v] of baldes) if (v.ate < t) baldes.delete(k);
  const b = baldes.get(chave);
  if (!b || b.ate < t) {
    baldes.set(chave, { n: 1, ate: t + janelaMs });
    return true;
  }
  b.n++;
  return b.n <= maximo;
}

export async function origemValida(req: Request) {
  const origem = req.headers.get("origin");
  if (!origem) return true;
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  try {
    return new URL(origem).host === host;
  } catch {
    return false;
  }
}

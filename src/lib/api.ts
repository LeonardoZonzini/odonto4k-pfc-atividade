import "server-only";
import { origemValida, usuarioAtual } from "./auth";
import { Usuario } from "./creditos";

export function json(dados: unknown, status = 200) {
  return Response.json(dados, { status });
}

export function falha(erro: string, status = 400, extra: Record<string, unknown> = {}) {
  return Response.json({ erro, ...extra }, { status });
}

export async function usuarioDaApi(req: Request): Promise<Usuario | Response> {
  if (req.method !== "GET" && !(await origemValida(req))) return falha("Origem não permitida.", 403);
  const u = await usuarioAtual();
  if (!u) return falha("Sua sessão expirou. Entre novamente.", 401);
  return u;
}

export function precisaVerificarEmail(u: Usuario) {
  return Boolean(process.env.RESEND_API_KEY) && !u.email_verificado;
}

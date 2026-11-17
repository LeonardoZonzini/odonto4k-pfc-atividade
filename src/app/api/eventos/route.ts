import { json, usuarioDaApi } from "@/lib/api";
import { evento } from "@/lib/db";

export async function POST(req: Request) {
  const u = await usuarioDaApi(req);
  if (u instanceof Response) return u;
  const c = await req.json().catch(() => null);
  const nome = String(c?.nome || "").slice(0, 40);
  if (/^[a-z0-9_]+$/.test(nome)) evento(u.id, nome, String(c?.dados || "").slice(0, 200));
  return json({ ok: true });
}

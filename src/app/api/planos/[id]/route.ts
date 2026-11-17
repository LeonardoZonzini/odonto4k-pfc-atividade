import { falha, json, usuarioDaApi } from "@/lib/api";
import { agora, rodar, um } from "@/lib/db";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioDaApi(req);
  if (u instanceof Response) return u;
  const { id } = await params;
  const plano = um<{ id: string }>("SELECT id FROM plans WHERE id = ? AND user_id = ?", id, u.id);
  if (!plano) return falha("Plano não encontrado.", 404);
  const corpo = await req.json().catch(() => null);
  const estado = JSON.stringify(corpo?.estado ?? {});
  if (estado.length > 300_000) return falha("Dados grandes demais.", 413);
  rodar("UPDATE plans SET estado = ?, atualizado_em = ? WHERE id = ?", estado, agora(), id);
  return json({ ok: true });
}

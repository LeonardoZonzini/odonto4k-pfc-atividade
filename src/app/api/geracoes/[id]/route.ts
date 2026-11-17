import { falha, json, usuarioDaApi } from "@/lib/api";
import { saldoDe } from "@/lib/creditos";
import { um } from "@/lib/db";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioDaApi(req);
  if (u instanceof Response) return u;
  const { id } = await params;
  const g = um<{ id: string; status: string; imagens: string; erro: string; tipo: string; params: string; criado_em: number }>(
    "SELECT id, status, imagens, erro, tipo, params, criado_em FROM generations WHERE id = ? AND user_id = ?",
    id,
    u.id,
  );
  if (!g) return falha("Geração não encontrada.", 404);
  return json({
    id: g.id,
    status: g.status,
    tipo: g.tipo,
    params: JSON.parse(g.params),
    imagens: JSON.parse(g.imagens),
    criado_em: g.criado_em,
    saldo: saldoDe(u.id).total,
  });
}

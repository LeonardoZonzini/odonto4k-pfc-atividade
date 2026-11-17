import { falha, json, usuarioDaApi } from "@/lib/api";
import { agora, rodar, um } from "@/lib/db";
import { normalizarFoto, salvarArquivo } from "@/lib/imagem";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioDaApi(req);
  if (u instanceof Response) return u;
  const { id } = await params;
  const plano = um<{ id: string; patient_id: string }>("SELECT id, patient_id FROM plans WHERE id = ? AND user_id = ?", id, u.id);
  if (!plano) return falha("Plano não encontrado.", 404);
  const fd = await req.formData().catch(() => null);
  const arquivo = fd?.get("imagem");
  if (!(arquivo instanceof File) || !arquivo.size) return falha("Imagem ausente.");
  if (arquivo.size > 15 * 1024 * 1024) return falha("Imagem grande demais.", 413);
  try {
    const { dados } = await normalizarFoto(Buffer.from(await arquivo.arrayBuffer()));
    const caminho = await salvarArquivo(`${u.id}/${plano.patient_id}/${id}/resultado.jpg`, dados);
    rodar("UPDATE plans SET resultado = ?, atualizado_em = ? WHERE id = ?", caminho, agora(), id);
    return json({ resultado: caminho, v: agora() });
  } catch {
    return falha("Não foi possível salvar a simulação.");
  }
}

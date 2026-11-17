import { falha, json, usuarioDaApi } from "@/lib/api";
import { acessoDe } from "@/lib/creditos";
import { agora, evento, rodar, um } from "@/lib/db";
import { normalizarFoto, salvarArquivo } from "@/lib/imagem";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioDaApi(req);
  if (u instanceof Response) return u;
  const { id } = await params;
  const plano = um<{ id: string; patient_id: string }>("SELECT id, patient_id FROM plans WHERE id = ? AND user_id = ?", id, u.id);
  if (!plano) return falha("Plano não encontrado.", 404);
  if (!acessoDe(u).ativo) return falha("Seu acesso está pausado. Escolha um plano para enviar novas fotos.", 402, { paywall: true });
  const fd = await req.formData().catch(() => null);
  const arquivo = fd?.get("foto");
  if (!(arquivo instanceof File) || !arquivo.size) return falha("Envie uma foto.");
  if (arquivo.size > 15 * 1024 * 1024) return falha("A foto precisa ter até 15 MB.", 413);
  try {
    const { dados, largura, altura } = await normalizarFoto(Buffer.from(await arquivo.arrayBuffer()));
    const caminho = await salvarArquivo(`${u.id}/${plano.patient_id}/${id}/original.jpg`, dados);
    rodar(
      "UPDATE plans SET foto = ?, foto_w = ?, foto_h = ?, resultado = '', estado = '{}', atualizado_em = ? WHERE id = ?",
      caminho,
      largura,
      altura,
      agora(),
      id,
    );
    evento(u.id, "foto_enviada");
    return json({ foto: caminho, largura, altura, v: agora() });
  } catch {
    return falha("Não foi possível ler esta imagem. Envie uma foto JPG ou PNG.");
  }
}

import { falha, usuarioDaApi } from "@/lib/api";
import { dentroDoLimite } from "@/lib/auth";
import { acessoDe } from "@/lib/creditos";
import { evento } from "@/lib/db";
import { melhorarFoto } from "@/lib/imagem";

export async function POST(req: Request) {
  const u = await usuarioDaApi(req);
  if (u instanceof Response) return u;
  if (!acessoDe(u).ativo) return falha("Seu acesso está pausado. Escolha um plano para continuar.", 402, { paywall: true });
  if (!dentroDoLimite(`melhorar:${u.id}`, 40, 10 * 60 * 1000)) return falha("Muitas fotos em sequência. Aguarde alguns minutos.", 429);
  const fd = await req.formData().catch(() => null);
  const arquivo = fd?.get("foto");
  if (!(arquivo instanceof File) || !arquivo.size) return falha("Envie uma foto.");
  if (arquivo.size > 20 * 1024 * 1024) return falha("A foto precisa ter até 20 MB.", 413);
  try {
    const saida = await melhorarFoto(Buffer.from(await arquivo.arrayBuffer()));
    evento(u.id, "foto_melhorada");
    return new Response(new Uint8Array(saida), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" } });
  } catch {
    return falha("Não foi possível ler esta imagem. Envie uma foto JPG ou PNG.");
  }
}

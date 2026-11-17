import { um } from "@/lib/db";
import { lerArquivo } from "@/lib/imagem";
import { pdfDaProposta } from "@/lib/pdf";

type Linha = {
  antes: string; depois: string; titulo: string; texto: string; valor: string; criado_em: number;
  paciente: string; dentista: string; clinica_nome: string; clinica_logo: string;
};

export async function GET(_: Request, { params }: { params: Promise<{ token: string; qual: string }> }) {
  const { token, qual } = await params;
  const p = um<Linha>(
    `SELECT pr.antes, pr.depois, pr.titulo, pr.texto, pr.valor, pr.criado_em, pa.nome AS paciente,
            u.nome AS dentista, u.clinica_nome, u.clinica_logo
     FROM proposals pr JOIN plans pl ON pl.id = pr.plan_id JOIN patients pa ON pa.id = pl.patient_id
     JOIN users u ON u.id = pr.user_id WHERE pr.token = ?`,
    token,
  );
  if (!p) return new Response("Não encontrado", { status: 404 });
  try {
    if (qual === "antes" || qual === "depois") {
      return new Response(new Uint8Array(await lerArquivo(p[qual])), {
        headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" },
      });
    }
    if (qual === "logo" && p.clinica_logo) {
      return new Response(new Uint8Array(await lerArquivo(p.clinica_logo)), {
        headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" },
      });
    }
    if (qual === "proposta.pdf") {
      const pdf = await pdfDaProposta({
        clinica: p.clinica_nome,
        dentista: p.dentista,
        logo: p.clinica_logo ? await lerArquivo(p.clinica_logo).catch(() => null) : null,
        paciente: p.paciente,
        titulo: p.titulo,
        texto: p.texto,
        valor: p.valor,
        data: new Date(p.criado_em).toLocaleDateString("pt-BR"),
        antes: await lerArquivo(p.antes),
        depois: await lerArquivo(p.depois),
      });
      return new Response(new Uint8Array(pdf), {
        headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="proposta.pdf"' },
      });
    }
  } catch (e) {
    console.error("[proposta]", e);
  }
  return new Response("Não encontrado", { status: 404 });
}

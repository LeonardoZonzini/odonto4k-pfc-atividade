import { usuarioAtual } from "@/lib/auth";
import { lerArquivo } from "@/lib/imagem";

export async function GET(_: Request, { params }: { params: Promise<{ caminho: string[] }> }) {
  const u = await usuarioAtual();
  const { caminho } = await params;
  if (!u || caminho[0] !== u.id || caminho.some((p) => p.includes(".."))) return new Response("Não encontrado", { status: 404 });
  try {
    const dados = await lerArquivo(caminho.join("/"));
    const tipo = caminho.at(-1)!.endsWith(".png") ? "image/png" : "image/jpeg";
    return new Response(new Uint8Array(dados), {
      headers: { "Content-Type": tipo, "Cache-Control": "private, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("Não encontrado", { status: 404 });
  }
}

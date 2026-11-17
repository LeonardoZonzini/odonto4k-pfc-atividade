import { assinaturaValida, processarKiwify } from "@/lib/kiwify";

export async function POST(req: Request) {
  const corpo = await req.text();
  const url = new URL(req.url);
  if (!assinaturaValida(corpo, url.searchParams.get("signature"))) return new Response("assinatura inválida", { status: 401 });
  try {
    const resultado = processarKiwify(JSON.parse(corpo));
    return Response.json({ ok: true, resultado });
  } catch (e) {
    console.error("[kiwify]", e);
    return new Response("erro", { status: 500 });
  }
}

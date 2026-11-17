import "server-only";
import { agora, novoId, rodar, todos, um } from "./db";
import { VARIACOES } from "./config";
import { estornarGeracao } from "./creditos";
import { comporResultado, lerArquivo, Ponto, prepararEdicao, salvarArquivo } from "./imagem";

export type TipoGeracao = "lentes" | "aparelho";

export type ParamsGeracao = {
  formato?: "oval" | "quadrado" | "triangular";
  cor?: "BL1" | "BL2" | "A1" | "B1";
  dentes?: 6 | 8 | 10;
  clarear?: boolean;
};

export function iaDisponivel() {
  return Boolean(process.env.OPENAI_API_KEY);
}

const FORMATOS: Record<string, string> = {
  oval: "softly rounded, oval tooth shapes with gentle curved incisal edges",
  quadrado: "square tooth shapes with flatter incisal edges and defined angles",
  triangular: "slightly tapered, triangular tooth shapes that are narrower at the gum line",
};

const CORES: Record<string, string> = {
  BL1: "very bright bleach white (shade BL1)",
  BL2: "bright bleach white (shade BL2)",
  A1: "natural light shade (VITA A1)",
  B1: "natural bright shade (VITA B1)",
};

const REGRAS =
  "Photorealistic dental result for a real clinical photo. Keep the lips, skin, facial hair, tongue, lighting, shadows, camera angle and mouth opening exactly as in the original. Keep the same number of teeth and the same smile width. Natural enamel texture and translucency with subtle reflections, healthy pink gums, no text, no artifacts, no change outside the mouth.";

function instrucao(tipo: TipoGeracao, p: ParamsGeracao) {
  if (tipo === "lentes") {
    return `Replace the visible upper front teeth with porcelain veneers on the ${p.dentes || 8} most visible upper teeth: ${FORMATOS[p.formato || "oval"]}, harmonious proportions, symmetric about the dental midline, even incisal line following the lower lip, color ${CORES[p.cor || "BL2"]}. The remaining visible teeth should blend naturally with the new shade. ${REGRAS}`;
  }
  return `Show the same person's teeth after completed orthodontic treatment: perfectly aligned and leveled upper and lower teeth, closed gaps, no crowding or rotation, coordinated dental midlines, natural arch form. ${
    p.clarear ? "Teeth one to two shades brighter than the original." : "Keep the original tooth color and tooth shapes."
  } ${REGRAS}`;
}

async function chamarOpenAI(recorte: Buffer, mascara: Buffer, prompt: string, n: number) {
  const corpo = new FormData();
  corpo.append("model", process.env.OPENAI_IMAGE_MODEL || "gpt-image-1");
  corpo.append("prompt", prompt);
  corpo.append("n", String(n));
  corpo.append("size", "1024x1024");
  corpo.append("quality", process.env.OPENAI_IMAGE_QUALITY || "medium");
  corpo.append("image", new Blob([new Uint8Array(recorte)], { type: "image/png" }), "foto.png");
  corpo.append("mask", new Blob([new Uint8Array(mascara)], { type: "image/png" }), "mascara.png");
  const r = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: corpo,
    signal: AbortSignal.timeout(240_000),
  });
  const json = (await r.json().catch(() => ({}))) as {
    data?: { b64_json?: string; url?: string }[];
    usage?: unknown;
    error?: { message?: string };
  };
  if (!r.ok) throw new Error(json.error?.message || `OpenAI respondeu ${r.status}`);
  const imagens: Buffer[] = [];
  for (const d of json.data || []) {
    if (d.b64_json) imagens.push(Buffer.from(d.b64_json, "base64"));
    else if (d.url) imagens.push(Buffer.from(await (await fetch(d.url)).arrayBuffer()));
  }
  if (!imagens.length) throw new Error("A IA não devolveu imagens");
  return { imagens, uso: json.usage || {} };
}

export function criarGeracao(userId: string, planId: string, tipo: TipoGeracao, params: ParamsGeracao) {
  const id = novoId();
  rodar(
    "INSERT INTO generations (id, plan_id, user_id, tipo, params, status, criado_em) VALUES (?,?,?,?,?,?,?)",
    id,
    planId,
    userId,
    tipo,
    JSON.stringify(params),
    "processando",
    agora(),
  );
  return id;
}

export async function processarGeracao(id: string, boca: Ponto[]) {
  const g = um<{ id: string; plan_id: string; user_id: string; tipo: TipoGeracao; params: string }>(
    "SELECT * FROM generations WHERE id = ?",
    id,
  );
  if (!g) return;
  try {
    const plano = um<{ foto: string; patient_id: string }>("SELECT foto, patient_id FROM plans WHERE id = ?", g.plan_id);
    if (!plano?.foto) throw new Error("Plano sem foto");
    const foto = await lerArquivo(plano.foto);
    const { rec, recorte, mascara } = await prepararEdicao(foto, boca);
    const { imagens, uso } = await chamarOpenAI(recorte, mascara, instrucao(g.tipo, JSON.parse(g.params)), VARIACOES);
    const caminhos: string[] = [];
    for (let i = 0; i < imagens.length; i++) {
      const final = await comporResultado(foto, imagens[i], boca, rec);
      caminhos.push(await salvarArquivo(`${g.user_id}/${plano.patient_id}/${g.plan_id}/ia-${g.id}-${i + 1}.jpg`, final));
    }
    rodar(
      "UPDATE generations SET status = 'pronto', imagens = ?, uso = ?, concluido_em = ? WHERE id = ?",
      JSON.stringify(caminhos),
      JSON.stringify(uso),
      agora(),
      id,
    );
  } catch (e) {
    console.error("[ia] geração falhou", id, e);
    rodar(
      "UPDATE generations SET status = 'erro', erro = ?, concluido_em = ? WHERE id = ?",
      e instanceof Error ? e.message.slice(0, 300) : "erro",
      agora(),
      id,
    );
    estornarGeracao(g.user_id, id);
  }
}

export function recuperarGeracoesPresas() {
  const presas = todos<{ id: string; user_id: string }>(
    "SELECT id, user_id FROM generations WHERE status = 'processando' AND criado_em < ?",
    agora() - 6 * 60 * 1000,
  );
  for (const g of presas) {
    rodar("UPDATE generations SET status = 'erro', erro = 'interrompida', concluido_em = ? WHERE id = ?", agora(), g.id);
    estornarGeracao(g.user_id, g.id);
  }
}

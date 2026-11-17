import { randomBytes } from "node:crypto";
import { falha, json, usuarioDaApi } from "@/lib/api";
import { APP_URL } from "@/lib/config";
import { agora, evento, novoId, rodar, um } from "@/lib/db";
import { carimbar, lerArquivo, salvarArquivo } from "@/lib/imagem";

export async function POST(req: Request) {
  const u = await usuarioDaApi(req);
  if (u instanceof Response) return u;
  const c = (await req.json().catch(() => null)) as { planId?: string; titulo?: string; texto?: string; valor?: string } | null;
  const titulo = String(c?.titulo || "").trim().slice(0, 90);
  if (!c?.planId || titulo.length < 3) return falha("Dê um nome ao tratamento proposto.");
  const plano = um<{ id: string; patient_id: string; foto: string; resultado: string }>(
    "SELECT id, patient_id, foto, resultado FROM plans WHERE id = ? AND user_id = ?",
    c.planId,
    u.id,
  );
  if (!plano?.foto || !plano.resultado) return falha("Finalize a simulação antes de criar a proposta.");
  const id = novoId();
  const token = randomBytes(18).toString("base64url");
  const base = `${u.id}/${plano.patient_id}/${plano.id}/proposta-${id}`;
  const antes = await salvarArquivo(`${base}-antes.jpg`, await lerArquivo(plano.foto));
  const depois = await salvarArquivo(`${base}-depois.jpg`, await carimbar(await lerArquivo(plano.resultado)));
  rodar(
    "INSERT INTO proposals (id, plan_id, user_id, token, antes, depois, titulo, texto, valor, criado_em) VALUES (?,?,?,?,?,?,?,?,?,?)",
    id,
    plano.id,
    u.id,
    token,
    antes,
    depois,
    titulo,
    String(c.texto || "").trim().slice(0, 1500),
    String(c.valor || "").trim().slice(0, 40),
    agora(),
  );
  evento(u.id, "proposta_criada");
  return json({ id, token, url: `${APP_URL}/p/${token}` });
}

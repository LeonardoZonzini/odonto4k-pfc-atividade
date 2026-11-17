import { falha, json, precisaVerificarEmail, usuarioDaApi } from "@/lib/api";
import { dentroDoLimite } from "@/lib/auth";
import { acessoDe, debitarGeracao, saldoDe } from "@/lib/creditos";
import { evento, um } from "@/lib/db";
import { criarGeracao, iaDisponivel, ParamsGeracao, processarGeracao, TipoGeracao } from "@/lib/ia";
import { Ponto } from "@/lib/imagem";

export async function POST(req: Request) {
  const u = await usuarioDaApi(req);
  if (u instanceof Response) return u;
  const corpo = (await req.json().catch(() => null)) as {
    planId?: string;
    tipo?: TipoGeracao;
    params?: ParamsGeracao;
    boca?: Ponto[];
  } | null;
  if (!corpo?.planId || (corpo.tipo !== "lentes" && corpo.tipo !== "aparelho")) return falha("Pedido inválido.");
  const plano = um<{ id: string; foto: string; foto_w: number; foto_h: number }>(
    "SELECT id, foto, foto_w, foto_h FROM plans WHERE id = ? AND user_id = ?",
    corpo.planId,
    u.id,
  );
  if (!plano?.foto) return falha("Envie a foto do paciente antes de gerar.", 404);
  const boca = (corpo.boca || []).filter(
    (p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) && p[0] >= 0 && p[1] >= 0 && p[0] <= plano.foto_w && p[1] <= plano.foto_h,
  );
  if (boca.length < 8) return falha("Não encontramos o sorriso nesta foto. Use uma foto de rosto inteiro, sorrindo.");
  if (!acessoDe(u).ativo) return falha("Seu acesso está pausado. Escolha um plano para continuar.", 402, { paywall: true });
  if (precisaVerificarEmail(u)) return falha("Confirme seu e-mail para usar as simulações com IA. Enviamos o link no cadastro.", 403, { verificar: true });
  if (!iaDisponivel()) return falha("As simulações com IA estão indisponíveis no momento. Tente novamente em instantes.", 503);
  if (!dentroDoLimite(`gerar:${u.id}`, 12, 10 * 60 * 1000)) return falha("Muitas gerações em sequência. Aguarde alguns minutos.", 429);
  if (saldoDe(u.id).total < 1) return falha("Seus créditos acabaram.", 402, { paywall: true });
  const p = corpo.params || {};
  const params: ParamsGeracao = {
    formato: ["oval", "quadrado", "triangular"].includes(p.formato || "") ? p.formato : "oval",
    cor: ["BL1", "BL2", "A1", "B1"].includes(p.cor || "") ? p.cor : "BL2",
    dentes: [6, 8, 10].includes(p.dentes || 0) ? p.dentes : 8,
    clarear: Boolean(p.clarear),
  };
  const id = criarGeracao(u.id, plano.id, corpo.tipo, params);
  if (!debitarGeracao(u.id, id)) return falha("Seus créditos acabaram.", 402, { paywall: true });
  evento(u.id, "geracao", { tipo: corpo.tipo });
  void processarGeracao(id, boca);
  return json({ id, saldo: saldoDe(u.id).total });
}

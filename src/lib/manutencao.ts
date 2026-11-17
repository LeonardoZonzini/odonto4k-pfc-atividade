import "server-only";
import { agora, DIA, rodar, todos, um } from "./db";
import { RETENCAO_INATIVO_DIAS } from "./config";
import { acessoDe, Usuario } from "./creditos";
import { emailSequencia, SEQUENCIA_TESTE } from "./email";
import { recuperarGeracoesPresas } from "./ia";
import { apagarPasta } from "./imagem";

export async function apagarDadosClinicos(userId: string) {
  rodar("DELETE FROM proposals WHERE user_id = ?", userId);
  rodar("DELETE FROM generations WHERE user_id = ?", userId);
  rodar("DELETE FROM plans WHERE user_id = ?", userId);
  rodar("DELETE FROM patients WHERE user_id = ?", userId);
  await apagarPasta(userId).catch(() => {});
}

async function sequenciaDeTeste() {
  const t = agora();
  const emTeste = todos<Usuario>("SELECT * FROM users WHERE plano = 'teste' AND criado_em > ?", t - 8 * DIA);
  for (const u of emTeste) {
    for (const item of SEQUENCIA_TESTE) {
      const devido = u.criado_em + item.aposDias * DIA;
      if (t < devido || t > devido + DIA) continue;
      if (um("SELECT 1 AS ok FROM emails_enviados WHERE user_id = ? AND tipo = ?", u.id, item.tipo)) continue;
      rodar("INSERT INTO emails_enviados (user_id, tipo, criado_em) VALUES (?,?,?)", u.id, item.tipo, t);
      await emailSequencia(u.email, item);
    }
  }
}

async function limparInativos() {
  const limite = agora() - RETENCAO_INATIVO_DIAS * DIA;
  const inativos = todos<Usuario>("SELECT * FROM users WHERE inativo_desde > 0 AND inativo_desde < ?", limite);
  for (const u of inativos) {
    if (acessoDe(u).ativo) continue;
    if (!um("SELECT id FROM patients WHERE user_id = ? LIMIT 1", u.id)) continue;
    await apagarDadosClinicos(u.id);
  }
}

function marcarInativos() {
  const t = agora();
  const candidatos = todos<Usuario>("SELECT * FROM users WHERE inativo_desde = 0");
  for (const u of candidatos) if (!acessoDe(u).ativo) rodar("UPDATE users SET inativo_desde = ? WHERE id = ?", t, u.id);
}

export async function rodarManutencao() {
  try {
    recuperarGeracoesPresas();
    rodar("DELETE FROM sessions WHERE expira_em < ?", agora());
    rodar("DELETE FROM tokens WHERE expira_em < ?", agora() - DIA);
    marcarInativos();
    await sequenciaDeTeste();
    await limparInativos();
  } catch (e) {
    console.error("[manutencao]", e);
  }
}

export function iniciarManutencao() {
  const g = globalThis as typeof globalThis & { __o4kManutencao?: NodeJS.Timeout };
  if (g.__o4kManutencao) return;
  g.__o4kManutencao = setInterval(rodarManutencao, 60 * 60 * 1000);
  g.__o4kManutencao.unref?.();
  setTimeout(rodarManutencao, 15_000).unref?.();
}

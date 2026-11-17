import "server-only";
import { agora, DIA, rodar, transacao, um } from "./db";
import { CUSTO_GERACAO, PLANOS, PlanoId, TOLERANCIA_PAGAMENTO_DIAS } from "./config";

export type Usuario = {
  id: string;
  email: string;
  nome: string;
  whatsapp: string;
  email_verificado: number;
  clinica_nome: string;
  clinica_logo: string;
  perfil: string;
  onboarding_ok: number;
  tutorial_ok: number;
  plano: string;
  plano_status: string;
  plano_ciclo: string;
  pago_ate: number;
  proxima_recarga: number;
  teste_fim: number;
  inativo_desde: number;
  criado_em: number;
  ultimo_acesso: number;
};

export type Acesso = {
  ativo: boolean;
  tipo: "teste" | "plano" | "expirado";
  planoNome: string;
  ate: number;
  diasRestantes: number;
};

export function acessoDe(u: Usuario): Acesso {
  const t = agora();
  if (u.plano === "pro" || u.plano === "clinica") {
    const limite = u.pago_ate + TOLERANCIA_PAGAMENTO_DIAS * DIA;
    if (t < limite) {
      return {
        ativo: true,
        tipo: "plano",
        planoNome: PLANOS[u.plano as PlanoId].nome,
        ate: u.pago_ate,
        diasRestantes: Math.max(0, Math.ceil((u.pago_ate - t) / DIA)),
      };
    }
  }
  if (u.teste_fim > t && u.plano === "teste") {
    return {
      ativo: true,
      tipo: "teste",
      planoNome: "Teste gratuito",
      ate: u.teste_fim,
      diasRestantes: Math.max(1, Math.ceil((u.teste_fim - t) / DIA)),
    };
  }
  return { ativo: false, tipo: "expirado", planoNome: "Sem plano ativo", ate: 0, diasRestantes: 0 };
}

export function saldoDe(userId: string) {
  const l = um<{ plano: number; extra: number }>(
    `SELECT COALESCE(SUM(CASE WHEN bolsa='plano' THEN delta END),0) AS plano,
            COALESCE(SUM(CASE WHEN bolsa='extra' THEN delta END),0) AS extra
     FROM ledger WHERE user_id = ?`,
    userId,
  )!;
  return { plano: l.plano, extra: l.extra, total: l.plano + l.extra };
}

export function lancar(userId: string, bolsa: "plano" | "extra", delta: number, motivo: string, ref = "") {
  rodar(
    "INSERT INTO ledger (user_id, bolsa, delta, motivo, ref, criado_em) VALUES (?,?,?,?,?,?)",
    userId,
    bolsa,
    delta,
    motivo,
    ref,
    agora(),
  );
}

export function debitarGeracao(userId: string, ref: string): boolean {
  return transacao(() => {
    const s = saldoDe(userId);
    if (s.total < CUSTO_GERACAO) return false;
    lancar(userId, s.plano >= CUSTO_GERACAO ? "plano" : "extra", -CUSTO_GERACAO, "Simulação com IA", ref);
    return true;
  });
}

export function estornarGeracao(userId: string, ref: string) {
  const l = um<{ bolsa: string; delta: number }>(
    "SELECT bolsa, delta FROM ledger WHERE user_id = ? AND ref = ? AND delta < 0 ORDER BY id DESC LIMIT 1",
    userId,
    ref,
  );
  const jaEstornado = um("SELECT id FROM ledger WHERE user_id = ? AND ref = ? AND delta > 0", userId, ref);
  if (l && !jaEstornado) lancar(userId, l.bolsa as "plano" | "extra", -l.delta, "Estorno de simulação", ref);
}

function somarMes(ts: number) {
  const d = new Date(ts);
  d.setMonth(d.getMonth() + 1);
  return d.getTime();
}

export function sincronizarCreditos(u: Usuario): Usuario {
  if (u.plano !== "pro" && u.plano !== "clinica") return u;
  const t = agora();
  let mudou = false;
  let proxima = u.proxima_recarga || t;
  let voltas = 0;
  while (t >= proxima && proxima < u.pago_ate && voltas < 24) {
    const cota = PLANOS[u.plano as PlanoId].creditos;
    transacao(() => {
      const s = saldoDe(u.id);
      if (s.plano !== 0) lancar(u.id, "plano", -s.plano, "Fechamento do ciclo");
      lancar(u.id, "plano", cota, `Créditos do plano ${PLANOS[u.plano as PlanoId].nome}`);
    });
    proxima = somarMes(proxima);
    mudou = true;
    voltas++;
  }
  if (mudou) {
    rodar("UPDATE users SET proxima_recarga = ? WHERE id = ?", proxima, u.id);
    return { ...u, proxima_recarga: proxima };
  }
  return u;
}

export function marcarAtividade(u: Usuario) {
  const a = acessoDe(u);
  if (a.ativo && u.inativo_desde) rodar("UPDATE users SET inativo_desde = 0 WHERE id = ?", u.id);
  if (!a.ativo && !u.inativo_desde) rodar("UPDATE users SET inativo_desde = ? WHERE id = ?", agora(), u.id);
}

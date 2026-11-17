import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { agora, DIA, evento, rodar, todos, transacao, um } from "./db";
import { PACOTE, TOLERANCIA_PAGAMENTO_DIAS } from "./config";
import { lancar, saldoDe, sincronizarCreditos, Usuario } from "./creditos";

type Carga = {
  order_id?: string;
  order_status?: string;
  webhook_event_type?: string;
  Product?: { product_id?: string };
  Customer?: { email?: string };
  Subscription?: { next_payment?: string; plan?: { frequency?: string } };
};

export function assinaturaValida(corpo: string, assinatura: string | null) {
  const segredo = process.env.KIWIFY_WEBHOOK_TOKEN;
  if (!segredo || !assinatura) return false;
  const candidatos = [corpo];
  try {
    candidatos.push(JSON.stringify(JSON.parse(corpo)));
  } catch {}
  return candidatos.some((c) => {
    const esperado = Buffer.from(createHmac("sha1", segredo).update(c).digest("hex"));
    const recebido = Buffer.from(assinatura);
    return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
  });
}

function itemDoProduto(id?: string): "pro" | "clinica" | "pacote" | null {
  if (!id) return null;
  if (id === process.env.KIWIFY_PRODUTO_PRO) return "pro";
  if (id === process.env.KIWIFY_PRODUTO_CLINICA) return "clinica";
  if (id === process.env.KIWIFY_PRODUTO_PACOTE) return "pacote";
  return null;
}

function tipoDoEvento(c: Carga): "pago" | "cancelado" | "atrasado" | "estornado" | null {
  const e = (c.webhook_event_type || "").toLowerCase();
  const s = (c.order_status || "").toLowerCase();
  if (e === "order_approved" || e === "subscription_renewed" || (!e && s === "paid")) return "pago";
  if (e === "subscription_canceled") return "cancelado";
  if (e === "subscription_late") return "atrasado";
  if (e === "order_refunded" || e === "chargeback" || s === "refunded" || s === "chargedback") return "estornado";
  return null;
}

function aplicar(u: Usuario, item: "pro" | "clinica" | "pacote", tipo: NonNullable<ReturnType<typeof tipoDoEvento>>, c: Carga) {
  const t = agora();
  if (item === "pacote") {
    if (tipo === "pago") lancar(u.id, "extra", PACOTE.creditos, "Pacote de créditos", c.order_id || "");
    if (tipo === "estornado") {
      const s = saldoDe(u.id);
      const tirar = Math.min(PACOTE.creditos, Math.max(0, s.extra));
      if (tirar) lancar(u.id, "extra", -tirar, "Estorno do pacote", c.order_id || "");
    }
    return;
  }
  if (tipo === "pago") {
    const anual = /year|annual|anual/i.test(c.Subscription?.plan?.frequency || "");
    const proximo = Date.parse(c.Subscription?.next_payment || "");
    const d = new Date(t);
    if (anual) d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
    const pagoAte = Number.isFinite(proximo) && proximo > t ? proximo : d.getTime();
    const estavaAtivo = u.plano === item && t < u.pago_ate + TOLERANCIA_PAGAMENTO_DIAS * DIA;
    rodar(
      "UPDATE users SET plano = ?, plano_status = 'ativo', plano_ciclo = ?, pago_ate = ?, proxima_recarga = ?, inativo_desde = 0 WHERE id = ?",
      item,
      anual ? "anual" : "mensal",
      pagoAte,
      estavaAtivo && u.proxima_recarga ? Math.min(u.proxima_recarga, t) : t,
      u.id,
    );
    const novo = um<Usuario>("SELECT * FROM users WHERE id = ?", u.id)!;
    sincronizarCreditos(novo);
    evento(u.id, "assinatura_paga", { item, anual });
    return;
  }
  if (u.plano !== item) return;
  if (tipo === "cancelado") {
    rodar("UPDATE users SET plano_status = 'cancelado' WHERE id = ?", u.id);
    evento(u.id, "assinatura_cancelada", { item });
  }
  if (tipo === "atrasado") rodar("UPDATE users SET plano_status = 'atrasado' WHERE id = ?", u.id);
  if (tipo === "estornado") {
    transacao(() => {
      rodar(
        "UPDATE users SET plano_status = 'cancelado', pago_ate = ? WHERE id = ?",
        t - TOLERANCIA_PAGAMENTO_DIAS * DIA,
        u.id,
      );
      const s = saldoDe(u.id);
      if (s.plano > 0) lancar(u.id, "plano", -s.plano, "Estorno da assinatura", c.order_id || "");
    });
    evento(u.id, "assinatura_estornada", { item });
  }
}

export function processarKiwify(c: Carga): string {
  const tipo = tipoDoEvento(c);
  const item = itemDoProduto(c.Product?.product_id);
  const email = (c.Customer?.email || "").trim().toLowerCase();
  if (!tipo || !item || !email) return "ignorado";
  const chave = `${c.order_id || email}:${c.webhook_event_type || c.order_status}:${c.Subscription?.next_payment || ""}`;
  if (um("SELECT id FROM kiwify_eventos WHERE id = ?", chave)) return "repetido";
  // Só marca o evento como visto depois de aplicar: se der erro no meio, a Kiwify reenvia e o pagamento não se perde.
  const visto = () => rodar("INSERT OR IGNORE INTO kiwify_eventos (id, criado_em) VALUES (?,?)", chave, agora());
  const u = um<Usuario>("SELECT * FROM users WHERE email = ?", email);
  if (!u) {
    rodar("INSERT INTO compras_pendentes (email, dados, criado_em) VALUES (?,?,?)", email, JSON.stringify(c), agora());
    visto();
    return "pendente";
  }
  aplicar(u, item, tipo, c);
  visto();
  return "aplicado";
}

export function aplicarComprasPendentes(email: string) {
  const pendentes = todos<{ id: number; dados: string }>(
    "SELECT id, dados FROM compras_pendentes WHERE email = ? AND aplicado_em = 0 ORDER BY id",
    email.toLowerCase(),
  );
  for (const p of pendentes) {
    const u = um<Usuario>("SELECT * FROM users WHERE email = ?", email.toLowerCase());
    if (!u) return;
    const c = JSON.parse(p.dados) as Carga;
    const tipo = tipoDoEvento(c);
    const item = itemDoProduto(c.Product?.product_id);
    if (tipo && item) aplicar(u, item, tipo, c);
    rodar("UPDATE compras_pendentes SET aplicado_em = ? WHERE id = ?", agora(), p.id);
  }
}

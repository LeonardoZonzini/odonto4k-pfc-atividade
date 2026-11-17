import { exigirUsuario } from "@/lib/auth";
import { PACOTE, PLANOS, reais, TESTE } from "@/lib/config";
import { acessoDe, saldoDe } from "@/lib/creditos";
import { todos } from "@/lib/db";
import { Planos } from "@/components/Planos";
import { Contagem } from "@/components/Efeitos";

export const metadata = { title: "Planos e créditos" };

export default async function Creditos() {
  const u = await exigirUsuario();
  const acesso = acessoDe(u);
  const saldo = saldoDe(u.id);
  const historico = todos<{ id: number; delta: number; motivo: string; criado_em: number }>(
    "SELECT id, delta, motivo, criado_em FROM ledger WHERE user_id = ? ORDER BY id DESC LIMIT 30",
    u.id,
  );
  const planos = Object.values(PLANOS).map((p) => ({
    id: p.id,
    nome: p.nome,
    mensal: reais(p.mensal),
    anual: reais(p.anual),
    anualMes: reais(Math.round((p.anual / 12) * 100) / 100),
    creditos: p.creditos,
    resumo: p.resumo,
    itens: p.itens,
  }));
  const data = (ts: number) => new Date(ts).toLocaleDateString("pt-BR");
  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="kick">Planos e créditos</span>
        <h1>Seus créditos</h1>
      </div>

      <div className="card gold">
        <div className="flex items-end gap-3">
          <Contagem valor={saldo.total} className="font-display text-[52px] font-bold leading-none text-gold" />
          <span className="note pb-1.5">créditos de IA disponíveis</span>
        </div>
        <div className="chips">
          <span>
            {acesso.tipo === "teste" ? "Teste" : "Plano"}: <b>{saldo.plano}</b>
          </span>
          <span>
            Avulsos: <b>{saldo.extra}</b>
          </span>
        </div>
        <p className="text-[14.5px] text-[var(--ok-2)]">
          {acesso.tipo === "teste" && `Teste gratuito até ${data(acesso.ate)}. Faltam ${acesso.diasRestantes} ${acesso.diasRestantes === 1 ? "dia" : "dias"}.`}
          {acesso.tipo === "plano" &&
            (u.plano_status === "cancelado"
              ? `Plano ${acesso.planoNome} cancelado. O acesso continua até ${data(acesso.ate)}.`
              : `Plano ${acesso.planoNome} ativo. Próxima cobrança em ${data(acesso.ate)}.`)}
          {acesso.tipo === "expirado" && "Seu acesso está pausado. Escolha um plano para voltar a simular."}
        </p>
        <p className="note">
          Cada geração com IA (lentes ou alinhamento) usa 1 crédito e entrega 3 versões. Clareamento, análise do sorriso, comparação e propostas não gastam
          créditos.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <span className="kick">{acesso.tipo === "plano" ? "Mudar de plano" : "Escolha seu plano"}</span>
        <Planos planos={planos} atual={acesso.tipo === "plano" ? u.plano : ""} pacote={acesso.tipo === "plano" ? { creditos: PACOTE.creditos, preco: reais(PACOTE.preco) } : null} />
        <p className="note text-center">Pagamento seguro pela Kiwify. Cancele quando quiser.</p>
      </section>

      {acesso.tipo === "plano" && (
        <section className="card">
          <h3>Gerenciar assinatura</h3>
          <p className="text-[14.5px] text-muted">
            A cobrança e o cancelamento são feitos pela Kiwify, no e-mail usado na compra. Se precisar de ajuda, chame o suporte na tela Conta.
          </p>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <span className="kick">Histórico</span>
        <div className="card !p-0">
          {historico.length === 0 && <p className="note p-4">Ainda não há movimentações. O teste começa com {TESTE.creditos} créditos.</p>}
          {historico.map((h) => (
            <div key={h.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px]">{h.motivo}</span>
                <span className="note">{data(h.criado_em)}</span>
              </span>
              <b className={`font-mono text-[15px] ${h.delta > 0 ? "text-gold" : "text-muted"}`}>
                {h.delta > 0 ? "+" : ""}
                {h.delta}
              </b>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

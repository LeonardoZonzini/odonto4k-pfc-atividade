import Link from "next/link";
import { adminCreditos, adminPlano, adminTicket } from "@/app/acoes";
import { exigirAdmin } from "@/lib/auth";
import { acessoDe, saldoDe, Usuario } from "@/lib/creditos";
import { agora, DIA, todos, um } from "@/lib/db";
import { iaDisponivel } from "@/lib/ia";

export const metadata = { title: "Administração", robots: { index: false } };

export default async function Admin({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await exigirAdmin();
  const { q = "" } = await searchParams;
  const t = agora();
  const n = (sql: string, ...p: (string | number)[]) => um<{ n: number }>(sql, ...p)!.n;
  const usuarios = todos<Usuario>(
    "SELECT * FROM users WHERE email LIKE ? OR nome LIKE ? ORDER BY criado_em DESC LIMIT 60",
    `%${q}%`,
    `%${q}%`,
  );
  const todosUsuarios = todos<Usuario>("SELECT * FROM users");
  const pagantes = todosUsuarios.filter((u) => acessoDe(u).tipo === "plano").length;
  const emTeste = todosUsuarios.filter((u) => acessoDe(u).tipo === "teste").length;
  const numeros = [
    ["Contas", todosUsuarios.length],
    ["Pagantes", pagantes],
    ["Em teste", emTeste],
    ["Cadastros 7d", n("SELECT COUNT(*) AS n FROM users WHERE criado_em > ?", t - 7 * DIA)],
    ["Gerações IA 24h", n("SELECT COUNT(*) AS n FROM generations WHERE criado_em > ?", t - DIA)],
    ["Gerações IA 30d", n("SELECT COUNT(*) AS n FROM generations WHERE criado_em > ?", t - 30 * DIA)],
    ["Falhas IA 30d", n("SELECT COUNT(*) AS n FROM generations WHERE status = 'erro' AND criado_em > ?", t - 30 * DIA)],
    ["Propostas 30d", n("SELECT COUNT(*) AS n FROM proposals WHERE criado_em > ?", t - 30 * DIA)],
    ["Pacientes", n("SELECT COUNT(*) AS n FROM patients")],
  ] as const;
  const tickets = todos<{ id: number; assunto: string; mensagem: string; status: string; criado_em: number; email: string; nome: string }>(
    "SELECT t.*, u.email, u.nome FROM tickets t LEFT JOIN users u ON u.id = t.user_id ORDER BY (t.status = 'aberto') DESC, t.id DESC LIMIT 30",
  );
  const funil = todos<{ nome: string; n: number }>(
    "SELECT nome, COUNT(*) AS n FROM events WHERE criado_em > ? GROUP BY nome ORDER BY n DESC LIMIT 20",
    t - 30 * DIA,
  );
  const servicos = [
    ["IA (OpenAI)", iaDisponivel()],
    ["E-mail (Resend)", Boolean(process.env.RESEND_API_KEY)],
    ["Webhook Kiwify", Boolean(process.env.KIWIFY_WEBHOOK_TOKEN)],
    ["Links de checkout", Boolean(process.env.KIWIFY_LINK_PRO_MENSAL && process.env.KIWIFY_LINK_CLINICA_MENSAL)],
  ] as const;
  const data = (ts: number) => (ts ? new Date(ts).toLocaleDateString("pt-BR") : "—");
  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 py-6">
      <header className="flex items-center gap-3">
        <Link href="/app" className="brand flex-1">
          Odonto <span>4K</span> · Admin
        </Link>
        <Link href="/app" className="btn sm dark">
          Voltar ao app
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {numeros.map(([rotulo, valor]) => (
          <div key={rotulo} className="card !gap-1">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[.1em] text-muted">{rotulo}</span>
            <span className="font-display text-[28px] font-bold text-gold">{valor}</span>
          </div>
        ))}
      </section>

      <section className="card">
        <h3>Serviços</h3>
        <div className="chips">
          {servicos.map(([nome, ok]) => (
            <span key={nome} style={ok ? undefined : { borderColor: "var(--alert)", background: "transparent" }}>
              {nome}: <b style={ok ? undefined : { color: "#ff8a92" }}>{ok ? "ligado" : "desligado"}</b>
            </span>
          ))}
        </div>
      </section>

      <section className="card overflow-x-auto">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="flex-1">Contas</h3>
          <form className="flex gap-2">
            <input name="q" defaultValue={q} placeholder="Buscar por nome ou e-mail" className="rounded-lg border border-line bg-black px-3 py-2 text-[14px]" />
            <button className="btn sm dark">Buscar</button>
          </form>
        </div>
        <table className="tabela">
          <thead>
            <tr>
              <th>Conta</th>
              <th>Acesso</th>
              <th>Créditos</th>
              <th>Cadastro</th>
              <th>Último acesso</th>
              <th>Ajustar créditos</th>
              <th>Definir plano</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => {
              const a = acessoDe(u);
              return (
                <tr key={u.id}>
                  <td>
                    <b>{u.nome}</b>
                    <br />
                    <span className="note">
                      {u.email}
                      {u.email_verificado ? " ✓" : ""}
                    </span>
                    <br />
                    <span className="note">{u.whatsapp}</span>
                  </td>
                  <td>
                    <span className={`tag ${a.ativo ? "gold" : "alert"}`}>{a.planoNome}</span>
                    <br />
                    <span className="note">{a.ativo ? `até ${data(a.ate)}` : ""}</span>
                  </td>
                  <td className="font-mono">{saldoDe(u.id).total}</td>
                  <td>{data(u.criado_em)}</td>
                  <td>{data(u.ultimo_acesso)}</td>
                  <td>
                    <form action={adminCreditos} className="flex gap-1">
                      <input type="hidden" name="usuario" value={u.id} />
                      <input name="quantidade" type="number" defaultValue={10} className="w-16 rounded border border-line bg-black px-2 py-1" />
                      <button className="btn sm dark !px-2 !py-1">Lançar</button>
                    </form>
                  </td>
                  <td>
                    <form action={adminPlano} className="flex gap-1">
                      <input type="hidden" name="usuario" value={u.id} />
                      <select name="plano" defaultValue="pro" className="rounded border border-line bg-black px-1 py-1">
                        <option value="teste">Teste</option>
                        <option value="pro">Pro</option>
                        <option value="clinica">Clínica</option>
                      </select>
                      <input name="dias" type="number" defaultValue={30} className="w-14 rounded border border-line bg-black px-2 py-1" aria-label="Dias" />
                      <button className="btn sm dark !px-2 !py-1">Aplicar</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h3>Suporte</h3>
        {tickets.length === 0 && <p className="note">Nenhuma mensagem.</p>}
        {tickets.map((tk) => (
          <div key={tk.id} className="flex flex-col gap-1 border-b border-line py-3 last:border-b-0">
            <div className="flex flex-wrap items-center gap-2">
              <b className="flex-1">{tk.assunto}</b>
              <span className={`tag ${tk.status === "aberto" ? "alert" : ""}`}>{tk.status}</span>
              <form action={adminTicket}>
                <input type="hidden" name="ticket" value={tk.id} />
                <input type="hidden" name="status" value={tk.status === "aberto" ? "resolvido" : "aberto"} />
                <button className="btn sm dark !px-2 !py-1">{tk.status === "aberto" ? "Marcar resolvido" : "Reabrir"}</button>
              </form>
            </div>
            <span className="note">
              {tk.nome} · {tk.email} · {data(tk.criado_em)}
            </span>
            <p className="whitespace-pre-wrap text-[14.5px] text-[var(--ok-2)]">{tk.mensagem}</p>
          </div>
        ))}
      </section>

      <section className="card">
        <h3>Uso nos últimos 30 dias</h3>
        <div className="chips">
          {funil.map((f) => (
            <span key={f.nome}>
              {f.nome}: <b>{f.n}</b>
            </span>
          ))}
          {funil.length === 0 && <span>Sem eventos ainda</span>}
        </div>
      </section>
    </div>
  );
}

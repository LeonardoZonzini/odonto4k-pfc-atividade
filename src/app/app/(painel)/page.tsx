import Link from "next/link";
import { exigirUsuario } from "@/lib/auth";
import { acessoDe, saldoDe } from "@/lib/creditos";
import { todos } from "@/lib/db";
import { Tutorial } from "@/components/Tutorial";
import { Avatar } from "@/components/Abertura";
import { Anel, Contagem } from "@/components/Efeitos";
import { primeiroNome, TESTE } from "@/lib/config";

const FERRAMENTAS = [
  { modo: "clareamento", img: "/cards/g1.jpg", nome: "Clareamento", texto: "Seis níveis, na hora", selo: "Livre" },
  { modo: "lentes", img: "/cards/g6.jpg", nome: "Lentes", texto: "Formato e cor por IA", selo: "1 crédito" },
  { modo: "aparelho", img: "/cards/g7.jpg", nome: "Alinhamento", texto: "Depois do aparelho, por IA", selo: "1 crédito" },
  { modo: "analise", img: "/cards/g4.jpg", nome: "Análise do sorriso", texto: "Seis medidas na foto", selo: "Livre" },
];

function saudacao() {
  const h = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export default async function Inicio() {
  const u = await exigirUsuario();
  const acesso = acessoDe(u);
  const saldo = saldoDe(u.id);
  const recentes = todos<{ id: string; nome: string; plano: string | null; foto: string | null; resultado: string | null; atualizado: number | null }>(
    `SELECT p.id, p.nome,
       (SELECT id FROM plans WHERE patient_id = p.id ORDER BY atualizado_em DESC LIMIT 1) AS plano,
       (SELECT foto FROM plans WHERE patient_id = p.id ORDER BY atualizado_em DESC LIMIT 1) AS foto,
       (SELECT resultado FROM plans WHERE patient_id = p.id ORDER BY atualizado_em DESC LIMIT 1) AS resultado,
       (SELECT atualizado_em FROM plans WHERE patient_id = p.id ORDER BY atualizado_em DESC LIMIT 1) AS atualizado
     FROM patients p WHERE p.user_id = ? ORDER BY atualizado DESC LIMIT 4`,
    u.id,
  );
  const primeiro = primeiroNome(u.nome);
  return (
    <>
      {!u.tutorial_ok && <Tutorial />}
      <div className="identidade">
        <Link href="/app/conta" aria-label="Sua conta e sua marca" className="no-underline">
          <Avatar logo={u.clinica_logo} nome={u.clinica_nome || u.nome} />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="kick truncate">{u.clinica_nome || acesso.planoNome}</span>
          <h1 className="!text-[26px]">
            {saudacao()}, <span className="hl">{primeiro}</span>
          </h1>
        </div>
      </div>

      {acesso.ativo ? (
        <div className="card gold !flex-row items-center !gap-4">
          <div className="flex flex-1 flex-col">
            <span className="font-mono text-[11px] font-bold uppercase tracking-[.1em] text-muted">Créditos de IA</span>
            <Contagem valor={saldo.total} className="font-display text-[34px] font-bold leading-none text-gold" />
            <span className="note mt-1">
              {acesso.tipo === "teste"
                ? "no teste gratuito"
                : `Plano ${acesso.planoNome} ativo`}
            </span>
          </div>
          {acesso.tipo === "teste" && (
            <Anel porcento={(acesso.diasRestantes / TESTE.dias) * 100}>
              <span className="flex flex-col items-center leading-none">
                <b className="font-display text-[20px] text-gold">{acesso.diasRestantes}</b>
                <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-muted">{acesso.diasRestantes === 1 ? "dia" : "dias"}</span>
              </span>
            </Anel>
          )}
          <Link href="/app/creditos" className={`btn sm ${acesso.tipo === "teste" ? "ok" : "vi"}`}>
            {acesso.tipo === "teste" ? "Planos" : "Créditos"}
          </Link>
        </div>
      ) : (
        <div className="card alert">
          <h3>Seu acesso está pausado</h3>
          <p className="text-[15px] text-[var(--ok-2)]">
            Seus pacientes e planos continuam guardados. Escolha um plano para voltar a simular e enviar propostas.
          </p>
          <Link href="/app/creditos" className="btn ok">
            Escolher plano
          </Link>
        </div>
      )}

      <Link href="/app/pacientes/novo" className="btn shine">
        Novo paciente
      </Link>

      <section className="flex flex-col gap-3">
        <span className="kick">Ferramentas</span>
        <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3">
          {FERRAMENTAS.map((f) => (
            <Link key={f.modo} href={`/app/pacientes/novo?modo=${f.modo}`} className="tool">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.img} alt="" />
              <span className="sel">{f.selo}</span>
              <span className="txt">
                <b>{f.nome}</b>
                <span>{f.texto}</span>
              </span>
            </Link>
          ))}
          <Link href="/app/melhorar-foto" className="tool">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/cards/g3.jpg" alt="" />
            <span className="sel">Livre</span>
            <span className="txt">
              <b>Melhorar foto</b>
              <span>Cor, luz e nitidez em 1 toque</span>
            </span>
          </Link>
          <Link href="/app/pacientes" className="tool">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/cards/g5.jpg" alt="" />
            <span className="txt">
              <b>Meus pacientes</b>
              <span>Casos, planos e propostas</span>
            </span>
          </Link>
        </div>
      </section>

      {recentes.length > 0 && (
        <section className="flex flex-col gap-3">
          <span className="kick">Últimos pacientes</span>
          <div className="stagger flex flex-col gap-2">
            {recentes.map((p) => (
              <Link
                key={p.id}
                href={p.plano ? `/app/estudio/${p.plano}` : `/app/pacientes/${p.id}`}
                className="card !flex-row items-center !gap-3 !p-3 no-underline transition-colors hover:border-gold-deep"
              >
                <span className="h-14 w-14 flex-none overflow-hidden rounded-lg border border-line bg-black">
                  {(p.resultado || p.foto) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/arquivos/${p.resultado || p.foto}?v=${p.atualizado}`} alt="" className="h-full w-full object-cover" />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="truncate font-display text-[16px]">{p.nome}</b>
                  <span className="note">{p.atualizado ? new Date(p.atualizado).toLocaleDateString("pt-BR") : ""}</span>
                </span>
                <span className="font-mono text-gold">›</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

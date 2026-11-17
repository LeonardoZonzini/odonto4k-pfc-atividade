import Link from "next/link";
import { notFound } from "next/navigation";
import { apagarPaciente, apagarPlano, novoPlano, renomearPlano } from "@/app/acoes";
import { exigirUsuario } from "@/lib/auth";
import { acessoDe } from "@/lib/creditos";
import { todos, um } from "@/lib/db";
import { Confirmar } from "@/components/ui";
import { IcLixo, IcVoltar } from "@/components/Icones";

export const metadata = { title: "Paciente" };

export default async function Paciente({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigirUsuario();
  const { id } = await params;
  const p = um<{ id: string; nome: string; nascimento: string; whatsapp: string; criado_em: number }>(
    "SELECT id, nome, nascimento, whatsapp, criado_em FROM patients WHERE id = ? AND user_id = ?",
    id,
    u.id,
  );
  if (!p) notFound();
  const planos = todos<{ id: string; nome: string; foto: string; resultado: string; atualizado_em: number; propostas: number; visualizacoes: number }>(
    `SELECT pl.id, pl.nome, pl.foto, pl.resultado, pl.atualizado_em,
       (SELECT COUNT(*) FROM proposals WHERE plan_id = pl.id) AS propostas,
       (SELECT COALESCE(SUM(visualizacoes),0) FROM proposals WHERE plan_id = pl.id) AS visualizacoes
     FROM plans pl WHERE pl.patient_id = ? ORDER BY pl.criado_em DESC`,
    id,
  );
  const ativo = acessoDe(u).ativo;
  return (
    <>
      <Link href="/app/pacientes" className="note flex items-center gap-1 no-underline">
        <IcVoltar className="h-4 w-4" /> Pacientes
      </Link>
      <div className="flex flex-col gap-1">
        <span className="kick">Paciente</span>
        <h1>{p.nome}</h1>
        <p className="note">
          Cadastrado em {new Date(p.criado_em).toLocaleDateString("pt-BR")}
          {p.nascimento ? ` · Nascimento ${p.nascimento.split("-").reverse().join("/")}` : ""}
        </p>
      </div>

      {ativo && (
        <form action={novoPlano}>
          <input type="hidden" name="paciente" value={p.id} />
          <button className="btn">Novo plano de tratamento</button>
        </form>
      )}

      <section className="flex flex-col gap-3">
        <span className="kick">Planos</span>
        {planos.length === 0 && <p className="note">Este paciente ainda não tem planos.</p>}
        {planos.map((pl) => (
          <div key={pl.id} className="card !gap-3">
            <div className="flex gap-3">
              <Link href={`/app/estudio/${pl.id}`} className="h-24 w-24 flex-none overflow-hidden rounded-lg border border-line bg-black">
                {(pl.resultado || pl.foto) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/arquivos/${pl.resultado || pl.foto}?v=${pl.atualizado_em}`} alt="" className="h-full w-full object-cover" />
                )}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <form action={renomearPlano} className="flex gap-2">
                  <input type="hidden" name="plano" value={pl.id} />
                  <input
                    name="nome"
                    defaultValue={pl.nome}
                    maxLength={60}
                    aria-label="Nome do plano"
                    className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 font-display text-[17px] font-bold hover:border-line focus:border-gold focus:outline-none"
                  />
                  <button className="font-mono text-[11px] font-bold uppercase tracking-wider text-gold">Salvar</button>
                </form>
                <span className="note">Editado em {new Date(pl.atualizado_em).toLocaleDateString("pt-BR")}</span>
                <div className="chips">
                  <span>
                    <b>{pl.propostas}</b> {pl.propostas === 1 ? "proposta" : "propostas"}
                  </span>
                  {pl.propostas > 0 && (
                    <span>
                      <b>{pl.visualizacoes}</b> {pl.visualizacoes === 1 ? "visualização" : "visualizações"}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href={`/app/estudio/${pl.id}`} className="btn sm flex-1">
                Abrir
              </Link>
              <Confirmar
                rotulo={<IcLixo className="h-4 w-4" />}
                pergunta={`Apagar “${pl.nome}”? As simulações e propostas deste plano serão removidas.`}
                confirmar="Apagar plano"
                acao={apagarPlano}
                campos={{ plano: pl.id }}
              />
            </div>
          </div>
        ))}
      </section>

      <Confirmar
        rotulo="Apagar paciente"
        classe="btn ghost"
        pergunta={`Apagar ${p.nome}? Todas as fotos, planos e propostas deste paciente serão removidos de forma definitiva.`}
        confirmar="Apagar paciente"
        acao={apagarPaciente}
        campos={{ paciente: p.id }}
      />
    </>
  );
}

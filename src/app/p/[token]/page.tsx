import { notFound } from "next/navigation";
import { headers } from "next/headers";
import sharp from "sharp";
import { usuarioAtual } from "@/lib/auth";
import { rodar, um } from "@/lib/db";
import { lerArquivo } from "@/lib/imagem";
import { Comparador } from "@/components/ui";

type Linha = {
  id: string; user_id: string; antes: string; titulo: string; texto: string; valor: string; criado_em: number;
  paciente: string; dentista: string; whatsapp: string; clinica_nome: string; clinica_logo: string;
};

function buscar(token: string) {
  return um<Linha>(
    `SELECT pr.id, pr.user_id, pr.antes, pr.titulo, pr.texto, pr.valor, pr.criado_em, pa.nome AS paciente,
            u.nome AS dentista, u.whatsapp, u.clinica_nome, u.clinica_logo
     FROM proposals pr JOIN plans pl ON pl.id = pr.plan_id JOIN patients pa ON pa.id = pl.patient_id
     JOIN users u ON u.id = pr.user_id WHERE pr.token = ?`,
    token,
  );
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const p = buscar((await params).token);
  return { title: p ? `Proposta de ${p.clinica_nome || p.dentista}` : "Proposta", robots: { index: false } };
}

export default async function Proposta({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = buscar(token);
  if (!p) notFound();
  const visitante = await usuarioAtual();
  // A prévia de link do WhatsApp e de outros apps abre a página sozinha; isso não é o paciente vendo.
  const robo = /bot|crawler|spider|preview|whatsapp|facebookexternalhit|telegram|slack|discord/i.test((await headers()).get("user-agent") || "");
  if (!robo && visitante?.id !== p.user_id) rodar("UPDATE proposals SET visualizacoes = visualizacoes + 1 WHERE id = ?", p.id);
  const meta = await sharp(await lerArquivo(p.antes)).metadata();
  const proporcao = (meta.width || 4) / (meta.height || 5);
  const primeiro = p.paciente.split(" ")[0];
  const marca = p.clinica_nome || p.dentista;
  const mensagem = `Olá! Vi a proposta "${p.titulo}" e quero agendar.`;
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col gap-5 px-4 pb-12 pt-6">
      <header className="flex items-center gap-3 border-b border-line pb-4">
        {p.clinica_logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/p/${token}/logo`} alt="" className="h-12 w-12 flex-none rounded-lg bg-white object-contain p-1" />
        )}
        <div className="flex min-w-0 flex-col">
          <b className="truncate font-display text-[19px]">{marca}</b>
          {p.clinica_nome && <span className="note truncate">{p.dentista}</span>}
        </div>
      </header>

      <div className="entra flex flex-col gap-2">
        <span className="kick">Proposta para {primeiro}</span>
        <h1>{p.titulo}</h1>
      </div>

      <Comparador antes={`/api/p/${token}/antes`} depois={`/api/p/${token}/depois`} proporcao={proporcao} />
      <p className="note text-center font-mono">Arraste a linha dourada para comparar</p>

      {p.texto && (
        <div className="card">
          <p className="whitespace-pre-wrap text-[16px] text-[var(--ok-2)]">{p.texto}</p>
        </div>
      )}

      {p.valor && (
        <div className="card gold price text-center">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[.14em] text-muted">Investimento</span>
          <span className="big !text-[38px]">{p.valor}</span>
        </div>
      )}

      {p.whatsapp && (
        <a className="btn ok shine" href={`https://wa.me/${p.whatsapp}?text=${encodeURIComponent(mensagem)}`} target="_blank" rel="noreferrer">
          Agendar pelo WhatsApp
        </a>
      )}
      <a className="btn dark" href={`/api/p/${token}/proposta.pdf`} target="_blank" rel="noreferrer">
        Baixar em PDF
      </a>

      <p className="note text-center">
        A imagem de “depois” é uma simulação ilustrativa gerada por computador. Não representa promessa nem garantia de resultado. O resultado real depende de
        avaliação clínica e do plano de tratamento definido pelo cirurgião-dentista.
      </p>
      <p className="text-center font-mono text-[10px] uppercase tracking-[.14em] text-muted">
        Feito com Odonto <span className="text-gold">4K</span>
      </p>
    </div>
  );
}

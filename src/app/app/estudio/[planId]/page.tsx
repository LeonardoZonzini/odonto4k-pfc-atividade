import { notFound } from "next/navigation";
import { exigirUsuario } from "@/lib/auth";
import { APP_URL } from "@/lib/config";
import { acessoDe, saldoDe } from "@/lib/creditos";
import { todos, um } from "@/lib/db";
import { Estudio } from "@/components/estudio/Estudio";

export const metadata = { title: "Estúdio" };

export default async function PaginaEstudio({
  params,
  searchParams,
}: {
  params: Promise<{ planId: string }>;
  searchParams: Promise<{ modo?: string }>;
}) {
  const u = await exigirUsuario();
  const { planId } = await params;
  const { modo = "" } = await searchParams;
  const plano = um<{ id: string; patient_id: string; nome: string; foto: string; foto_w: number; foto_h: number; estado: string; atualizado_em: number }>(
    "SELECT * FROM plans WHERE id = ? AND user_id = ?",
    planId,
    u.id,
  );
  if (!plano) notFound();
  const paciente = um<{ id: string; nome: string; whatsapp: string }>("SELECT id, nome, whatsapp FROM patients WHERE id = ?", plano.patient_id)!;
  const geracoes = todos<{ id: string; tipo: "lentes" | "aparelho"; params: string; imagens: string; criado_em: number }>(
    "SELECT id, tipo, params, imagens, criado_em FROM generations WHERE plan_id = ? AND status = 'pronto' ORDER BY criado_em DESC",
    planId,
  ).map((g) => ({ ...g, params: JSON.parse(g.params), imagens: JSON.parse(g.imagens) as string[] }));
  const propostas = todos<{ id: string; token: string; titulo: string; valor: string; visualizacoes: number; criado_em: number }>(
    "SELECT id, token, titulo, valor, visualizacoes, criado_em FROM proposals WHERE plan_id = ? ORDER BY criado_em DESC",
    planId,
  );
  let estado = {};
  try {
    estado = JSON.parse(plano.estado || "{}");
  } catch {}
  return (
    <Estudio
      plano={{
        id: plano.id,
        nome: plano.nome,
        foto: plano.foto ? { caminho: plano.foto, largura: plano.foto_w, altura: plano.foto_h, v: plano.atualizado_em } : null,
        estado,
      }}
      paciente={paciente}
      geracoes={geracoes}
      propostas={propostas}
      saldoInicial={saldoDe(u.id).total}
      acessoAtivo={acessoDe(u).ativo}
      modoInicial={modo}
      marca={u.clinica_nome || u.nome}
      appUrl={APP_URL}
    />
  );
}

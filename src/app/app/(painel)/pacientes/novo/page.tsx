import Link from "next/link";
import { criarPaciente } from "@/app/acoes";
import { exigirUsuario } from "@/lib/auth";
import { acessoDe } from "@/lib/creditos";
import { Formulario } from "@/components/ui";

export const metadata = { title: "Novo paciente" };

export default async function NovoPaciente({ searchParams }: { searchParams: Promise<{ modo?: string }> }) {
  const u = await exigirUsuario();
  const { modo } = await searchParams;
  if (!acessoDe(u).ativo) {
    return (
      <div className="card alert">
        <span className="kick">Acesso pausado</span>
        <h2>Escolha um plano para cadastrar novos pacientes</h2>
        <p className="text-[var(--ok-2)]">Seus pacientes e planos anteriores continuam guardados.</p>
        <Link href="/app/creditos" className="btn ok">
          Ver planos
        </Link>
      </div>
    );
  }
  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="kick">Novo caso</span>
        <h1>Novo paciente</h1>
        <p className="text-muted">Só o nome é obrigatório. Na próxima tela você tira a foto.</p>
      </div>
      <Formulario acao={criarPaciente} botao="Continuar para a foto">
        <input type="hidden" name="modo" value={modo || ""} />
        <label className="campo">
          <span>Nome do paciente</span>
          <input name="nome" required minLength={2} maxLength={80} autoComplete="off" placeholder="Maria Oliveira" />
        </label>
        <label className="campo">
          <span>WhatsApp do paciente (opcional)</span>
          <input name="whatsapp" type="tel" inputMode="tel" autoComplete="off" placeholder="(11) 99999-9999" />
        </label>
        <label className="campo">
          <span>Data de nascimento (opcional)</span>
          <input name="nascimento" type="date" />
        </label>
        <label className="flex items-start gap-3 text-[14px] text-[var(--ok-2)]">
          <input type="checkbox" name="consentimento" required className="mt-1 h-5 w-5 flex-none accent-[var(--cy)]" />
          <span>O paciente autorizou o uso da imagem para planejamento e simulação do tratamento.</span>
        </label>
      </Formulario>
    </>
  );
}

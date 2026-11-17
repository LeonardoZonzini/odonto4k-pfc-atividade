import Link from "next/link";
import { sair } from "@/app/acoes";
import { precisaVerificarEmail } from "@/lib/api";
import { exigirUsuario } from "@/lib/auth";
import { ehAdmin } from "@/lib/config";
import { ApagarConta, FormPerfil, FormSenha, FormSuporte, VerificarEmail } from "@/components/Conta";

export const metadata = { title: "Conta" };

function mascararWhats(w: string) {
  const d = w.startsWith("55") ? w.slice(2) : w;
  return d.length >= 10 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}` : w;
}

export default async function Conta() {
  const u = await exigirUsuario();
  const whatsSuporte = (process.env.SUPORTE_WHATSAPP || "").replace(/\D/g, "");
  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="kick">Conta</span>
        <h1>{u.nome}</h1>
        <p className="note">{u.email}</p>
      </div>

      {precisaVerificarEmail(u) && <VerificarEmail email={u.email} />}

      <section className="card">
        <h3>Seus dados e sua marca</h3>
        <p className="note">O nome e a logo da clínica aparecem nas propostas e no PDF enviados ao paciente.</p>
        <FormPerfil
          nome={u.nome}
          whatsapp={mascararWhats(u.whatsapp)}
          clinica={u.clinica_nome}
          temLogo={Boolean(u.clinica_logo)}
          logoV={u.clinica_logo}
        />
      </section>

      <section className="card">
        <h3>Senha</h3>
        <FormSenha />
      </section>

      <section className="card">
        <h3>Suporte</h3>
        <p className="note">Respondemos no seu e-mail em até 1 dia útil.</p>
        {whatsSuporte && (
          <a className="btn ok" href={`https://wa.me/${whatsSuporte}?text=${encodeURIComponent("Olá! Preciso de ajuda com o Odonto 4K.")}`} target="_blank" rel="noreferrer">
            Falar no WhatsApp
          </a>
        )}
        <FormSuporte />
      </section>

      <section className="flex flex-col gap-2">
        {ehAdmin(u.email) && (
          <Link href="/admin" className="btn vi">
            Painel de administração
          </Link>
        )}
        <form action={sair}>
          <button className="btn dark">Sair da conta</button>
        </form>
        <div className="flex justify-center gap-4 pt-2">
          <Link href="/termos" target="_blank" className="note underline">
            Termos de uso
          </Link>
          <Link href="/privacidade" target="_blank" className="note underline">
            Privacidade
          </Link>
        </div>
        <ApagarConta />
      </section>
    </>
  );
}

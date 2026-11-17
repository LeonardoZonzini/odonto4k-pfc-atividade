import { exigirUsuario } from "@/lib/auth";
import { primeiroNome } from "@/lib/config";
import { Onboarding } from "@/components/Onboarding";

export const metadata = { title: "Boas-vindas" };

export default async function BoasVindas() {
  const u = await exigirUsuario();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col gap-5 px-4 pb-10 pt-5">
      <div className="brand text-center">
        Odonto <span>4K</span>
      </div>
      <div className="flex flex-col gap-1 text-center">
        <h1>
          Bem-vindo(a), <span className="hl">{primeiroNome(u.nome)}</span>
        </h1>
        <p className="text-muted">Três toques para deixar o app com a sua cara.</p>
      </div>
      <Onboarding clinica={u.clinica_nome} />
    </div>
  );
}

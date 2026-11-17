import { cookies } from "next/headers";
import { exigirUsuario } from "@/lib/auth";
import { acessoDe } from "@/lib/creditos";
import { primeiroNome } from "@/lib/config";
import { Avisos } from "@/components/ui";
import { Abertura } from "@/components/Abertura";
import { Efeitos } from "@/components/Efeitos";

export const metadata = { robots: { index: false } };

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const u = await exigirUsuario();
  const visto = (await cookies()).has("o4k_visto");
  return (
    <>
      {children}
      <Abertura
        mostrar={!visto}
        primeiro={primeiroNome(u.nome)}
        clinica={u.clinica_nome}
        logo={u.clinica_logo}
        plano={acessoDe(u).planoNome}
        novo={!u.onboarding_ok}
      />
      <Efeitos />
      <Avisos />
    </>
  );
}

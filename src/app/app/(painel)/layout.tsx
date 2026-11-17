import Link from "next/link";
import { redirect } from "next/navigation";
import { exigirUsuario } from "@/lib/auth";
import { acessoDe, saldoDe } from "@/lib/creditos";
import { NavInferior } from "@/components/NavInferior";
import { IcCreditos } from "@/components/Icones";

export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  const u = await exigirUsuario();
  if (!u.onboarding_ok) redirect("/app/boas-vindas");
  const saldo = saldoDe(u.id).total;
  const acesso = acessoDe(u);
  return (
    <div className="mx-auto w-full max-w-[720px] px-4 pb-32">
      <header className="sticky top-0 z-20 -mx-4 flex items-center gap-3 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur">
        <Link href="/app" className="brand flex-1">
          Odonto <span>4K</span>
        </Link>
        {!acesso.ativo && (
          <Link href="/app/creditos" className="tag alert no-underline">
            Sem plano
          </Link>
        )}
        <Link href="/app/creditos" className="tag gold no-underline" aria-label={`${saldo} créditos`}>
          <IcCreditos className="h-3.5 w-3.5" />
          {saldo}
        </Link>
      </header>
      <main className="entra flex flex-col gap-5 pt-5">{children}</main>
      <NavInferior />
    </div>
  );
}

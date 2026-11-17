"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IcConta, IcCreditos, IcInicio, IcMais, IcPacientes } from "./Icones";

export function NavInferior() {
  const caminho = usePathname();
  const atual = (base: string, exato = false) => (exato ? caminho === base : caminho.startsWith(base)) ? "page" : undefined;
  return (
    <div className="navbar">
      <nav aria-label="Navegação principal">
        <Link href="/app" aria-current={atual("/app", true)}>
          <IcInicio />
          Início
        </Link>
        <Link href="/app/pacientes" aria-current={caminho.startsWith("/app/pacientes") && !caminho.endsWith("/novo") ? "page" : undefined}>
          <IcPacientes />
          Pacientes
        </Link>
        <Link href="/app/pacientes/novo" className="mais" aria-label="Novo paciente">
          <IcMais />
        </Link>
        <Link href="/app/creditos" aria-current={atual("/app/creditos")}>
          <IcCreditos />
          Créditos
        </Link>
        <Link href="/app/conta" aria-current={atual("/app/conta")}>
          <IcConta />
          Conta
        </Link>
      </nav>
    </div>
  );
}

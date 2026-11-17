"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type PacienteItem = { id: string; nome: string; planos: number; foto: string | null; atualizado: number | null; criado_em: number };

export function ListaPacientes({ pacientes }: { pacientes: PacienteItem[] }) {
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<"recentes" | "nome">("recentes");
  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtrada = pacientes.filter((p) => p.nome.toLowerCase().includes(termo));
    return ordem === "nome" ? [...filtrada].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")) : filtrada;
  }, [pacientes, busca, ordem]);
  return (
    <>
      <label className="campo">
        <span>Buscar</span>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome do paciente" />
      </label>
      <div className="seg">
        <button type="button" aria-pressed={ordem === "recentes"} onClick={() => setOrdem("recentes")}>
          Mais recentes
        </button>
        <button type="button" aria-pressed={ordem === "nome"} onClick={() => setOrdem("nome")}>
          Nome A–Z
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {lista.map((p) => (
          <Link key={p.id} href={`/app/pacientes/${p.id}`} className="card !flex-row items-center !gap-3 !p-3 no-underline transition-colors hover:border-gold-deep">
            <span className="h-16 w-16 flex-none overflow-hidden rounded-lg border border-line bg-black">
              {p.foto && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/arquivos/${p.foto}?v=${p.atualizado}`} alt="" className="h-full w-full object-cover" />
              )}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <b className="truncate font-display text-[17px]">{p.nome}</b>
              <span className="note">
                {p.planos} {p.planos === 1 ? "plano" : "planos"} · {new Date(p.atualizado || p.criado_em).toLocaleDateString("pt-BR")}
              </span>
            </span>
            <span className="font-mono text-gold">›</span>
          </Link>
        ))}
        {lista.length === 0 && <p className="note py-6 text-center">Nenhum paciente encontrado com esse nome.</p>}
      </div>
    </>
  );
}

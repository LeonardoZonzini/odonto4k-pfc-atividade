"use client";

import { useState, useTransition } from "react";
import { irParaCheckout } from "@/app/acoes";
import { avisar } from "./ui";

type Plano = { id: "pro" | "clinica"; nome: string; mensal: string; anual: string; anualMes: string; creditos: number; resumo: string; itens: string[] };

export function Planos({ planos, atual, pacote }: { planos: Plano[]; atual: string; pacote: { creditos: number; preco: string } | null }) {
  const [ciclo, setCiclo] = useState<"mensal" | "anual">("mensal");
  const [pendente, iniciar] = useTransition();
  const [qual, setQual] = useState("");

  const comprar = (chave: Parameters<typeof irParaCheckout>[0]) => {
    setQual(chave);
    iniciar(async () => {
      const r = await irParaCheckout(chave);
      if (r.url) window.location.href = r.url;
      else avisar(r.erro || "Não foi possível abrir o pagamento.", true);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="seg">
        <button type="button" aria-pressed={ciclo === "mensal"} onClick={() => setCiclo("mensal")}>
          Mensal
        </button>
        <button type="button" aria-pressed={ciclo === "anual"} onClick={() => setCiclo("anual")}>
          Anual · 2 meses grátis
        </button>
      </div>
      {planos.map((p) => {
        const chave = `${p.id}_${ciclo}` as Parameters<typeof irParaCheckout>[0];
        const ehAtual = atual === p.id;
        return (
          <div key={p.id} className={`card ${p.id === "pro" ? "gold" : ""}`}>
            <div className="flex items-center gap-2">
              <h3 className="flex-1">{p.nome}</h3>
              {ehAtual && <span className="tag gold">Seu plano</span>}
              {!ehAtual && p.id === "pro" && <span className="tag">Mais escolhido</span>}
            </div>
            <p className="text-[14.5px] text-muted">{p.resumo}</p>
            <div className="price">
              <span className="big">
                {ciclo === "mensal" ? p.mensal : p.anualMes}
                <small> /mês</small>
              </span>
              {ciclo === "anual" && <p className="note">{p.anual} cobrados uma vez por ano</p>}
            </div>
            <ul className="list">
              {p.itens.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
            <button className={`btn ${p.id === "pro" ? "ok" : "vi"}`} disabled={pendente} onClick={() => comprar(chave)}>
              {pendente && qual === chave ? "Abrindo…" : ehAtual ? "Renovar plano" : `Assinar ${p.nome}`}
            </button>
          </div>
        );
      })}
      {pacote && (
        <div className="card">
          <h3>Pacote avulso</h3>
          <p className="text-[14.5px] text-muted">
            {pacote.creditos} créditos extras que não expiram, para o mês em que a agenda encher.
          </p>
          <div className="price">
            <span className="big">{pacote.preco}</span>
          </div>
          <button className="btn dark" disabled={pendente} onClick={() => comprar("pacote")}>
            {pendente && qual === "pacote" ? "Abrindo…" : `Comprar ${pacote.creditos} créditos`}
          </button>
        </div>
      )}
    </div>
  );
}

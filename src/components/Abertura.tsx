"use client";

import { useCallback, useEffect, useState } from "react";

const COOKIE = "o4k_visto";
const PAUSA_S = 30 * 60;

function marcarVisto() {
  document.cookie = `${COOKIE}=1; path=/; max-age=${PAUSA_S}; samesite=lax`;
}

export function iniciais(texto: string) {
  const partes = texto
    .replace(/^(dra?\.?|cl[ií]nica|consult[oó]rio)\s+/i, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return ((partes[0]?.[0] || "") + (partes.length > 1 ? partes.at(-1)![0] : "")).toUpperCase() || "4K";
}

export function Avatar({ logo, nome, className = "" }: { logo: string; nome: string; className?: string }) {
  return (
    <span className={`avatar ${logo ? "com-logo" : ""} ${className}`} aria-hidden="true">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/arquivos/${logo}`} alt="" />
      ) : (
        iniciais(nome)
      )}
    </span>
  );
}

type Fase = "carga" | "ola" | "saindo" | "fim";

export function Abertura({
  mostrar,
  primeiro,
  clinica,
  logo,
  plano,
  novo,
}: {
  mostrar: boolean;
  primeiro: string;
  clinica: string;
  logo: string;
  plano: string;
  novo: boolean;
}) {
  const [fase, setFase] = useState<Fase>(mostrar ? "carga" : "fim");

  useEffect(() => {
    const aoSair = () => document.visibilityState === "hidden" && marcarVisto();
    document.addEventListener("visibilitychange", aoSair);
    return () => document.removeEventListener("visibilitychange", aoSair);
  }, []);

  useEffect(() => {
    if (!mostrar) return;
    marcarVisto();
    const calmo = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const relogios = [
      setTimeout(() => setFase((f) => (f === "carga" ? "ola" : f)), calmo ? 250 : 1300),
      setTimeout(() => setFase((f) => (f === "fim" ? f : "saindo")), calmo ? 1500 : 3500),
      setTimeout(() => setFase("fim"), calmo ? 1600 : 4000),
    ];
    return () => relogios.forEach(clearTimeout);
  }, [mostrar]);

  const pular = useCallback(() => {
    setFase((f) => (f === "fim" ? f : "saindo"));
    setTimeout(() => setFase("fim"), 450);
  }, []);

  if (fase === "fim") return null;
  const ola = fase !== "carga";
  return (
    <div className={`abertura ${fase === "saindo" ? "saindo" : ""}`} role="status" aria-live="polite" onClick={pular}>
      <div className={`cena ${ola ? "fora" : ""}`} aria-hidden={ola}>
        <svg className="dente" viewBox="0 0 100 100" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="o4k-ouro" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#F2D27A" />
              <stop offset="1" stopColor="#A8811F" />
            </linearGradient>
          </defs>
          <path
            d="M30 22C38 16 46 22 50 22C54 22 62 16 70 22C80 30 76 48 72 58C69 66 68 80 63 82C58 84 57 66 50 66C43 66 42 84 37 82C32 80 31 66 28 58C24 48 20 30 30 22Z"
            stroke="url(#o4k-ouro)"
            strokeWidth="4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path className="brilho" d="M40 34C44 31 47 32 50 34" stroke="#F5F2EA" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <div className="marca">
          Odonto <span>4K</span>
        </div>
        <div className="trilho">
          <i />
        </div>
        <span className="status">{novo ? "Criando seu perfil" : "Abrindo seu estúdio"}</span>
      </div>

      <div className={`cena ${ola ? "dentro" : "espera"}`} aria-hidden={!ola}>
        <div className="selo">
          <Avatar logo={logo} nome={clinica || primeiro} />
        </div>
        <span className="ola">{novo ? "Perfil criado" : "Que bom ter você de volta"}</span>
        <div className="nome" aria-label={primeiro}>
          {[...primeiro].map((letra, i) => (
            <span key={i} style={{ animationDelay: `${0.12 + i * 0.035}s` }} aria-hidden="true">
              {letra === " " ? " " : letra}
            </span>
          ))}
        </div>
        <span className="clinica">{novo ? "Agora vamos deixar o app com a sua cara." : clinica || "Seu estúdio de sorrisos está pronto."}</span>
        {!novo && <span className="tag gold">{plano}</span>}
      </div>
      <span className="toque">Toque para continuar</span>
    </div>
  );
}

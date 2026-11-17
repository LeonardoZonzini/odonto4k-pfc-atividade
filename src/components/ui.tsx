"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { Estado } from "@/app/acoes";

export function Formulario({
  acao,
  botao,
  children,
  classeBotao = "btn",
  aoConcluir,
}: {
  acao: (estado: Estado, fd: FormData) => Promise<Estado>;
  botao: string;
  children: React.ReactNode;
  classeBotao?: string;
  aoConcluir?: () => void;
}) {
  const [estado, enviar, pendente] = useActionState(acao, undefined);
  useEffect(() => {
    if (estado?.ok) aoConcluir?.();
  }, [estado, aoConcluir]);
  return (
    <form action={enviar} className="flex flex-col gap-4">
      {children}
      {estado?.erro && (
        <p className="erro" role="alert">
          {estado.erro}
        </p>
      )}
      {estado?.ok && (
        <p className="sucesso" role="status">
          {estado.ok}
        </p>
      )}
      <button className={classeBotao} disabled={pendente}>
        {pendente ? "Aguarde…" : botao}
      </button>
    </form>
  );
}

export function avisar(mensagem: string, ruim = false) {
  window.dispatchEvent(new CustomEvent("o4k-aviso", { detail: { mensagem, ruim } }));
}

export function Avisos() {
  const [aviso, setAviso] = useState<{ mensagem: string; ruim: boolean; n: number } | null>(null);
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const ouvir = (e: Event) => {
      const d = (e as CustomEvent).detail;
      setAviso({ ...d, n: Date.now() });
      if (relogio.current) clearTimeout(relogio.current);
      relogio.current = setTimeout(() => setAviso(null), d.ruim ? 5200 : 3200);
    };
    window.addEventListener("o4k-aviso", ouvir);
    return () => window.removeEventListener("o4k-aviso", ouvir);
  }, []);
  if (!aviso) return null;
  return (
    <div key={aviso.n} className={`toast ${aviso.ruim ? "ruim" : ""}`} role="status">
      {aviso.mensagem}
    </div>
  );
}

export function Comparador({
  antes,
  depois,
  proporcao,
  rotuloDepois = "DEPOIS",
}: {
  antes: string;
  depois: string;
  proporcao: number;
  rotuloDepois?: string;
}) {
  const [x, setX] = useState(50);
  return (
    <div className="cmp" style={{ aspectRatio: String(proporcao), ["--x" as string]: `${x}%` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={antes} alt="Foto original do paciente" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="after" src={depois} alt="Simulação do resultado" />
      <div className="handle" />
      <span className="tg a">ANTES</span>
      <span className="tg d">{rotuloDepois}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={0.1}
        value={x}
        aria-label="Arraste para comparar antes e depois"
        onChange={(e) => setX(Number(e.target.value))}
      />
    </div>
  );
}

export function Folha({ aberta, fechar, children }: { aberta: boolean; fechar: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!aberta) return;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberta, fechar]);
  if (!aberta) return null;
  return (
    <div className="sheet-bg" onClick={fechar}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function Confirmar({
  rotulo,
  pergunta,
  confirmar,
  acao,
  campos,
  classe = "btn danger sm",
}: {
  rotulo: React.ReactNode;
  pergunta: string;
  confirmar: string;
  acao: (fd: FormData) => Promise<void>;
  campos: Record<string, string>;
  classe?: string;
}) {
  const [aberta, setAberta] = useState(false);
  return (
    <>
      <button type="button" className={classe} onClick={() => setAberta(true)}>
        {rotulo}
      </button>
      <Folha aberta={aberta} fechar={() => setAberta(false)}>
        <h3>{pergunta}</h3>
        <form action={acao} className="flex flex-col gap-3">
          {Object.entries(campos).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <button className="btn danger">{confirmar}</button>
          <button type="button" className="btn dark" onClick={() => setAberta(false)}>
            Cancelar
          </button>
        </form>
      </Folha>
    </>
  );
}

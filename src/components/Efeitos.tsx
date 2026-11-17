"use client";

import { useEffect, useRef, useState } from "react";

/** Ondas nos botões, foco de luz que segue o dedo e um toque tátil leve. */
export function Efeitos() {
  useEffect(() => {
    const calmo = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const aoApertar = (e: PointerEvent) => {
      const alvo = (e.target as Element | null)?.closest?.(".btn:not(.ghost)") as HTMLElement | null;
      if (!alvo || alvo.matches(":disabled")) return;
      try {
        navigator.vibrate?.(8);
      } catch {}
      if (calmo) return;
      const r = alvo.getBoundingClientRect();
      const onda = document.createElement("span");
      const lado = Math.max(r.width, r.height) * 2.2;
      onda.className = "onda";
      onda.style.width = onda.style.height = `${lado}px`;
      onda.style.left = `${e.clientX - r.left}px`;
      onda.style.top = `${e.clientY - r.top}px`;
      alvo.appendChild(onda);
      setTimeout(() => onda.remove(), 600);
    };
    const aoMover = (e: PointerEvent) => {
      const alvo = (e.target as Element | null)?.closest?.(".tool, .card.gold") as HTMLElement | null;
      if (!alvo) return;
      const r = alvo.getBoundingClientRect();
      alvo.style.setProperty("--mx", `${e.clientX - r.left}px`);
      alvo.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    document.addEventListener("pointerdown", aoApertar, { passive: true });
    document.addEventListener("pointerdown", aoMover, { passive: true });
    if (!calmo) document.addEventListener("pointermove", aoMover, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", aoApertar);
      document.removeEventListener("pointerdown", aoMover);
      document.removeEventListener("pointermove", aoMover);
    };
  }, []);
  return null;
}

/** Número que sobe até o valor final quando aparece na tela. */
export function Contagem({ valor, className }: { valor: number; className?: string }) {
  const [n, setN] = useState(valor);
  const anterior = useRef<number | null>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(valor);
      return;
    }
    const de = anterior.current ?? 0;
    anterior.current = valor;
    if (de === valor) return;
    const inicio = performance.now();
    const dur = 900;
    let quadro = 0;
    const passo = (t: number) => {
      const p = Math.min(1, (t - inicio) / dur);
      setN(Math.round(de + (valor - de) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [valor]);
  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {n}
    </span>
  );
}

/** Anel de progresso que se preenche ao entrar. */
export function Anel({ porcento, children }: { porcento: number; children: React.ReactNode }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const q = requestAnimationFrame(() => setV(Math.max(0, Math.min(100, porcento))));
    return () => cancelAnimationFrame(q);
  }, [porcento]);
  return (
    <span className="anel" style={{ ["--v" as string]: v }}>
      {children}
    </span>
  );
}

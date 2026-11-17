"use client";

import { useEffect, useState } from "react";

const TELAS = [
  {
    img: "/cards/g2.jpg",
    kick: "Simulação",
    titulo: "O paciente vê o sorriso novo antes de dizer sim",
    texto: "Clareamento, lentes e alinhamento em cima da foto dele, em menos de um minuto.",
  },
  {
    img: "/cards/g6.jpg",
    kick: "Análise",
    titulo: "Linha média, corredor bucal e sorriso gengival medidos na foto",
    texto: "Uma explicação clara para cada medida, pronta para mostrar na cadeira.",
  },
  {
    img: "/cards/g4.jpg",
    kick: "Proposta",
    titulo: "Antes e depois com a marca da sua clínica, direto no WhatsApp",
    texto: "O paciente abre o link, vê o resultado e chama você para agendar.",
  },
];

export function Vitrine() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % TELAS.length), 4800);
    return () => clearInterval(t);
  }, []);
  const tela = TELAS[i];
  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-[14px] border border-line aspect-[4/3] bg-panel">
        {TELAS.map((t, n) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={t.img}
            src={t.img}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
            style={{ opacity: n === i ? 1 : 0 }}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent" />
        <div key={i} className="entra absolute inset-x-0 bottom-0 flex flex-col gap-2 p-4">
          <span className="kick">{tela.kick}</span>
          <h2 className="!text-[21px]">{tela.titulo}</h2>
          <p className="text-[14.5px] text-[var(--ok-2)]">{tela.texto}</p>
        </div>
      </div>
      <div className="flex justify-center gap-2" role="tablist" aria-label="Destaques">
        {TELAS.map((t, n) => (
          <button
            key={t.kick}
            role="tab"
            aria-selected={n === i}
            aria-label={t.kick}
            onClick={() => setI(n)}
            className="h-1.5 rounded-full transition-all"
            style={{ width: n === i ? 28 : 10, background: n === i ? "var(--cy)" : "var(--line)" }}
          />
        ))}
      </div>
    </div>
  );
}

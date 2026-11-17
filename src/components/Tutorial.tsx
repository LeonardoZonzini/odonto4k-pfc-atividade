"use client";

import { useState } from "react";
import { concluirTutorial } from "@/app/acoes";

const PASSOS = [
  { n: "01", titulo: "Tire a foto do paciente sorrindo", texto: "Rosto inteiro, de frente, com os dentes aparecendo. A moldura da câmera ajuda a enquadrar." },
  { n: "02", titulo: "Veja a análise do sorriso", texto: "As linhas e medidas aparecem em cima da foto. Arraste os pontos se quiser ajustar." },
  { n: "03", titulo: "Simule o tratamento", texto: "Clareamento na hora, sem gastar créditos. Lentes e alinhamento usam 1 crédito e geram 3 versões." },
  { n: "04", titulo: "Envie a proposta", texto: "Antes e depois, tratamento e valor em um link com a marca da sua clínica, direto no WhatsApp do paciente." },
];

export function Tutorial() {
  const [i, setI] = useState(0);
  const [aberto, setAberto] = useState(true);
  if (!aberto) return null;
  const fechar = () => {
    setAberto(false);
    void concluirTutorial();
  };
  const p = PASSOS[i];
  return (
    <div className="sheet-bg">
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Como funciona">
        <div className="bar">
          <i style={{ width: `${((i + 1) / PASSOS.length) * 100}%` }} />
        </div>
        <div key={i} className="entra flex flex-col gap-3 py-2">
          <span className="kick">Passo {p.n}</span>
          <h2>{p.titulo}</h2>
          <p className="text-[var(--ok-2)]">{p.texto}</p>
        </div>
        <button className="btn" onClick={() => (i < PASSOS.length - 1 ? setI(i + 1) : fechar())}>
          {i < PASSOS.length - 1 ? "Próximo" : "Começar"}
        </button>
        {i < PASSOS.length - 1 && (
          <button className="btn ghost" onClick={fechar}>
            Pular
          </button>
        )}
      </div>
    </div>
  );
}

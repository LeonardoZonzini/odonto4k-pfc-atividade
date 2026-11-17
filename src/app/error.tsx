"use client";

import { useEffect } from "react";

export default function Erro({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col justify-center gap-4 px-4 py-10">
      <span className="kick">Algo saiu do previsto</span>
      <h1>Não conseguimos abrir esta tela</h1>
      <p className="text-muted">Seus pacientes e simulações continuam guardados. Tente de novo; se continuar, fale com o suporte na tela Conta.</p>
      <button className="btn" onClick={() => retry()}>
        Tentar de novo
      </button>
      <a className="btn dark" href="/app">
        Voltar ao início
      </a>
    </div>
  );
}

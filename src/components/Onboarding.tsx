"use client";

import { useState } from "react";
import { salvarOnboarding } from "@/app/acoes";

const PERGUNTAS = [
  {
    campo: "atuacao",
    kick: "Sobre você",
    titulo: "Como você atua hoje?",
    opcoes: ["Dentista em consultório próprio", "Dentista em clínica de terceiros", "Dono(a) ou gestor(a) de clínica", "Estudante de odontologia", "Protético ou laboratório"],
  },
  {
    campo: "experiencia",
    kick: "Sua rotina",
    titulo: "Você já mostra simulações do sorriso para o paciente?",
    opcoes: ["Nunca usei", "Já testei, mas não uso sempre", "Uso em quase todo caso estético"],
  },
  {
    campo: "objetivo",
    kick: "Seu objetivo",
    titulo: "O que você mais quer com o Odonto 4K?",
    opcoes: ["Fechar mais tratamentos estéticos", "Explicar melhor o plano ao paciente", "Passar mais valor na consulta", "Criar conteúdo de antes e depois"],
  },
];

export function Onboarding({ clinica }: { clinica: string }) {
  const [passo, setPasso] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const total = PERGUNTAS.length + 1;
  const pergunta = PERGUNTAS[passo];

  const escolher = (valor: string) => {
    setRespostas((r) => ({ ...r, [pergunta.campo]: valor }));
    setTimeout(() => setPasso((p) => p + 1), 260);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="bar">
        <i style={{ width: `${((passo + 1) / total) * 100}%` }} />
      </div>
      {pergunta ? (
        <div key={passo} className="entra flex flex-col gap-4">
          <span className="kick">{pergunta.kick}</span>
          <h2>{pergunta.titulo}</h2>
          <div className="stagger flex flex-col gap-2.5">
            {pergunta.opcoes.map((o) => (
              <button key={o} type="button" className={`opt ${respostas[pergunta.campo] === o ? "picked" : ""}`} onClick={() => escolher(o)}>
                <span className="rd" />
                {o}
              </button>
            ))}
          </div>
          {passo > 0 && (
            <button type="button" className="btn ghost" onClick={() => setPasso(passo - 1)}>
              Voltar
            </button>
          )}
        </div>
      ) : (
        <form action={salvarOnboarding} className="entra flex flex-col gap-4">
          {Object.entries(respostas).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <span className="kick">Sua marca</span>
          <h2>Qual nome aparece nas propostas enviadas ao paciente?</h2>
          <label className="campo">
            <span>Nome da clínica ou consultório</span>
            <input name="clinica" defaultValue={clinica} maxLength={80} placeholder="Clínica Sorriso Novo" />
          </label>
          <p className="note">Você pode trocar o nome e enviar a logo depois, na tela Conta.</p>
          <button className="btn shine">Entrar no Odonto 4K</button>
          <button type="button" className="btn ghost" onClick={() => setPasso(passo - 1)}>
            Voltar
          </button>
        </form>
      )}
    </div>
  );
}

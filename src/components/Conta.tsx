"use client";

import { useState, useTransition } from "react";
import { abrirTicket, apagarConta, reenviarVerificacao, salvarConta, trocarSenha } from "@/app/acoes";
import { avisar, Folha, Formulario } from "./ui";

export function FormPerfil({ nome, whatsapp, clinica, temLogo, logoV }: { nome: string; whatsapp: string; clinica: string; temLogo: boolean; logoV: string }) {
  return (
    <Formulario acao={salvarConta} botao="Salvar dados">
      <label className="campo">
        <span>Nome completo</span>
        <input name="nome" defaultValue={nome} required minLength={3} maxLength={80} autoComplete="name" />
      </label>
      <label className="campo">
        <span>WhatsApp com DDD</span>
        <input name="whatsapp" type="tel" inputMode="tel" defaultValue={whatsapp} required autoComplete="tel" />
      </label>
      <label className="campo">
        <span>Nome da clínica nas propostas</span>
        <input name="clinica" defaultValue={clinica} maxLength={80} placeholder="Clínica Sorriso Novo" />
      </label>
      <div className="campo">
        <span>Logo da clínica</span>
        <div className="flex items-center gap-3">
          {temLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/arquivos/${logoV}`} alt="Logo atual" className="h-14 w-14 rounded-lg border border-line bg-white object-contain p-1" />
          )}
          <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="!p-2.5 text-[14px]" />
        </div>
        {temLogo && (
          <label className="mt-1 flex items-center gap-2 text-[14px] text-muted">
            <input type="checkbox" name="remover_logo" className="h-4 w-4 accent-[var(--cy)]" /> Remover a logo atual
          </label>
        )}
      </div>
    </Formulario>
  );
}

export function VerificarEmail({ email }: { email: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <div className="card alert">
      <h3>Confirme seu e-mail</h3>
      <p className="text-[14.5px] text-[var(--ok-2)]">
        Enviamos um link para <b>{email}</b>. A confirmação libera as simulações com IA.
      </p>
      <button
        className="btn vi"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            const r = await reenviarVerificacao();
            avisar(r?.ok || r?.erro || "", Boolean(r?.erro));
          })
        }
      >
        {pendente ? "Enviando…" : "Reenviar link"}
      </button>
    </div>
  );
}

export function FormSenha() {
  return (
    <Formulario acao={trocarSenha} botao="Trocar senha" classeBotao="btn dark">
      <label className="campo">
        <span>Senha atual</span>
        <input name="atual" type="password" required autoComplete="current-password" />
      </label>
      <label className="campo">
        <span>Nova senha</span>
        <input name="nova" type="password" required minLength={8} autoComplete="new-password" placeholder="Mínimo de 8 caracteres" />
      </label>
    </Formulario>
  );
}

export function FormSuporte() {
  const [chave, setChave] = useState(0);
  return (
    <div key={chave}>
      <Formulario acao={abrirTicket} botao="Enviar mensagem" classeBotao="btn vi" aoConcluir={() => setTimeout(() => setChave((c) => c + 1), 4000)}>
        <label className="campo">
          <span>Assunto</span>
          <input name="assunto" required minLength={3} maxLength={100} placeholder="Dúvida sobre créditos" />
        </label>
        <label className="campo">
          <span>Mensagem</span>
          <textarea name="mensagem" required minLength={10} maxLength={3000} placeholder="Conte o que aconteceu. Respondemos no seu e-mail." />
        </label>
      </Formulario>
    </div>
  );
}

export function ApagarConta() {
  const [aberta, setAberta] = useState(false);
  return (
    <>
      <button className="btn ghost" onClick={() => setAberta(true)}>
        Apagar minha conta
      </button>
      <Folha aberta={aberta} fechar={() => setAberta(false)}>
        <h3>Apagar a conta e todos os dados?</h3>
        <p className="text-[14.5px] text-[var(--ok-2)]">
          Pacientes, fotos, planos, propostas e créditos são removidos de forma definitiva. Os links de proposta já enviados deixam de funcionar.
        </p>
        <Formulario acao={apagarConta} botao="Apagar tudo" classeBotao="btn danger">
          <label className="campo">
            <span>Digite sua senha para confirmar</span>
            <input name="senha" type="password" required autoComplete="current-password" />
          </label>
        </Formulario>
        <button className="btn dark" onClick={() => setAberta(false)}>
          Cancelar
        </button>
      </Folha>
    </>
  );
}

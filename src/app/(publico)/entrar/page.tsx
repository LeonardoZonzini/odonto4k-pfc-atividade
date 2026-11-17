import Link from "next/link";
import { redirect } from "next/navigation";
import { entrar } from "@/app/acoes";
import { usuarioAtual } from "@/lib/auth";
import { Formulario } from "@/components/ui";

export const metadata = { title: "Entrar" };

export default async function Entrar({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  if (await usuarioAtual()) redirect("/app");
  const { ok } = await searchParams;
  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="kick">Acesso</span>
        <h1>Entrar</h1>
      </div>
      {ok === "senha" && <p className="sucesso">Senha alterada. Entre com a nova senha.</p>}
      {ok === "email" && <p className="sucesso">E-mail confirmado. Entre para continuar.</p>}
      <Formulario acao={entrar} botao="Entrar">
        <label className="campo">
          <span>E-mail</span>
          <input name="email" type="email" autoComplete="email" required placeholder="voce@clinica.com.br" />
        </label>
        <label className="campo">
          <span>Senha</span>
          <input name="senha" type="password" autoComplete="current-password" required />
        </label>
      </Formulario>
      <div className="flex flex-col items-center gap-2">
        <Link href="/esqueci-senha" className="note underline">
          Esqueci minha senha
        </Link>
        <p className="note">
          Ainda não tem conta?{" "}
          <Link href="/criar-conta" className="text-gold">
            Criar conta
          </Link>
        </p>
      </div>
    </>
  );
}

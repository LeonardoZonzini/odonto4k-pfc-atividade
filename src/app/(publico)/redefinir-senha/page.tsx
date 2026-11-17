import Link from "next/link";
import { redefinirSenha } from "@/app/acoes";
import { Formulario } from "@/components/ui";

export const metadata = { title: "Nova senha" };

export default async function RedefinirSenha({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <>
        <h1>Link inválido</h1>
        <p className="text-muted">Peça um novo link para criar sua senha.</p>
        <Link href="/esqueci-senha" className="btn">
          Pedir novo link
        </Link>
      </>
    );
  }
  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="kick">Recuperar acesso</span>
        <h1>Crie uma nova senha</h1>
      </div>
      <Formulario acao={redefinirSenha} botao="Salvar nova senha">
        <input type="hidden" name="token" value={token} />
        <label className="campo">
          <span>Nova senha</span>
          <input name="senha" type="password" autoComplete="new-password" required minLength={8} placeholder="Mínimo de 8 caracteres" />
        </label>
        <label className="campo">
          <span>Repita a nova senha</span>
          <input name="confirmar" type="password" autoComplete="new-password" required minLength={8} />
        </label>
      </Formulario>
    </>
  );
}

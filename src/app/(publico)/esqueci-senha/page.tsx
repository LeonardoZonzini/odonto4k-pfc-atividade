import Link from "next/link";
import { esqueciSenha } from "@/app/acoes";
import { Formulario } from "@/components/ui";

export const metadata = { title: "Recuperar senha" };

export default function EsqueciSenha() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="kick">Recuperar acesso</span>
        <h1>Esqueceu a senha?</h1>
        <p className="text-muted">Informe o e-mail da sua conta. Enviamos um link para criar uma nova senha.</p>
      </div>
      <Formulario acao={esqueciSenha} botao="Enviar link">
        <label className="campo">
          <span>E-mail</span>
          <input name="email" type="email" autoComplete="email" required placeholder="voce@clinica.com.br" />
        </label>
      </Formulario>
      <Link href="/entrar" className="note text-center underline">
        Voltar para entrar
      </Link>
    </>
  );
}

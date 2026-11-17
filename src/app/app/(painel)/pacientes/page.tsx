import Link from "next/link";
import { exigirUsuario } from "@/lib/auth";
import { todos } from "@/lib/db";
import { ListaPacientes, PacienteItem } from "@/components/ListaPacientes";

export const metadata = { title: "Pacientes" };

export default async function Pacientes() {
  const u = await exigirUsuario();
  const pacientes = todos<PacienteItem>(
    `SELECT p.id, p.nome, p.criado_em,
       (SELECT COUNT(*) FROM plans WHERE patient_id = p.id) AS planos,
       (SELECT COALESCE(NULLIF(resultado,''), NULLIF(foto,'')) FROM plans WHERE patient_id = p.id ORDER BY atualizado_em DESC LIMIT 1) AS foto,
       (SELECT atualizado_em FROM plans WHERE patient_id = p.id ORDER BY atualizado_em DESC LIMIT 1) AS atualizado
     FROM patients p WHERE p.user_id = ? ORDER BY COALESCE(atualizado, p.criado_em) DESC`,
    u.id,
  );
  return (
    <>
      <div className="flex items-end gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <span className="kick">Casos</span>
          <h1>Pacientes</h1>
        </div>
        <Link href="/app/pacientes/novo" className="btn sm">
          Novo
        </Link>
      </div>
      {pacientes.length === 0 ? (
        <div className="card items-center py-10 text-center">
          <h3>Seu primeiro paciente começa aqui</h3>
          <p className="text-muted">Cadastre o paciente, tire a foto e mostre o sorriso novo em menos de um minuto.</p>
          <Link href="/app/pacientes/novo" className="btn mt-2">
            Novo paciente
          </Link>
        </div>
      ) : (
        <ListaPacientes pacientes={pacientes} />
      )}
    </>
  );
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { iniciarManutencao } = await import("./lib/manutencao");
    iniciarManutencao();
    const { garantirProfessor } = await import("./lib/professor");
    garantirProfessor();
  }
}

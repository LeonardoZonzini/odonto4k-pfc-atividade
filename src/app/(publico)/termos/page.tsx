export const metadata = { title: "Termos de uso" };

const SECOES: [string, string[]][] = [
  ["1. O serviço", [
    "O Odonto 4K é uma ferramenta de apoio à comunicação entre o cirurgião-dentista e o paciente. Ele gera imagens ilustrativas de possíveis resultados estéticos a partir de fotografias enviadas pelo profissional.",
    "O serviço não realiza diagnóstico, não substitui a avaliação clínica e não é um dispositivo médico.",
  ]],
  ["2. Quem pode usar", [
    "O uso é destinado a cirurgiões-dentistas, estudantes de odontologia e equipes de clínicas odontológicas. Ao criar a conta, você declara que as informações fornecidas são verdadeiras.",
  ]],
  ["3. Simulações", [
    "Toda imagem de resultado é uma simulação gerada por computador. Ela não representa promessa nem garantia de resultado clínico.",
    "É responsabilidade do profissional apresentar as imagens ao paciente como simulação, de acordo com o Código de Ética Odontológica e as normas do Conselho Federal de Odontologia sobre publicidade e divulgação.",
    "As imagens exportadas e as propostas recebem a marca “SIMULAÇÃO”. É proibido remover essa marca ou divulgar a simulação como resultado real de tratamento.",
  ]],
  ["4. Fotos de pacientes", [
    "Você só pode enviar fotos de pacientes que autorizaram o uso da imagem para planejamento e simulação. O profissional é o responsável por obter e guardar essa autorização.",
    "Você pode apagar um paciente, um plano ou a conta inteira a qualquer momento, e os arquivos correspondentes são removidos dos nossos servidores.",
  ]],
  ["5. Planos, créditos e pagamento", [
    "O teste gratuito tem duração e quantidade de créditos informadas no momento do cadastro. Cada geração de imagem com inteligência artificial consome um crédito.",
    "Os créditos do plano são renovados a cada ciclo mensal e não se acumulam para o ciclo seguinte. Créditos de pacotes avulsos não expiram enquanto a conta existir.",
    "Os pagamentos são processados pela Kiwify. Cancelamentos e reembolsos seguem as regras informadas no momento da compra e a legislação de defesa do consumidor.",
  ]],
  ["6. Uso aceitável", [
    "Não é permitido usar o serviço para enganar pacientes, criar casos clínicos falsos, enviar imagens de terceiros sem autorização ou tentar burlar os limites de uso.",
    "Contas que violarem estes termos podem ser suspensas.",
  ]],
  ["7. Disponibilidade", [
    "Trabalhamos para manter o serviço disponível, mas podem ocorrer interrupções para manutenção ou por falhas de fornecedores. Uma geração que falhar não consome crédito.",
  ]],
  ["8. Alterações", [
    "Estes termos podem ser atualizados. Mudanças relevantes são avisadas por e-mail ou dentro do aplicativo.",
  ]],
];

export default function Termos() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="kick">Documento</span>
        <h1>Termos de uso</h1>
      </div>
      {SECOES.map(([titulo, paragrafos]) => (
        <section key={titulo} className="flex flex-col gap-2">
          <h3>{titulo}</h3>
          {paragrafos.map((p) => (
            <p key={p} className="text-[15px] text-[var(--ok-2)]">
              {p}
            </p>
          ))}
        </section>
      ))}
    </>
  );
}

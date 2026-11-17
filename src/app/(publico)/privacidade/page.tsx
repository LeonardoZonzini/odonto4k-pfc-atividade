import { RETENCAO_INATIVO_DIAS } from "@/lib/config";

export const metadata = { title: "Política de privacidade" };

const SECOES: [string, string[]][] = [
  ["1. Quais dados tratamos", [
    "Do profissional: nome, e-mail, WhatsApp, dados da clínica, senha (guardada de forma cifrada e irreversível) e registros de uso do aplicativo.",
    "Do paciente, enviados pelo profissional: nome, data de nascimento e WhatsApp (opcionais) e fotografias do rosto e do sorriso. Fotografias de pacientes são tratadas como dado pessoal sensível.",
  ]],
  ["2. Para que usamos", [
    "Para criar as análises e simulações pedidas pelo profissional, montar as propostas, controlar o plano e os créditos, prestar suporte e manter a segurança da conta.",
    "Não usamos fotos de pacientes para publicidade e não vendemos dados.",
  ]],
  ["3. Papéis na LGPD", [
    "Em relação aos dados dos pacientes, o profissional ou a clínica é o controlador e o Odonto 4K atua como operador, tratando os dados conforme as instruções do profissional.",
    "Cabe ao profissional obter o consentimento do paciente para o uso da imagem.",
  ]],
  ["4. Com quem compartilhamos", [
    "Para gerar simulações com inteligência artificial, o recorte da região do sorriso é enviado ao provedor de IA (OpenAI), sem o nome do paciente.",
    "Usamos ainda fornecedores de hospedagem, envio de e-mail e pagamento (Kiwify), que recebem apenas o necessário para prestar o serviço.",
  ]],
  ["5. Por quanto tempo guardamos", [
    "Os dados de pacientes ficam guardados enquanto a conta do profissional estiver ativa, para que o histórico de casos continue disponível.",
    `Se a conta ficar sem plano ou teste ativo por ${RETENCAO_INATIVO_DIAS} dias, as fotos e os dados de pacientes são apagados de forma definitiva.`,
    "O profissional pode apagar um paciente, um plano ou a conta inteira a qualquer momento.",
  ]],
  ["6. Segurança", [
    "O acesso é protegido por senha, a comunicação é criptografada e os arquivos só são entregues à conta que os enviou. O link de uma proposta é aleatório e só é conhecido por quem o recebe.",
  ]],
  ["7. Seus direitos", [
    "Você pode pedir acesso, correção, portabilidade ou exclusão dos seus dados pelo suporte dentro do aplicativo. Pacientes devem fazer o pedido ao profissional responsável, e nós apoiamos o atendimento.",
  ]],
];

export default function Privacidade() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="kick">Documento</span>
        <h1>Política de privacidade</h1>
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

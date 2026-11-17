# Odonto 4K — Simulador de Sorriso (atividade PFC)

Aplicação web (Next.js) para dentistas simularem o sorriso do paciente com IA, montarem a
proposta e acompanhar pacientes. Cópia do projeto `odonto4k` preparada para avaliação.

## Login para avaliação

- E-mail: `professor@odonto4k.app`
- A senha é entregue separadamente. No código fica só o hash (`src/lib/professor.ts`).

A conta é criada sozinha na subida do servidor, já com e-mail confirmado, plano Pro ativo por
1 ano e 60 créditos. Também dá para criar conta pelo cadastro normal (`/criar-conta`), mas ele
pede confirmação por e-mail, que só funciona com `RESEND_API_KEY` configurada.

## Como rodar

Precisa de Node.js 22.5 ou mais novo (usa `node:sqlite`).

    npm install
    npm run dev        # http://localhost:3000

Os dados ficam em `./data` (SQLite + arquivos). Em produção na Vercel ficam em `/tmp/odonto4k`.

## Variáveis de ambiente (todas opcionais)

| Variável | Para quê |
| --- | --- |
| `PROFESSOR_EMAIL`, `PROFESSOR_SENHA` | Trocam a conta de avaliação |
| `OPENAI_API_KEY` | Liga a geração de imagens por IA (sem ela a simulação fica indisponível) |
| `RESEND_API_KEY`, `EMAIL_FROM` | Envio de e-mails (confirmação de conta, recuperação de senha) |
| `APP_URL` | URL pública, usada nos links dos e-mails |
| `DATA_DIR` | Pasta dos dados |
| `ADMIN_EMAILS` | E-mails com acesso ao painel `/admin` |
| `KIWIFY_*` | Checkout e webhook de pagamento (não usados na atividade) |

## Limitação na Vercel

O banco é um arquivo SQLite no disco da função, que é temporário: contas criadas pelo cadastro e
dados dos pacientes somem quando a função reinicia, e instâncias diferentes não compartilham o
banco, então a sessão pode cair. A conta do professor é recriada a cada subida. Para uso real,
hospede em um servidor com disco persistente.

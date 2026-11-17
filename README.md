# IA 4K de Fotos — atividade PFC

Aplicação web que corrige fotos de consultório odontológico (cor, exposição, ruído, nitidez e
aumento leve de resolução) **sem IA generativa**: ela não redesenha nada, então o formato e a
posição dos dentes continuam os da foto original. Tem login e cadastro de usuário.

## Como rodar

Precisa de [Node.js](https://nodejs.org) 20 ou mais novo.

    npm install
    npm start

Abra http://localhost:4300 (para trocar a porta: `PORT=5000 npm start`).

## Login

- **Criar conta:** aba "Criar conta" na tela de entrada (e-mail + senha de 6+ caracteres).
- **Conta de demonstração**, caso o cadastro não funcione: `professor@odonto4k.app`.
  A senha é entregue separadamente; no código fica só o hash.

Variáveis de ambiente opcionais: `SESSAO_SEGREDO` (fixa o segredo dos cookies entre reinícios),
`DEMO_EMAIL` e `DEMO_HASH` (trocam a conta de demonstração; o hash é `sal:scrypt` em hexadecimal,
gerado por `hashSenha` em `lib/auth.js`).

## Como funciona

1. Usuário entra (ou cria conta). A sessão é um cookie assinado com HMAC, válido por 7 dias.
2. Envia a foto e escolhe o tipo (intraoral, sorriso, antes/depois, ambiente).
3. O servidor aplica o pipeline de `lib/melhorar.js` (balanço de branco, níveis e gama,
   redução de ruído, nitidez, contraste local e upscale de até 2x) usando a biblioteca `sharp`.
4. A foto melhorada fica só em memória por 30 minutos e é comparada com a original por um
   controle deslizante.

## Estrutura

| Arquivo | Função |
| --- | --- |
| `server.js` | API (Express), fila de 2 correções simultâneas, limite por IP, proteção por login |
| `lib/melhorar.js` | Pipeline de correção e perfis por tipo de foto |
| `lib/auth.js` | Cadastro, login (scrypt) e sessão por cookie assinado |
| `public/entrar.html` | Tela de login e cadastro |
| `public/index.html` | Tela do app: enviar foto, comparar antes/depois, salvar |

## Limitações

- Usuários cadastrados ficam em `data/usuarios.json`. Em hospedagens com disco temporário esse
  arquivo some quando o serviço reinicia; a conta de demonstração continua funcionando.
- Não há recuperação de senha, cota de fotos por usuário nem leitura de HEIC no servidor
  (o navegador do iPhone já converte ao enviar).

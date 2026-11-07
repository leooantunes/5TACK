# Segurança dos dados — 5TACK

Revisão feita sobre o código deste repositório (versão 0.1.0). Ela lista **quais dados o app precisa**, **como cada um está protegido** e **o que ainda falta antes de ir para produção**.

---

## 1. Inventário de dados

| Dado | Classificação | Por que é preciso | Onde fica | Proteção |
|---|---|---|---|---|
| E-mail | **Pessoal (LGPD)** | Login e recuperação de conta | Servidor | Nunca sai em rotas públicas (ranking só mostra o nick). Normalizado em minúsculas. |
| Senha | **Credencial** | Login | Servidor, só como **hash bcrypt (custo 12)** | Nunca é armazenada nem registrada em log em texto puro. |
| Nick público | Pessoal (pseudônimo) | Ranking | Servidor | Validado: 3–20 caracteres, sem HTML ou URL. |
| Access token (JWT) | **Credencial** | Autorizar as requisições | Celular: Keychain/Keystore | Validade de 15 min, algoritmo fixo HS256, segredo de no mínimo 32 caracteres. |
| Refresh token | **Credencial** | Renovar a sessão | Celular: Keychain/Keystore · Servidor: só o **hash SHA-256** | Validade de 30 dias, **uso único (rotação)**, revogado no logout e na exclusão da conta. |
| Lineups | Dado do usuário | O jogo em si | Servidor | Só o dono lê e altera o próprio lineup. |
| Chave da PandaScore | **Segredo do negócio** | Buscar estatísticas | **Só no servidor** (variável de ambiente) | Nunca vai para o app. Nunca aparece em log nem em mensagem de erro. |
| Estatísticas de jogadores | Público / licenciado | Pontuação | Servidor (cache) | Validadas com schema; o uso segue a licença do fornecedor. |

**Princípio de minimização:** o app não pede nome real, CPF, data de nascimento, telefone nem localização. Não há pagamento.

---

## 2. Controles implementados

### Segredos e configuração
- A chave da API de dados fica só no backend. O app conhece apenas a URL do próprio backend (`apps/mobile/src/data/config.ts`). Variáveis `EXPO_PUBLIC_*` ficam visíveis dentro do app, por isso não há segredo nelas.
- O backend **não sobe** com segredo fraco ou ausente: `JWT_SECRET` precisa ter pelo menos 32 caracteres, o valor de exemplo é recusado em produção e `PANDASCORE_TOKEN` é obrigatório quando o provider é `pandascore` (`apps/api/src/config/env.ts`).
- `.env` está no `.gitignore`; só os arquivos `.env.example` vão para o repositório.

### Transporte
- Em build de produção, o app **recusa API sem HTTPS**. A única exceção é `localhost`, para testes na própria máquina.
- O backend envia cabeçalhos de segurança via `@fastify/helmet`, incluindo HSTS e nosniff.

### Autenticação e sessão
- Senhas guardadas com bcrypt (custo 12) e regra mínima: 8 caracteres, com letras e números.
- O login devolve um **erro genérico** e faz uma comparação de hash falsa quando o e-mail não existe. Assim, nem o texto nem o tempo de resposta revelam se a conta existe.
- Access token curto (15 min) + refresh token opaco, guardado como hash, de **uso único**. Reusar um refresh token antigo falha.
- O app renova a sessão uma única vez quando recebe 401 (*single-flight*) e, se a renovação falhar, apaga os tokens e volta ao login.
- No celular, os tokens ficam em `expo-secure-store` com `WHEN_UNLOCKED_THIS_DEVICE_ONLY`: só são lidos com o aparelho desbloqueado e não migram em backup. Na web, ficam só em memória, nunca em `localStorage`.
- `android.allowBackup: false` no `app.json`.

### Entrada de dados e regras de negócio
- **Todo corpo e parâmetro** de requisição passa por schema zod (`apps/api/src/http/schemas.ts`). IDs aceitam apenas `[A-Za-z0-9_-]`.
- **O servidor não confia no cliente:** ao salvar um lineup, ele revalida orçamento, limite de jogadores por time, funções e horário de travamento usando **o próprio relógio e os próprios preços**, com a mesma função do pacote `core` (`LineupService.save`).
- O app também valida todas as respostas da API com zod. Um dado inesperado vira mensagem de erro, não crash.
- Limite de 16 KB por corpo de requisição.

### Abuso
- Rate limit global de 120 requisições por minuto por IP, e **10 por minuto** nas rotas de login, cadastro e refresh (contra força bruta).
- Cache de 5 min no catálogo, para proteger a cota da PandaScore.
- CORS com **lista explícita** de origens e métodos. O app nativo não depende de CORS.

### Privacidade (LGPD)
- `DELETE /me` apaga a conta, os lineups e todas as sessões. O botão "Excluir minha conta" está no app.
- O ranking expõe só o nick, a posição e os pontos. O teste automatizado garante que nenhum `@` aparece na resposta.
- Os logs ocultam `authorization`, `password`, `refreshToken` e `accessToken`. Erros 500 devolvem uma mensagem genérica, e os detalhes ficam só no log do servidor.

### Fornecedor externo
- Timeout de 10 s por chamada, resposta validada por schema e token só no header.

---

## 3. Verificação automatizada

`npm test` executa, entre outros:

| Teste | O que garante |
|---|---|
| `não sobe com JWT_SECRET curto` | Servidor recusa segredo fraco |
| `não sobe com provider pandascore sem token` | Configuração incompleta falha cedo |
| `envia cabeçalhos de segurança` | Helmet ativo |
| `rejeita senha fraca e nome com HTML` | Validação de entrada |
| `login com erro genérico` | Não revela se o e-mail existe |
| `bloqueia lineup sem token` | Autenticação obrigatória |
| `refresh token é de uso único` | Rotação funciona |
| `servidor revalida o lineup` | Cliente adulterado não burla as regras |
| `ranking não expõe e-mail` | Minimização de dados |
| `exclusão de conta invalida a sessão` | LGPD + revogação |
| `rejeita jogador inexistente (cliente adulterado)` | Regra no domínio (`core`) |

**Auditoria de dependências (`npm audit --omit=dev`):** o `zod` foi atualizado para a 4.6.7 para corrigir uma vulnerabilidade *high* (GHSA-mrhx-c7xc-m3w5). Restam alertas *moderate* em `glob` e `minimatch`, dentro das ferramentas de linha de comando da Expo (`@expo/cli`). Elas rodam só no ambiente de desenvolvimento e não vão para o app nem para o servidor. Vale atualizar quando a Expo publicar a correção.

---

## 4. Pendências antes de produção

Prioridade **alta**:
1. **Banco de dados real (PostgreSQL)** no lugar dos repositórios em memória, com acesso restrito à rede privada, backups criptografados e usuário de banco com o mínimo de privilégios.
2. **Gerenciador de segredos** (variáveis do provedor de hospedagem, Doppler, AWS Secrets Manager etc.) e rotação periódica do `JWT_SECRET` e do token da PandaScore.
3. **HTTPS obrigatório** no domínio da API (TLS no proxy ou na plataforma) e `trustProxy` configurado de acordo.
4. **Rate limit distribuído (Redis)** se houver mais de uma instância do backend.
5. **Política de Privacidade e Termos de Uso** publicados e linkados no app e nas lojas, com base legal da LGPD e canal do encarregado de dados.
6. **Verificação de e-mail e recuperação de senha** com token de uso único e expiração curta.

Prioridade **média**:
7. O cadastro devolve 409 quando o e-mail já existe, o que permite descobrir contas cadastradas. Para eliminar isso, troque por "verifique seu e-mail" em todos os casos (depende do item 6).
8. O access token não pode ser revogado antes de expirar (até 15 min). Se for preciso derrubar sessões na hora, use uma *denylist* por `jti` no Redis.
9. Monitoramento de erros (Sentry) com remoção de dados pessoais antes do envio.
10. Login social (Google, Apple, Steam OpenID), que reduz o risco de senha reutilizada.
11. Política de idade mínima: o público de CS inclui menores. Sem prêmios em dinheiro, o risco é menor, mas os termos devem tratar disso.

Prioridade **baixa / avaliar**:
12. *Certificate pinning* no app (protege contra proxy malicioso, mas complica a rotação de certificados).
13. App Attest / Play Integrity, para dificultar automação de contas.
14. O `userId` (UUID) aparece no ranking para destacar "você". Se preferir, troque por um booleano `isMe` calculado no servidor.

---

## 5. Regras para quem for mexer no código

- Nunca coloque segredo em `EXPO_PUBLIC_*`, em `app.json` ou no código do app.
- Nunca use `AsyncStorage` para tokens. Use o `TokenStorage`.
- Toda rota nova precisa de schema zod e, se mexer em dados do usuário, de `preHandler: authenticate` e de filtro pelo `req.user.sub`.
- Regra de negócio nova vai no `packages/core` e é chamada **também** no servidor.
- Nunca registre corpo de requisição em log sem passar pelo `redact`.

# 5TACK — Fantasy de CS2

> **5TACK** (lê-se *five-stack*): no CS, *five-stack* é o time de 5 que joga junto, exatamente o que você monta no draft. O "5" no lugar do "S" vira a marca.

App mobile (React Native + Expo) de fantasy de Counter-Strike 2. O usuário escala 5 jogadores profissionais com um orçamento virtual, dá uma função para cada um e pontua com o desempenho real deles em cada mapa.

> ⚠️ Antes de registrar o nome, faça uma busca de marca no INPI e nas lojas de apps.

---

## Estrutura (monorepo)

```
5tack/
├── packages/core/        ← DOMÍNIO puro: pontuação, regras de draft, preços (sem UI, sem rede)
├── apps/api/             ← BACKEND: guarda a chave da API de dados, valida tudo, calcula ranking
└── apps/mobile/          ← APP Expo em camadas
```

O **mesmo** pacote `core` roda no app (feedback instantâneo no draft) e no servidor (fonte da verdade). Uma regra nunca é escrita duas vezes.

### Camadas do app (`apps/mobile/src`)

```
app/            Rotas (Expo Router). Arquivos finos: só ligam a URL a uma tela.
presentation/   UI: telas, componentes, tema, textos (pt-BR), formatação.
application/    Casos de uso: stores (sessão, draft), hooks de consulta, PORTAS (interfaces).
data/           Implementações: cliente HTTP, gateways, armazenamento seguro de tokens, schemas.
domain/         Reexporta o @5tack/core + tipos da fronteira com a API.
di.ts           Composition root: único lugar que liga as portas às implementações.
```

**Regra de dependência:** `presentation → application → domain` e `data → application (portas) + domain`. A UI nunca importa `data/` e nunca faz `fetch`. Para testar ou rodar offline, basta trocar os gateways no `di.ts`.

### Camadas do backend (`apps/api/src`)

```
config/         Variáveis de ambiente validadas (o servidor não sobe com segredo fraco)
http/           Fastify: rotas, schemas zod, segurança (helmet, CORS, rate limit, JWT)
application/    Serviços: Auth, Catalog (com cache), Lineup (valida e pontua)
infra/          DataProvider (Mock, PandaScore) e repositórios (memória → Postgres)
container.ts    Injeção de dependências
```

---

## Rodando localmente

Requisitos: Node 20+ e o app **Expo Go** no celular (ou um emulador).

```bash
npm install

# 1) Backend (dados fictícios, sem precisar de chave)
cp apps/api/.env.example apps/api/.env
#   edite JWT_SECRET; para gerar:
#   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
npm run api            # http://localhost:3333

# 2) App
cp apps/mobile/.env.example apps/mobile/.env
#   celular físico: EXPO_PUBLIC_API_URL=http://<IP-do-seu-PC>:3333
#   emulador Android: EXPO_PUBLIC_API_URL=http://10.0.2.2:3333
npm run mobile         # escaneie o QR code com o Expo Go
```

Para usar dados reais: em `apps/api/.env`, `DATA_PROVIDER=pandascore` e `PANDASCORE_TOKEN=<sua chave>`. O calendário funciona no plano gratuito; as estatísticas (pontuação) exigem o plano Historical. Confira o mapeamento de `listMapStats` em `PandaScoreProvider.ts` com respostas reais antes de lançar.

### Qualidade

```bash
npm run typecheck      # TypeScript estrito nos 3 pacotes
npm test               # 13 testes de domínio + 10 testes de API/segurança
```

---

## Funcionalidades (MVP)

- Cadastro e login com sessão persistida no cofre seguro do aparelho
- Lista de torneios (draft aberto / em andamento / encerrados), com contagem regressiva até o lineup travar
- **Draft**: orçamento de $1M, 5 vagas, no máximo 2 jogadores por time, filtro por time e busca
- **Funções** (STAR ×1,25 · ENTRY · AWP · CLUTCH · SUP): cada uma usada uma vez; toque no selo para trocar
- Meu time com pontuação total e detalhada por jogador
- Partidas e ranking do torneio
- Perfil com as regras de pontuação (lidas do próprio `core`), logout e exclusão de conta (LGPD)

## Design

Visual inspirado no HUD do CS2: fundo grafite, **laranja do lado T** como destaque e **azul do lado CT** como cor secundária, painéis com cantoneiras de mira, tipografia condensada **Rajdhani** e números de placar em **JetBrains Mono**. Os tokens ficam em `apps/mobile/src/presentation/theme/tokens.ts`.

Os times e jogadores do modo mock são **fictícios**, para não atribuir estatísticas inventadas a pessoas reais.

## Segurança

Veja **[SECURITY.md](./SECURITY.md)**: inventário de dados, controles implementados, testes e pendências antes de produção.

## Próximos passos

1. PostgreSQL + migrações (as interfaces dos repositórios já estão prontas)
2. Job de sincronização pós-mapa (a cada 5 min durante os torneios)
3. Boosters na interface (a regra já existe no `core`)
4. Ligas privadas com código de convite
5. Push notifications (lineup trava em 1h, resultado do mapa)

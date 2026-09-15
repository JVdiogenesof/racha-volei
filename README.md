# VPA Racha

Site para organizar o racha de vôlei: cadastro com aprovação, autoavaliação de
habilidade, geração automática de times balanceados, confirmação de presença,
controle de pagamento, avisos, ranking, Jogador Destaque e reserva de vaga
pro Torneio VPA.

Stack: Next.js (App Router) + TypeScript + Tailwind + Supabase (auth, banco de
dados e storage) + Drizzle (schema do banco).

## Como colocar pra rodar (passo a passo)

### 1. Criar o projeto no Supabase (grátis)

1. Crie uma conta em [supabase.com](https://supabase.com) e clique em "New project".
2. Anote a senha do banco que você definir na criação — vai precisar dela no passo 3.
3. Depois que o projeto for criado, vá em **Project Settings > API** e copie:
   - `Project URL`
   - `anon public` key
4. Vá em **Project Settings > Database > Connection string > URI** e copie a
   connection string (troque `[YOUR-PASSWORD]` pela senha do passo 2).

### 2. Configurar o login com Google

1. Vá em **Authentication > Sign In / Providers > Google** no painel do Supabase
   e ative o provedor.
2. Crie um client OAuth em [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   (tipo "Web application"). Em "Authorized redirect URIs", cole a URL de
   callback que o próprio Supabase mostra na tela do passo 1 (algo como
   `https://SEU-PROJETO.supabase.co/auth/v1/callback`).
3. Copie o Client ID e Client Secret gerados pelo Google e cole nos campos
   correspondentes na tela do Supabase (passo 1), depois salve.

### 3. Configurar as variáveis de ambiente

Copie `.env.local.example` para `.env.local` e preencha com os valores do
passo 1:

```bash
cp .env.local.example .env.local
```

### 4. Criar as tabelas do banco

```bash
npm install
npm run db:push
```

Isso cria todas as tabelas a partir de `src/db/schema.ts`.

### 5. Aplicar as regras de segurança (RLS)

Abra o **SQL Editor** do Supabase e rode todo o conteúdo do arquivo
[`supabase/rls.sql`](supabase/rls.sql). Isso liga o cadastro ao login do
Google, ativa as permissões (quem pode ver/editar o quê) e configura o
storage das fotos de avisos.

### 6. Criar o bucket de fotos dos avisos

Em **Storage**, crie um bucket chamado `avisos` marcado como **Public
bucket**. (As permissões de leitura/escrita já foram configuradas no passo 5.)

### 7. Rodar o site localmente

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000), faça login com sua conta
Google — isso cria seu cadastro como pendente.

### 8. Virar organizador

Como ninguém ainda é organizador, aprove e promova a si mesmo direto pelo
**Table Editor** do Supabase: abra a tabela `profiles`, ache sua linha (pelo
nome) e mude `status` para `approved` e `is_organizer` para `true`. Faça o
mesmo depois para o seu amigo. A partir daí, vocês dois aprovam os próximos
cadastros direto pelo site, em **Admin > Solicitações**.

### 9. Colocar no ar (grátis)

Suba o projeto num repositório no GitHub e importe em [vercel.com](https://vercel.com/new).
Configure as mesmas variáveis de ambiente do `.env.local` nas configurações do
projeto na Vercel (Settings > Environment Variables). Cada push no GitHub gera
um novo deploy automaticamente.

## Comandos úteis

- `npm run dev` — roda localmente
- `npm run build` — build de produção
- `npm run db:push` — aplica o schema (`src/db/schema.ts`) no banco
- `npm run db:studio` — abre uma interface visual pra explorar o banco

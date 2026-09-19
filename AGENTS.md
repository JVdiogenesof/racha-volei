## Fluxo de trabalho combinado com o proprietario

- O proprietario quer pedir mudancas em linguagem natural e receber a funcionalidade implementada, testada e publicada. Pedidos de alteracao incluem autorizacao para os commits, push e publicacao correspondentes, salvo se ele pedir apenas analise, planejamento ou preview. Nao pedir a mesma autorizacao novamente a cada etapa rotineira.
- Repositorio: `JVdiogenesof/racha-volei`. Producao: branch `master`. Projeto Vercel: `jvdiogenesof/racha-volei`, ID `prj_hyYECPvTPh0H1dfFiYJSHpGj5GFm`. Supabase: `yrqxwqufxzhfpztgfdnx`.
- A integracao GitHub/Vercel estava ativa em 2026-09-19, com publicacao automatica da branch `master`. Confirmar a configuracao quando necessario e verificar o resultado real do deploy; push bem-sucedido nao comprova publicacao bem-sucedida.
- Antes de editar, ler estas instrucoes, conferir `git status`, atualizar as referencias remotas e preservar alteracoes existentes. Usar branches `codex/` para isolar trabalho quando apropriado. Respeitar protecoes de branch e nunca usar force-push para contorna-las.
- Implementar a mudanca completa, verificar os fluxos afetados e executar lint, verificacao TypeScript e build quando aplicaveis. Registrar falhas preexistentes separadamente. Nao afirmar que testes passaram se nao foram executados; nao publicar implementacao com falhas relevantes nao resolvidas.
- Ao publicar, incluir apenas arquivos pertinentes, enviar as mudancas para o fluxo de producao permitido pelo repositorio e acompanhar a Vercel ate o resultado. Conferir o site publicado e informar o que mudou, a validacao realizada e o link.
- Mudancas no Supabase precisam ser aplicadas separadamente do git push. Conferir o schema atual e preparar SQL versionado e revisavel. Preferir migracoes aditivas e compativeis com a versao atualmente publicada. Exclusoes irreversiveis de dados exigem confirmacao especifica.
- O comando `npm run db:push` tambem reaplica `supabase/rls.sql` por `scripts/apply-rls.js`. Esse script remove e recria policies e algumas constraints. Nao executar como teste de conexao ou configuracao inicial; revisar o impacto antes de qualquer execucao e preservar as regras RLS.
- Manter credenciais no armazenamento das ferramentas ou em arquivos locais ignorados pelo Git. Nunca colocar senhas, tokens ou valores de variaveis de ambiente em commits, logs ou respostas. Valores `[SENSITIVE]` baixados da Vercel sao placeholders, nao credenciais utilizaveis. Nao sobrescrever chaves de producao apenas para viabilizar testes locais.
- As instrucoes persistem no repositorio; autenticacao depende da maquina e da validade das sessoes. Se faltar acesso, concluir o trabalho independente e pedir somente a intervencao necessaria.
- Nesta maquina, o token da Management API do Supabase fica em `.env.supabase.local`, variavel `SUPABASE_ACCESS_TOKEN`. Ler sem imprimir, por exemplo com `node:util.parseEnv`, e enviar como Bearer somente para `https://api.supabase.com`. Consultas SQL usam `POST /v1/projects/yrqxwqufxzhfpztgfdnx/database/query`, corpo `{ query, read_only: true }` para inspecao. Para migracoes autorizadas, usar `read_only: false` com SQL revisado. Esse acesso nao depende de `DATABASE_URL`; comandos Drizzle continuam exigindo a conexao Postgres separadamente.
- Validacao local: `npm run lint`, `npx tsc --noEmit` e `npm run build`, alem dos testes funcionais pertinentes. Os scripts CommonJS em `scripts/` usam `require` intencionalmente. Para funcionalidades autenticadas, usar uma conta de teste autorizada, sem desativar login ou RLS.
- A chave privada VAPID de producao e sensivel e nao pode ser exportada da Vercel. Testes locais de notificacoes exigem credenciais de teste apropriadas; nao enviar notificacoes para usuarios reais como teste e nao substituir as chaves de producao.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

// Reaplica supabase/rls.sql no banco. Roda sozinho depois de "npm run db:push"
// (veja package.json) porque o drizzle-kit push sincroniza o banco só com o
// que está em src/db/schema.ts — RLS, policies e a FK pra auth.users não
// fazem parte desse schema (são mantidos à mão em rls.sql), então o
// drizzle-kit as enxerga como "coisa fora do padrão" e pode removê-las ao
// sincronizar. Sem isso, um "db:push" desligaria a segurança do banco de
// novo sem ninguém perceber.
//
// Antes de rodar o rls.sql, apaga as policies existentes nas tabelas do app
// (senão "create policy" falha com "already exists" na segunda vez em diante).

const fs = require("fs");
const path = require("path");
const postgres = require("postgres");

const APP_TABLES = [
  "profiles",
  "self_ratings",
  "organizer_ratings",
  "rating_weights",
  "events",
  "attendance",
  "payments",
  "team_generations",
  "teams",
  "team_members",
  "announcements",
  "mvp_votes",
  "match_wins",
  "ranking_adjustments",
  "reserve_list",
  "push_subscriptions",
  "reaction_types",
  "reactions",
];

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL não encontrada (esperada em .env.local).");
    process.exit(1);
  }

  const sql = postgres(process.env.DATABASE_URL);
  try {
    const policies = await sql`
      select schemaname, tablename, policyname from pg_policies
      where tablename = any(${APP_TABLES}) or tablename = 'objects'
    `;
    for (const p of policies) {
      await sql.unsafe(`drop policy if exists "${p.policyname}" on ${p.schemaname}.${p.tablename}`);
    }
    await sql`alter table profiles drop constraint if exists profiles_id_auth_users_id_fk`;
    await sql`alter table reserve_list drop constraint if exists reserve_list_auth_user_id_fk`;
    await sql`alter table profiles drop constraint if exists profiles_guest_for_event_id_fk`;

    const script = fs.readFileSync(path.join(__dirname, "..", "supabase", "rls.sql"), "utf8");
    await sql.unsafe(script);
    console.log(`rls.sql reaplicado com sucesso (${policies.length} policies antigas substituídas).`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error("Falha ao aplicar rls.sql:", e.message);
  process.exit(1);
});

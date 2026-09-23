import {
  pgTable,
  uuid,
  text,
  date,
  time,
  boolean,
  numeric,
  integer,
  timestamp,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";

export const skillCategoryEnum = pgEnum("skill_category", [
  "attack",
  "setting",
  "serve",
  "reception",
  "defense",
  "block",
]);

export const profileStatusEnum = pgEnum("profile_status", [
  "pending",
  "approved",
  "rejected",
  "removed",
  "guest",
]);

export const eventStatusEnum = pgEnum("event_status", [
  "open",
  "teams_generated",
  "in_progress",
  "finished",
  "cancelled",
]);

export const rankingMetricEnum = pgEnum("ranking_metric", [
  "attendance",
  "mvp",
  "wins",
]);

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "confirmed",
  "declined",
  "interested",
]);

export const attendanceFrequencyEnum = pgEnum("attendance_frequency", [
  "weekly",
  "biweekly",
  "monthly",
]);

// Estende auth.users do Supabase (id compartilhado com o usuário autenticado).
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name").notNull(),
  birthdate: date("birthdate"),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  // Apelido/insígnia divertida que o próprio jogador escolhe (ou que um
  // organizador ajusta), tipo "só tenho ataque". Puramente decorativo, exibido
  // ao lado do nome -- não entra em nenhum cálculo.
  nicknameBadge: text("nickname_badge"),
  isSetter: boolean("is_setter").notNull().default(false),
  attendanceFrequency: attendanceFrequencyEnum("attendance_frequency"),
  hasVpaShirt: boolean("has_vpa_shirt").notNull().default(false),
  wantsTournaments: boolean("wants_tournaments").notNull().default(false),
  isOrganizer: boolean("is_organizer").notNull().default(false),
  status: profileStatusEnum("status").notNull().default("pending"),
  approvedBy: uuid("approved_by"),
  // Só preenchido quando status = "guest": acesso temporário de gente de fora
  // do grupo, restrito a esse racha específico. Some sozinho (cascade) se o
  // racha for apagado, e o próprio guest é apagado quando o racha termina.
  // FK pra events.id é adicionada à mão em rls.sql (referência cruzada com
  // events.created_by -> profiles.id confundiria a inferência de tipos do Drizzle).
  guestForEventId: uuid("guest_for_event_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const selfRatings = pgTable(
  "self_ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    category: skillCategoryEnum("category").notNull(),
    value: numeric("value", { precision: 3, scale: 2 }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.profileId, t.category)],
);

export const organizerRatings = pgTable(
  "organizer_ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    category: skillCategoryEnum("category").notNull(),
    value: numeric("value", { precision: 3, scale: 2 }).notNull(),
    ratedBy: uuid("rated_by").notNull().references(() => profiles.id),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.profileId, t.category)],
);

export const ratingWeights = pgTable("rating_weights", {
  id: uuid("id").primaryKey().defaultRandom(),
  selfWeight: numeric("self_weight", { precision: 3, scale: 2 }).notNull().default("0.4"),
  organizerWeight: numeric("organizer_weight", { precision: 3, scale: 2 }).notNull().default("0.6"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: date("date").notNull(),
  time: time("time"),
  location: text("location"),
  numTeams: integer("num_teams").notNull().default(2),
  pricePerPlayer: numeric("price_per_player", { precision: 8, scale: 2 }),
  // Vagas de confirmados (opcional). Sem limite quando null — só usado pra
  // avisar quem marcar interesse depois que a lista já estiver cheia.
  maxPlayers: integer("max_players"),
  status: eventStatusEnum("status").notNull().default("open"),
  // Fase de interesse (false) vs lista de confirmados pública (true). Novos
  // rachas nascem em fase de interesse; o organizador monta a lista de
  // confirmados manualmente e só a publica quando estiver pronta.
  officialListOpen: boolean("official_list_open").notNull().default(true),
  // Até dois "Jogadores Destaque" escolhidos pelos organizadores depois que o
  // racha termina (sem votação, dois slots independentes).
  mvpProfileId: uuid("mvp_profile_id").references(() => profiles.id, { onDelete: "set null" }),
  mvpProfileId2: uuid("mvp_profile_id_2").references(() => profiles.id, { onDelete: "set null" }),
  // Racha especial marcado pelo organizador: ao finalizar, o(s) time(s) com
  // mais vitórias garantem vaga automática no próximo Torneio VPA (ver
  // tournamentReservedPlayers).
  isPreTorneio: boolean("is_pre_torneio").notNull().default(false),
  createdBy: uuid("created_by").notNull().references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const attendance = pgTable(
  "attendance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    status: attendanceStatusEnum("status").notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull().defaultNow(),
    // Só preenchido quando a pessoa estava confirmada e saiu da lista -- marcar
    // "não vou" sem nunca ter confirmado não conta como cancelamento pro aviso
    // do organizador.
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (t) => [unique().on(t.eventId, t.profileId)],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    paid: boolean("paid").notNull().default(false),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    markedBy: uuid("marked_by").references(() => profiles.id),
  },
  (t) => [unique().on(t.eventId, t.profileId)],
);

export const teamGenerations = pgTable("team_generations", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  generatedBy: uuid("generated_by").notNull().references(() => profiles.id),
});

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  generationId: uuid("generation_id").notNull().references(() => teamGenerations.id, { onDelete: "cascade" }),
  teamNumber: integer("team_number").notNull(),
});

export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  },
  (t) => [unique().on(t.teamId, t.profileId)],
);

export const matchWins = pgTable("match_wins", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  recordedBy: uuid("recorded_by").notNull().references(() => profiles.id),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  // Só preenchido quando a vitória vem de um confronto estruturado de racha
  // pré-torneio (grupo/final/3º lugar) -- deixa corrigir/desfazer o placar
  // sem duplicar ou deixar vitória errada presa no ranking.
  matchId: uuid("match_id").references(() => tournamentMatches.id, { onDelete: "cascade" }),
  // Nos confrontos de racha normal, guarda também o time derrotado e uma
  // fotografia dos integrantes dos dois times naquele momento. Os arrays
  // impedem que uma troca posterior de jogador reescreva o histórico pessoal.
  loserTeamId: uuid("loser_team_id").references(() => teams.id, { onDelete: "cascade" }),
  winningProfileIds: uuid("winning_profile_ids").array(),
  losingProfileIds: uuid("losing_profile_ids").array(),
});

export const tournamentMatchStageEnum = pgEnum("tournament_match_stage", ["group", "final", "third_place"]);

// Confrontos da fase de grupos (todos contra todos) e da final de um racha
// pré-torneio -- placar nulo até o organizador lançar o resultado. Só usada
// pra racha pré-torneio; racha normal continua com match_wins.
export const tournamentMatches = pgTable("tournament_matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  teamAId: uuid("team_a_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  teamBId: uuid("team_b_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  stage: tournamentMatchStageEnum("stage").notNull(),
  scoreA: integer("score_a"),
  scoreB: integer("score_b"),
  playedAt: timestamp("played_at", { withTimezone: true }),
});

// Correção manual de um dos rankings (presença/MVP/vitórias) feita por um
// organizador. Somada em cima do valor calculado — não substitui o cálculo,
// só ajusta pra corrigir casos que fugiram do fluxo normal do site.
export const rankingAdjustments = pgTable("ranking_adjustments", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  metric: rankingMetricEnum("metric").notNull(),
  delta: integer("delta").notNull(),
  reason: text("reason"),
  createdBy: uuid("created_by").notNull().references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const announcements = pgTable("announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  imageUrl: text("image_url"),
  createdBy: uuid("created_by").notNull().references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Pessoas de fora do grupo fixo que topam ser chamadas quando sobra vaga
// num racha. Fluxo separado do cadastro normal (sem aprovação, sem acesso
// ao resto do site) -- nome, telefone e bairro (pra saber quem dá pra chamar
// rápido numa emergência de última hora) pros organizadores ligarem.
export const reserveList = pgTable("reserve_list", {
  id: uuid("id").primaryKey().defaultRandom(),
  authUserId: uuid("auth_user_id").notNull().unique(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  neighborhood: text("neighborhood"),
  contacted: boolean("contacted").notNull().default(false),
  // Autoavaliação preenchida na hora da inscrição na reserva -- copiada pra
  // self_ratings quando a pessoa ganha um perfil de verdade (convidada pra
  // um racha ou promovida a permanente), já que ainda não existe profiles.id
  // pra referenciar nesse momento.
  selfAttack: numeric("self_attack", { precision: 3, scale: 2 }),
  selfSetting: numeric("self_setting", { precision: 3, scale: 2 }),
  selfServe: numeric("self_serve", { precision: 3, scale: 2 }),
  selfReception: numeric("self_reception", { precision: 3, scale: 2 }),
  selfDefense: numeric("self_defense", { precision: 3, scale: 2 }),
  selfBlock: numeric("self_block", { precision: 3, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Uma linha por aparelho/navegador inscrito pra notificação push. Reinscrever
// o mesmo aparelho sobrescreve a linha (unique em endpoint) -- não cresce por
// notificação enviada, só por aparelho distinto, e se apagam sozinhas quando
// o envio falha porque o aparelho não existe mais (ver src/lib/push.ts).
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Catálogo de frases de reação/provocação editável pelos organizadores.
// "{alvo}" no texto é substituído pelo nome de quem recebeu a reação na hora
// de exibir (ver src/lib/reactions.ts). Pequeno e só muda quando um
// organizador edita -- não cresce com o uso.
export const reactionTypes = pgTable("reaction_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  text: text("text").notNull(),
  active: boolean("active").notNull().default(true),
  createdBy: uuid("created_by").notNull().references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Log de quem mandou qual reação pra quem. Cresce com o uso, mas cada linha é
// minúscula e reações com mais de REACTION_RETENTION_DAYS somem sozinhas (ver
// src/lib/reactions.ts) -- nunca acumula de verdade.
export const reactions = pgTable("reactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromProfileId: uuid("from_profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  toProfileId: uuid("to_profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  reactionTypeId: uuid("reaction_type_id").notNull().references(() => reactionTypes.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Quem já garantiu vaga no próximo Torneio VPA -- preenchido sozinho quando
// um racha pré-torneio termina (time com mais vitórias) ou à mão por um
// organizador. "Limpar lista" (ver /torneios-vpa) esvazia tudo pra começar
// um novo ciclo de 45 dias.
export const tournamentReservedPlayers = pgTable("tournament_reserved_players", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id").notNull().unique().references(() => profiles.id, { onDelete: "cascade" }),
  // Nulo quando adicionado manualmente por um organizador, em vez de vir de
  // um racha pré-torneio.
  sourceEventId: uuid("source_event_id").references(() => events.id, { onDelete: "set null" }),
  addedBy: uuid("added_by").notNull().references(() => profiles.id),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mvpVotes = pgTable(
  "mvp_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    voterProfileId: uuid("voter_profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    votedForProfileId: uuid("voted_for_profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.eventId, t.voterProfileId)],
);

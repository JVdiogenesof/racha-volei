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
  isSetter: boolean("is_setter").notNull().default(false),
  attendanceFrequency: attendanceFrequencyEnum("attendance_frequency"),
  hasVpaShirt: boolean("has_vpa_shirt").notNull().default(false),
  wantsTournaments: boolean("wants_tournaments").notNull().default(false),
  isOrganizer: boolean("is_organizer").notNull().default(false),
  status: profileStatusEnum("status").notNull().default("pending"),
  approvedBy: uuid("approved_by"),
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
  status: eventStatusEnum("status").notNull().default("open"),
  // Fase de interesse (false) vs lista oficial aberta (true). Novos rachas
  // nascem em fase de interesse; o organizador abre a lista oficial quando
  // achar que já tem gente boa suficiente confirmando interesse.
  officialListOpen: boolean("official_list_open").notNull().default(true),
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
// ao resto do site) -- só nome e telefone pros organizadores ligarem.
export const reserveList = pgTable("reserve_list", {
  id: uuid("id").primaryKey().defaultRandom(),
  authUserId: uuid("auth_user_id").notNull().unique(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  contacted: boolean("contacted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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

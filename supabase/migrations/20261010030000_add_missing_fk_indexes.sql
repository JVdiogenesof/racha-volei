-- Índices para foreign keys que o advisor de performance do Supabase
-- reportou como "unindexed_foreign_keys" (42 ocorrências em 2026-10-10).
-- Sem índice, toda vez que uma linha referenciada é apagada/atualizada o
-- Postgres faz um full scan na tabela filha pra checar a FK, e joins por
-- essas colunas (ex: relatórios financeiros, histórico de um jogador)
-- também ficam mais lentos à medida que as tabelas crescem.
--
-- Migration puramente aditiva: só cria índices, não altera dados nem
-- constraints existentes. Pode ser revertida linha a linha com
-- "drop index if exists <nome>;" sem risco.

create index if not exists idx_announcements_created_by on public.announcements (created_by);
create index if not exists idx_attendance_profile_id on public.attendance (profile_id);

create index if not exists idx_event_payment_intents_payer_profile_id on public.event_payment_intents (payer_profile_id);
create index if not exists idx_event_payment_transfers_payment_intent_id on public.event_payment_transfers (payment_intent_id);
create index if not exists idx_event_payment_transfers_to_profile_id on public.event_payment_transfers (to_profile_id);

create index if not exists idx_event_setter_overrides_changed_by on public.event_setter_overrides (changed_by);

create index if not exists idx_events_created_by on public.events (created_by);
create index if not exists idx_events_mvp_profile_id_2 on public.events (mvp_profile_id_2);
create index if not exists idx_events_mvp_profile_id on public.events (mvp_profile_id);

create index if not exists idx_finance_reminders_completed_by on public.finance_reminders (completed_by);
create index if not exists idx_finance_reminders_created_by on public.finance_reminders (created_by);

create index if not exists idx_finance_transactions_created_by on public.finance_transactions (created_by);
create index if not exists idx_finance_transactions_event_id on public.finance_transactions (event_id);
create index if not exists idx_finance_transactions_profile_id on public.finance_transactions (profile_id);
create index if not exists idx_finance_transactions_voided_by on public.finance_transactions (voided_by);

create index if not exists idx_mvp_votes_voted_for_profile_id on public.mvp_votes (voted_for_profile_id);
create index if not exists idx_mvp_votes_voter_profile_id on public.mvp_votes (voter_profile_id);

create index if not exists idx_organizer_ratings_rated_by on public.organizer_ratings (rated_by);

create index if not exists idx_payments_marked_by on public.payments (marked_by);
create index if not exists idx_payments_profile_id on public.payments (profile_id);

create index if not exists idx_player_balance_entries_granted_by on public.player_balance_entries (created_by);
create index if not exists idx_player_balance_entries_used_event_id on public.player_balance_entries (event_id);
create index if not exists idx_player_balance_entries_reversed_by on public.player_balance_entries (reversed_by);

create index if not exists idx_profiles_guest_for_event_id on public.profiles (guest_for_event_id);

create index if not exists idx_push_subscriptions_profile_id on public.push_subscriptions (profile_id);

create index if not exists idx_ranking_adjustments_created_by on public.ranking_adjustments (created_by);
create index if not exists idx_ranking_adjustments_profile_id on public.ranking_adjustments (profile_id);

create index if not exists idx_reserve_invitations_event_id on public.reserve_invitations (event_id);
create index if not exists idx_reserve_invitations_invited_by on public.reserve_invitations (invited_by);

create index if not exists idx_shirt_finance_transactions_created_by on public.shirt_finance_transactions (created_by);
create index if not exists idx_shirt_finance_transactions_profile_id on public.shirt_finance_transactions (profile_id);
create index if not exists idx_shirt_finance_transactions_voided_by on public.shirt_finance_transactions (voided_by);

create index if not exists idx_shirt_orders_marked_by on public.shirt_orders (marked_by);

create index if not exists idx_team_generations_event_id on public.team_generations (event_id);
create index if not exists idx_team_generations_generated_by on public.team_generations (generated_by);

create index if not exists idx_team_members_profile_id on public.team_members (profile_id);

create index if not exists idx_teams_generation_id on public.teams (generation_id);

create index if not exists idx_tournament_matches_event_id on public.tournament_matches (event_id);
create index if not exists idx_tournament_matches_team_a_id on public.tournament_matches (team_a_id);
create index if not exists idx_tournament_matches_team_b_id on public.tournament_matches (team_b_id);

create index if not exists idx_tournament_reserved_players_added_by on public.tournament_reserved_players (added_by);
create index if not exists idx_tournament_reserved_players_source_event_id on public.tournament_reserved_players (source_event_id);

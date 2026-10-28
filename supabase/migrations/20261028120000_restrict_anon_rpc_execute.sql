-- O linter de segurança do Supabase (advisor) aponta funções SECURITY
-- DEFINER executáveis pelo papel `anon` (visitante sem sessão) via
-- /rest/v1/rpc/*. Essas funções foram criadas sem "revoke execute from
-- public", então o Postgres deixa o grant padrão dele: EXECUTE liberado
-- pra PUBLIC (todo mundo, anon incluso) -- por isso "revoke ... from anon"
-- sozinho não bastava, precisa tirar de PUBLIC e devolver só pra quem
-- precisa (authenticated).
--
-- A maioria já se protege sozinha (ex.: accept_spot_offer/decline_spot_offer
-- checam `auth.uid() is null`), mas tirar a permissão de quem não devia
-- ter é defesa em profundidade -- sem usuário autenticado, o app nunca
-- precisa chamar nenhuma delas.
--
-- `is_organizer()` fica de fora de propósito: a policy pública
-- `spot_offers_select` (roles = public) usa essa função na cláusula
-- `using`, então revogar quebraria a leitura de spot_offers pra visitante
-- (erro "permission denied for function" em vez de retornar vazio).
revoke execute on function public.accept_spot_offer(uuid) from public;
revoke execute on function public.advance_spot_offer(uuid) from public;
revoke execute on function public.can_edit_own_profile() from public;
revoke execute on function public.can_participate_in_event(uuid) from public;
revoke execute on function public.decline_spot_offer(uuid) from public;
revoke execute on function public.enforce_pre_tournament_eligibility() from public;
revoke execute on function public.enforce_pre_tournament_payment_eligibility() from public;
revoke execute on function public.expire_my_guest_access() from public;
revoke execute on function public.guard_profile_privileged_columns() from public;
revoke execute on function public.has_active_spot_offer(uuid) from public;
revoke execute on function public.is_approved() from public;
revoke execute on function public.is_full_member() from public;
revoke execute on function public.mark_exempt_attendance_paid() from public;

-- Devolve só pra quem está logado -- é quem o app sempre usou pra chamar
-- essas rotas (todas apareciam também na lista "authenticated" do advisor).
grant execute on function public.accept_spot_offer(uuid) to authenticated;
grant execute on function public.advance_spot_offer(uuid) to authenticated;
grant execute on function public.can_edit_own_profile() to authenticated;
grant execute on function public.can_participate_in_event(uuid) to authenticated;
grant execute on function public.decline_spot_offer(uuid) to authenticated;
grant execute on function public.enforce_pre_tournament_eligibility() to authenticated;
grant execute on function public.enforce_pre_tournament_payment_eligibility() to authenticated;
grant execute on function public.expire_my_guest_access() to authenticated;
grant execute on function public.guard_profile_privileged_columns() to authenticated;
grant execute on function public.has_active_spot_offer(uuid) to authenticated;
grant execute on function public.is_approved() to authenticated;
grant execute on function public.is_full_member() to authenticated;
grant execute on function public.mark_exempt_attendance_paid() to authenticated;

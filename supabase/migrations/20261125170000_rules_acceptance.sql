-- Aceite do regulamento: a pessoa precisa aceitar a versão vigente ao entrar no app.
alter table public.profiles add column if not exists rules_accepted_version text;
alter table public.profiles add column if not exists rules_accepted_at timestamptz;

create or replace function public.accept_rules(p_version text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Entre na sua conta para aceitar o regulamento.'; end if;
  if p_version is null or length(trim(p_version)) = 0 then raise exception 'Versão do regulamento inválida.'; end if;
  update public.profiles
  set rules_accepted_version = p_version, rules_accepted_at = now()
  where id = auth.uid();
end;
$$;

revoke all on function public.accept_rules(text) from public, anon;
grant execute on function public.accept_rules(text) to authenticated;

-- Copa: horário em que a confirmação/pagamento abre (antes dele o Pix é recusado).
-- Aditiva: coluna nula = abre na hora, como antes. O resto da regra
-- (classificado, prazo) continua igual.
alter table public.cups add column if not exists confirm_opens_at timestamptz;

create or replace function public.cup_confirmation_gate(p_cup_id uuid, p_profile_id uuid)
 returns cups
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_cup public.cups%rowtype;
begin
  select * into v_cup from public.cups where id = p_cup_id for share;
  if not found then
    raise exception 'Copa não encontrada.';
  end if;
  if not exists (
    select 1 from public.cup_qualified_players where cup_id = p_cup_id and profile_id = p_profile_id
  ) then
    raise exception 'Só quem está classificado para a Copa pode confirmar presença.';
  end if;
  if v_cup.confirm_deadline is null then
    raise exception 'A confirmação de presença ainda não foi aberta.';
  end if;
  if v_cup.confirm_opens_at is not null and v_cup.confirm_opens_at > now() then
    raise exception 'A confirmação de presença abre em %.',
      to_char(v_cup.confirm_opens_at at time zone 'America/Fortaleza', 'DD/MM "às" HH24"h"MI');
  end if;
  if v_cup.confirm_deadline <= now() then
    raise exception 'O prazo para confirmar presença terminou.';
  end if;
  return v_cup;
end;
$function$;

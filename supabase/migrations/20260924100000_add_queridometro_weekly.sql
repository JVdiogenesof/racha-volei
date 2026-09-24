create table public.queridometro_reaction_types (
  key text primary key,
  emoji text not null,
  label text not null,
  description text not null,
  connection_label text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.queridometro_votes (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  from_profile_id uuid not null references public.profiles(id) on delete cascade,
  to_profile_id uuid not null references public.profiles(id) on delete cascade,
  reaction_key text not null references public.queridometro_reaction_types(key),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint queridometro_votes_no_self check (from_profile_id <> to_profile_id),
  constraint queridometro_votes_week_pair_unique unique (week_start, from_profile_id, to_profile_id)
);

create index queridometro_votes_week_to_idx on public.queridometro_votes (week_start, to_profile_id);
create index queridometro_votes_week_reaction_idx on public.queridometro_votes (week_start, reaction_key);

insert into public.queridometro_reaction_types
  (key, emoji, label, description, connection_label, sort_order)
values
  ('heart', '💜', 'Coração VPA', 'Pessoa querida pela galera.', 'Conexão VPA', 10),
  ('fun', '😂', 'Rei/Rainha da resenha', 'Sempre deixa o grupo mais divertido.', 'Dupla da resenha', 20),
  ('partner', '🤝', 'Parceiro de quadra', 'Alguém em quem você confia.', 'Dupla de confiança', 30),
  ('welcoming', '🫶', 'Acolhedor(a)', 'Faz todo mundo se sentir incluído.', null, 40),
  ('energy', '🔥', 'Energia lá em cima', 'Joga e incentiva com intensidade.', null, 50),
  ('admiration', '🌟', 'Admiração', 'Pessoa que você respeita.', null, 60),
  ('advisor', '🧠', 'Conselheiro(a)', 'Ajuda e orienta os outros.', null, 70),
  ('evolving', '🚀', 'Evoluindo muito', 'Melhorou bastante recentemente.', null, 80),
  ('wall', '🧱', 'Muralha', 'Destaque na defesa.', null, 90),
  ('decisive', '🎯', 'Decisivo(a)', 'Aparece quando o time precisa.', null, 100),
  ('play_more', '🏐', 'Quero jogar mais junto', 'Uma forma de criar novas parcerias.', 'Bora jogar juntos', 110),
  ('know_little', '🌱', 'Ainda conheço pouco', 'Opção neutra para quem ainda teve pouco contato.', null, 120);

alter table public.queridometro_reaction_types enable row level security;
alter table public.queridometro_votes enable row level security;

create policy "queridometro_types_select"
  on public.queridometro_reaction_types for select to authenticated
  using (true);

create policy "queridometro_types_update"
  on public.queridometro_reaction_types for update to authenticated
  using (public.is_organizer())
  with check (public.is_organizer());

create policy "queridometro_votes_select_own"
  on public.queridometro_votes for select to authenticated
  using (from_profile_id = auth.uid());

create policy "queridometro_votes_insert_own"
  on public.queridometro_votes for insert to authenticated
  with check (
    from_profile_id = auth.uid()
    and from_profile_id <> to_profile_id
    and week_start = date_trunc('week', timezone('America/Fortaleza', now()))::date
    and extract(dow from timezone('America/Fortaleza', now())) <> 0
    and exists (
      select 1 from public.profiles p
      where p.id = to_profile_id and p.status = 'approved'
    )
    and exists (
      select 1 from public.queridometro_reaction_types t
      where t.key = reaction_key and t.active = true
    )
  );

create policy "queridometro_votes_update_own"
  on public.queridometro_votes for update to authenticated
  using (from_profile_id = auth.uid())
  with check (
    from_profile_id = auth.uid()
    and from_profile_id <> to_profile_id
    and week_start = date_trunc('week', timezone('America/Fortaleza', now()))::date
    and extract(dow from timezone('America/Fortaleza', now())) <> 0
    and exists (
      select 1 from public.profiles p
      where p.id = to_profile_id and p.status = 'approved'
    )
    and exists (
      select 1 from public.queridometro_reaction_types t
      where t.key = reaction_key and t.active = true
    )
  );

create policy "queridometro_votes_delete_own"
  on public.queridometro_votes for delete to authenticated
  using (
    from_profile_id = auth.uid()
    and week_start = date_trunc('week', timezone('America/Fortaleza', now()))::date
    and extract(dow from timezone('America/Fortaleza', now())) <> 0
  );

create or replace function public.get_queridometro_results(p_week_start date)
returns table (to_profile_id uuid, reaction_key text, total bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select v.to_profile_id, v.reaction_key, count(*)::bigint as total
  from public.queridometro_votes v
  where v.week_start = p_week_start
    and auth.uid() is not null
    and (
      p_week_start < date_trunc('week', timezone('America/Fortaleza', now()))::date
      or (
        p_week_start = date_trunc('week', timezone('America/Fortaleza', now()))::date
        and extract(dow from timezone('America/Fortaleza', now())) = 0
      )
    )
  group by v.to_profile_id, v.reaction_key;
$$;

create or replace function public.get_my_queridometro_connections(p_week_start date)
returns table (other_profile_id uuid, reaction_key text, connection_label text)
language sql
stable
security definer
set search_path = ''
as $$
  select a.to_profile_id, a.reaction_key, t.connection_label
  from public.queridometro_votes a
  join public.queridometro_votes b
    on b.week_start = a.week_start
   and b.from_profile_id = a.to_profile_id
   and b.to_profile_id = a.from_profile_id
   and b.reaction_key = a.reaction_key
  join public.queridometro_reaction_types t on t.key = a.reaction_key
  where a.week_start = p_week_start
    and a.from_profile_id = auth.uid()
    and t.connection_label is not null
    and (
      p_week_start < date_trunc('week', timezone('America/Fortaleza', now()))::date
      or (
        p_week_start = date_trunc('week', timezone('America/Fortaleza', now()))::date
        and extract(dow from timezone('America/Fortaleza', now())) = 0
      )
    );
$$;

create or replace function public.get_queridometro_weeks()
returns table (week_start date, total_votes bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select v.week_start, count(*)::bigint as total_votes
  from public.queridometro_votes v
  where auth.uid() is not null
    and (
      v.week_start < date_trunc('week', timezone('America/Fortaleza', now()))::date
      or (
        v.week_start = date_trunc('week', timezone('America/Fortaleza', now()))::date
        and extract(dow from timezone('America/Fortaleza', now())) = 0
      )
    )
  group by v.week_start
  order by v.week_start desc
  limit 12;
$$;

revoke all on function public.get_queridometro_results(date) from public;
revoke all on function public.get_my_queridometro_connections(date) from public;
revoke all on function public.get_queridometro_weeks() from public;
grant execute on function public.get_queridometro_results(date) to authenticated;
grant execute on function public.get_my_queridometro_connections(date) to authenticated;
grant execute on function public.get_queridometro_weeks() to authenticated;

grant select on public.queridometro_reaction_types to authenticated;
grant update on public.queridometro_reaction_types to authenticated;
grant select, insert, update, delete on public.queridometro_votes to authenticated;

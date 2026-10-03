alter table public.teams
  add column if not exists name text;

update public.teams
set name = case team_number
  when 1 then 'Cobertor'
  when 2 then 'Mágica'
  when 3 then 'Ficha Limpa'
  when 4 then 'Refém'
  else 'Time ' || team_number::text
end
where name is null or btrim(name) = '';

alter table public.teams
  alter column name set not null;

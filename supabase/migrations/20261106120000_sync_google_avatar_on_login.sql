-- A foto do Google era copiada só no cadastro, então quem trocava a foto na
-- conta Google continuava com a antiga no site. Esta função atualiza a foto do
-- próprio usuário e é chamada a cada login.
--
-- A foto vem de auth.identities, que o Supabase grava a partir do Google. Não
-- usa raw_user_meta_data porque o próprio usuário pode alterar esse campo.
--
-- Só troca foto vazia ou hospedada no Google: uma foto colocada por organizador
-- em outro endereço nunca é sobrescrita.
--
-- É security definer porque a policy de profiles só deixa perfil aprovado se
-- editar, e visitantes e convidados também têm foto.
create or replace function public.sync_my_google_avatar()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  google_photo text;
begin
  if auth.uid() is null then
    return;
  end if;

  select coalesce(identity.identity_data ->> 'avatar_url', identity.identity_data ->> 'picture')
    into google_photo
    from auth.identities as identity
   where identity.user_id = auth.uid()
     and identity.provider = 'google'
   order by identity.updated_at desc nulls last
   limit 1;

  if google_photo is null or google_photo !~ '^https://[a-z0-9-]+\.googleusercontent\.com/' then
    return;
  end if;

  update public.profiles
     set avatar_url = google_photo
   where id = auth.uid()
     and avatar_url is distinct from google_photo
     and (avatar_url is null or avatar_url ~ '^https://[a-z0-9-]+\.googleusercontent\.com/');
end;
$$;

revoke all on function public.sync_my_google_avatar() from public, anon;
grant execute on function public.sync_my_google_avatar() to authenticated;

-- Correção única: perfis cujo login já trouxe uma foto diferente da guardada.
update public.profiles as profile
   set avatar_url = latest.photo
  from (
    select distinct on (identity.user_id)
           identity.user_id,
           coalesce(identity.identity_data ->> 'avatar_url', identity.identity_data ->> 'picture') as photo
      from auth.identities as identity
     where identity.provider = 'google'
     order by identity.user_id, identity.updated_at desc nulls last
  ) as latest
 where latest.user_id = profile.id
   and latest.photo ~ '^https://[a-z0-9-]+\.googleusercontent\.com/'
   and profile.avatar_url is distinct from latest.photo
   and (profile.avatar_url is null or profile.avatar_url ~ '^https://[a-z0-9-]+\.googleusercontent\.com/');

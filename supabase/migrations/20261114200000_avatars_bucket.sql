-- Fotos de perfil escolhidas pela própria pessoa. Bucket público (as fotos
-- aparecem em listas, rankings e imagens geradas), limitado a 1 MB por arquivo
-- e só imagens. Cada pessoa tem um único arquivo, "<id do usuário>.webp",
-- sobrescrito a cada troca: o espaço usado não cresce com o tempo.
-- Aditiva: nada existente muda.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_bucket_read" on storage.objects;
create policy "avatars_bucket_read" on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_bucket_insert_own" on storage.objects;
create policy "avatars_bucket_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and name = (select auth.uid())::text || '.webp');

drop policy if exists "avatars_bucket_update_own" on storage.objects;
create policy "avatars_bucket_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and name = (select auth.uid())::text || '.webp')
  with check (bucket_id = 'avatars' and name = (select auth.uid())::text || '.webp');

drop policy if exists "avatars_bucket_delete_own" on storage.objects;
create policy "avatars_bucket_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and name = (select auth.uid())::text || '.webp');

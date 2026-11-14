-- A foto de perfil passa a ser guardada como JPEG ("<id>.jpg"): o Safari não
-- gera WebP no navegador e as imagens geradas pelo site leem JPEG com segurança.
-- Continua um único arquivo por pessoa, sobrescrito a cada troca. A policy de
-- apagar o ".webp" antigo é mantida para o servidor limpar o arquivo legado.
drop policy if exists "avatars_bucket_insert_own" on storage.objects;
create policy "avatars_bucket_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and name = (select auth.uid())::text || '.jpg');

drop policy if exists "avatars_bucket_update_own" on storage.objects;
create policy "avatars_bucket_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and name = (select auth.uid())::text || '.jpg')
  with check (bucket_id = 'avatars' and name = (select auth.uid())::text || '.jpg');

drop policy if exists "avatars_bucket_delete_own" on storage.objects;
create policy "avatars_bucket_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and name in ((select auth.uid())::text || '.jpg', (select auth.uid())::text || '.webp'));

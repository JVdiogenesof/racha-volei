-- Moldura da foto de perfil escolhida pela própria pessoa (id do catálogo em
-- src/lib/avatarFrames.ts; nulo = sem moldura). Aditiva: nada existente muda.
-- A validação do id é feita no servidor; aqui só limita o tamanho.
alter table public.profiles
  add column if not exists avatar_frame text;

alter table public.profiles
  drop constraint if exists profiles_avatar_frame_length;
alter table public.profiles
  add constraint profiles_avatar_frame_length check (avatar_frame is null or char_length(avatar_frame) <= 40);

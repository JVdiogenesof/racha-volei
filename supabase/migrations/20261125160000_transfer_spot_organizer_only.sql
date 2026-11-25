-- Regulamento de dezembro/2026: troca de vaga só com aprovação do organizador.
-- A função organizer_transfer_event_pix_spot continua valendo.
revoke execute on function public.transfer_event_pix_spot(uuid, uuid) from public, anon, authenticated;

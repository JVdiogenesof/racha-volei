-- Pré-lançamento privado: somente JV e Vidal. Remover esta policy no lançamento.
-- Restritiva: preserva todas as regras existentes de propriedade e pagamento.
create policy "shirt_orders_preview_access" on public.shirt_orders
  as restrictive for all to authenticated
  using (
    (select auth.uid()) in (
      'ea6c4b3a-a774-4ccd-a705-c14220193812'::uuid,
      '8048d01b-6fca-4b92-afb4-22677d392d47'::uuid
    ) and public.is_organizer()
  )
  with check (
    (select auth.uid()) in (
      'ea6c4b3a-a774-4ccd-a705-c14220193812'::uuid,
      '8048d01b-6fca-4b92-afb4-22677d392d47'::uuid
    ) and public.is_organizer()
  );

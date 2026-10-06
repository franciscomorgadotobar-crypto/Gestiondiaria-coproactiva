-- Función auxiliar usada por políticas RLS de Storage.
-- Debe poder evaluarse para sesiones autenticadas; no expone ni modifica datos.
grant execute on function public.portal_texto_uuid(text) to authenticated;

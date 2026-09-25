-- Reglas del diagnóstico comercial, en la base y no solo en la pantalla.
--
-- 1. Es la visita a un prospecto antes de ganarlo: no se crea sobre una
--    comunidad ya administrada. Antes la plantilla se podía elegir para una
--    comunidad y la pantalla quedaba cargando para siempre (busca el
--    prospecto, que no existe).
-- 2. Lo hace un superadministrador. Terreno no tiene acceso a los datos
--    comerciales del prospecto ni al resultado: asignarle uno lo dejaba con
--    la pantalla cargando para siempre.
--
-- Sin responsable se permite: queda "Sin asignar" hasta que un
-- superadministrador lo tome.

create or replace function public.validar_diagnostico()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not new.es_diagnostico then
    return new;
  end if;

  if new.prospecto_id is null or new.comunidad_id is not null then
    raise exception 'El diagnóstico comercial se hace sobre un prospecto del Pipeline, no sobre una comunidad.'
      using errcode = '23514';
  end if;

  if new.responsable_id is not null and not exists (
    select 1 from perfiles where id = new.responsable_id and rol = 'superadmin'
  ) then
    raise exception 'El diagnóstico comercial solo lo puede hacer un superadministrador.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists controles_validar_diagnostico on public.controles;
create trigger controles_validar_diagnostico
  before insert or update of es_diagnostico, prospecto_id, comunidad_id, responsable_id
  on public.controles
  for each row execute function public.validar_diagnostico();

revoke all on function public.validar_diagnostico() from public, anon, authenticated;

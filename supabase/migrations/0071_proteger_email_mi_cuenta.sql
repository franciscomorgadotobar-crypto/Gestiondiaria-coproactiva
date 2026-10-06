create or replace function public.proteger_email_perfil_propio()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.email is distinct from old.email
     and auth.uid()=old.id
     and not public.es_superadmin() then
    raise exception 'El correo de acceso solo puede modificarlo un superadministrador.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_email_perfil_propio on public.perfiles;
create trigger trg_proteger_email_perfil_propio
before update on public.perfiles
for each row
execute function public.proteger_email_perfil_propio();


create or replace function public.contabilidad_validar_codigo_otro()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_nombre text:=lower(unaccent(coalesce(new.cuenta,'')));
begin
  if new.clase='movimiento' then
    if right(new.codigo,4)='.099' and v_nombre not like '%otro%' then
      raise exception 'El código .099 está reservado para cuentas “Otros”.';
    end if;
    if v_nombre like 'otro %' or v_nombre like 'otros %' then
      if right(new.codigo,4)<>'.099' then
        raise exception 'Las cuentas “Otros” deben usar el terminal .099.';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_contabilidad_validar_codigo_otro on public.contabilidad_cuentas;
create trigger trg_contabilidad_validar_codigo_otro
before insert or update of codigo,cuenta,clase on public.contabilidad_cuentas
for each row execute function public.contabilidad_validar_codigo_otro();

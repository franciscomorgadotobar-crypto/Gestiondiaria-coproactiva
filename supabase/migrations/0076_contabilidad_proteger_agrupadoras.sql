
create or replace function public.contabilidad_proteger_cuenta()
returns trigger
language plpgsql security definer set search_path=public
as $$
declare
  v_mov boolean;
  v_parent public.contabilidad_cuentas%rowtype;
  v_mov_actual boolean;
  v_saldo numeric:=0;
  v_cuenta_tiene_historia boolean:=false;
begin
  if tg_op='DELETE' then
    v_mov:=public.contabilidad_entidad_tiene_movimientos(old.entidad_id);
    if v_mov then
      raise exception 'No se pueden eliminar cuentas porque la entidad ya tiene movimientos.';
    end if;
    return old;
  end if;

  if tg_op='INSERT' then
    v_mov:=public.contabilidad_entidad_tiene_movimientos(new.entidad_id);
    if new.parent_id is not null then
      select * into v_parent
      from public.contabilidad_cuentas
      where id=new.parent_id and entidad_id=new.entidad_id;

      if not found then raise exception 'La cuenta agrupadora no pertenece a la entidad.'; end if;
      if v_parent.nivel>=5 then raise exception 'No se puede crear un nivel inferior al quinto nivel.'; end if;

      new.nivel:=v_parent.nivel+1;
      if new.codigo not like v_parent.codigo||'.%' then
        raise exception 'El código debe depender de la cuenta agrupadora %.',v_parent.codigo;
      end if;

      select exists(
        select 1
        from public.contabilidad_asiento_lineas l
        join public.contabilidad_asientos a on a.id=l.asiento_id
        where l.cuenta_id=v_parent.id
      ) into v_cuenta_tiene_historia;

      if v_cuenta_tiene_historia then
        raise exception 'No se puede convertir en agrupadora una cuenta que ya tiene movimientos.';
      end if;
    elsif v_mov then
      raise exception 'Con historial contable, las nuevas cuentas deben agregarse en un nivel inferior de una cuenta existente.';
    end if;

    new.imputable:=coalesce(new.imputable,true);
    new.clase:=case when new.imputable then 'movimiento' else 'titulo' end;
    return new;
  end if;

  if new.parent_id is not null then
    select * into v_parent
    from public.contabilidad_cuentas
    where id=new.parent_id and entidad_id=new.entidad_id;
    if not found then raise exception 'La cuenta agrupadora no pertenece a la entidad.'; end if;
    if v_parent.nivel>=5 then raise exception 'No se puede superar el quinto nivel.'; end if;
    new.nivel:=v_parent.nivel+1;
    if new.codigo not like v_parent.codigo||'.%' then
      raise exception 'El código debe depender de la cuenta agrupadora %.',v_parent.codigo;
    end if;
  end if;

  v_mov:=public.contabilidad_entidad_tiene_movimientos(old.entidad_id);

  if v_mov then
    select exists(
      select 1
      from public.contabilidad_asiento_lineas l
      where l.cuenta_id=old.id
    ) into v_cuenta_tiene_historia;

    if new.codigo is distinct from old.codigo
       or new.parent_id is distinct from old.parent_id
       or new.tipo_contable is distinct from old.tipo_contable
       or new.grupo is distinct from old.grupo
       or new.naturaleza is distinct from old.naturaleza
       or new.clasificacion_balance is distinct from old.clasificacion_balance
       or new.eerr_seccion is distinct from old.eerr_seccion
       or new.eerr_orden is distinct from old.eerr_orden
       or new.nivel is distinct from old.nivel
    then
      raise exception 'Con movimientos registrados solo puedes editar el nombre, el orden, la exigencia de centro de costo o el estado de la cuenta.';
    end if;

    if (new.clase is distinct from old.clase or new.imputable is distinct from old.imputable)
       and not (
         not v_cuenta_tiene_historia
         and new.clase='titulo'
         and new.imputable=false
         and exists(select 1 from public.contabilidad_cuentas h where h.parent_id=old.id)
       )
    then
      raise exception 'No se puede cambiar la condición imputable de una cuenta con historial protegido.';
    end if;
  end if;

  if old.activa and not new.activa then
    if exists(
      select 1 from public.contabilidad_cuentas h
      where h.parent_id=old.id and h.activa
    ) then
      raise exception 'No se puede desactivar una cuenta agrupadora mientras tenga subcuentas activas.';
    end if;

    select exists(
      select 1
      from public.contabilidad_asiento_lineas l
      join public.contabilidad_asientos a on a.id=l.asiento_id
      where l.cuenta_id=old.id
        and a.estado='contabilizado'
        and extract(year from a.fecha)=extract(year from current_date)
    ) into v_mov_actual;

    select coalesce(sum(l.debe-l.haber),0)
    into v_saldo
    from public.contabilidad_asiento_lineas l
    join public.contabilidad_asientos a on a.id=l.asiento_id
    where l.cuenta_id=old.id
      and a.estado='contabilizado'
      and a.fecha<=current_date;

    if v_mov_actual or round(coalesce(v_saldo,0),2)<>0 then
      raise exception 'No se puede desactivar una cuenta con movimientos en el ejercicio actual o saldo pendiente.';
    end if;
  end if;

  return new;
end;
$$;

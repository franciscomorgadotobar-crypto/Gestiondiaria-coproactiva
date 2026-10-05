-- Correcciones de consistencia para reportes contables.
-- 1) Las cuentas inactivas conservan su efecto histórico en reportes.
-- 2) EERR usa movimientos netos, no suma Debe + Haber.
-- 3) El balance usa clasificacion_balance para respetar cuentas correctoras
--    como Depreciación Acumulada.

create or replace function public.contabilidad_balance(
  p_entidad_id uuid,p_desde date default null,p_hasta date default null
)
returns table(
  cuenta_id uuid,codigo text,cuenta text,debe numeric,haber numeric,
  deudor numeric,acreedor numeric,activo numeric,pasivo numeric,perdida numeric,ganancia numeric
)
language plpgsql stable security definer set search_path=public
as $$
begin
  if not public.es_admin() then raise exception 'Sin permiso.'; end if;
  return query
  with movimientos as (
    select
      c.id,c.codigo,c.cuenta,c.clasificacion_balance,c.activa,
      coalesce(sum(l.debe) filter(where a.estado='contabilizado'),0)::numeric as debe,
      coalesce(sum(l.haber) filter(where a.estado='contabilizado'),0)::numeric as haber
    from public.contabilidad_cuentas c
    left join public.contabilidad_asiento_lineas l on l.cuenta_id=c.id
    left join public.contabilidad_asientos a on a.id=l.asiento_id
      and a.entidad_id=p_entidad_id
      and (p_desde is null or a.fecha>=p_desde)
      and (p_hasta is null or a.fecha<=p_hasta)
    where c.entidad_id=p_entidad_id and c.clase='movimiento'
    group by c.id,c.codigo,c.cuenta,c.clasificacion_balance,c.activa
  )
  select
    m.id,m.codigo,m.cuenta,m.debe,m.haber,
    case when m.debe>m.haber then m.debe-m.haber else 0 end::numeric,
    case when m.haber>m.debe then m.haber-m.debe else 0 end::numeric,
    case when m.clasificacion_balance='activo' then m.debe-m.haber else 0 end::numeric,
    case when m.clasificacion_balance='pasivo' then m.haber-m.debe else 0 end::numeric,
    case when m.clasificacion_balance='perdida' then m.debe-m.haber else 0 end::numeric,
    case when m.clasificacion_balance='ganancia' then m.haber-m.debe else 0 end::numeric
  from movimientos m
  where m.activa or m.debe<>0 or m.haber<>0
  order by m.codigo;
end;
$$;

revoke all on function public.contabilidad_balance(uuid,date,date) from public,anon;
grant execute on function public.contabilidad_balance(uuid,date,date) to authenticated;

create or replace function public.contabilidad_eerr_detalle(
  p_entidad_id uuid,p_desde date default null,p_hasta date default null
)
returns table(cuenta_id uuid,codigo text,cuenta text,seccion text,orden integer,monto numeric)
language plpgsql stable security definer set search_path=public
as $$
begin
  if not public.es_admin() then raise exception 'Sin permiso.'; end if;
  return query
  with movimientos as (
    select
      c.id,c.codigo,c.cuenta,c.eerr_seccion,c.eerr_orden,c.activa,
      coalesce(sum(l.debe) filter(where a.estado='contabilizado'),0)::numeric as debe,
      coalesce(sum(l.haber) filter(where a.estado='contabilizado'),0)::numeric as haber
    from public.contabilidad_cuentas c
    left join public.contabilidad_asiento_lineas l on l.cuenta_id=c.id
    left join public.contabilidad_asientos a on a.id=l.asiento_id
      and a.entidad_id=p_entidad_id
      and (p_desde is null or a.fecha>=p_desde)
      and (p_hasta is null or a.fecha<=p_hasta)
    where c.entidad_id=p_entidad_id
      and c.clase='movimiento'
      and c.eerr_seccion is not null
    group by c.id,c.codigo,c.cuenta,c.eerr_seccion,c.eerr_orden,c.activa
  )
  select
    m.id,m.codigo,m.cuenta,m.eerr_seccion,m.eerr_orden,
    case
      when m.eerr_seccion in ('ingresos_operacionales','resultado_no_operacional')
        then m.haber-m.debe
      else m.debe-m.haber
    end::numeric as monto
  from movimientos m
  where m.activa or m.debe<>0 or m.haber<>0
  order by m.eerr_seccion,m.eerr_orden,m.codigo;
end;
$$;

revoke all on function public.contabilidad_eerr_detalle(uuid,date,date) from public,anon;
grant execute on function public.contabilidad_eerr_detalle(uuid,date,date) to authenticated;

create or replace function public.contabilidad_eerr_sin_clasificar(
  p_entidad_id uuid,p_desde date default null,p_hasta date default null
)
returns table(cuenta_id uuid,codigo text,cuenta text,monto numeric)
language plpgsql stable security definer set search_path=public
as $$
begin
  if not public.es_admin() then raise exception 'Sin permiso.'; end if;
  return query
  select
    c.id,c.codigo,c.cuenta,
    case
      when c.tipo_contable='ingreso' then sum(l.haber-l.debe)
      else sum(l.debe-l.haber)
    end::numeric as monto
  from public.contabilidad_asientos a
  join public.contabilidad_asiento_lineas l on l.asiento_id=a.id
  join public.contabilidad_cuentas c on c.id=l.cuenta_id
  where a.entidad_id=p_entidad_id and a.estado='contabilizado'
    and c.tipo_contable in ('ingreso','costo','gasto','impuesto')
    and c.eerr_seccion is null
    and (p_desde is null or a.fecha>=p_desde)
    and (p_hasta is null or a.fecha<=p_hasta)
  group by c.id,c.codigo,c.cuenta,c.tipo_contable
  having case
    when c.tipo_contable='ingreso' then sum(l.haber-l.debe)
    else sum(l.debe-l.haber)
  end <> 0
  order by c.codigo;
end;
$$;

revoke all on function public.contabilidad_eerr_sin_clasificar(uuid,date,date) from public,anon;
grant execute on function public.contabilidad_eerr_sin_clasificar(uuid,date,date) to authenticated;

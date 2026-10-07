-- Corrige la asignación/edición sin depender de la extensión unaccent.
-- La validación solo busca la palabra «otro», que no lleva acentos.
create or replace function public.contabilidad_validar_codigo_otro()
returns trigger
language plpgsql security invoker set search_path=public
as $$
declare
  v_nombre text:=lower(btrim(coalesce(new.cuenta,'')));
begin
  if new.clase='movimiento' then
    if right(new.codigo,4)='.099' and v_nombre not like '%otro%' then
      raise exception 'El código .099 está reservado para cuentas “Otros”.';
    end if;
    if (v_nombre like 'otro %' or v_nombre like 'otros %') and right(new.codigo,4)<>'.099' then
      raise exception 'Las cuentas “Otros” deben usar el terminal .099.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.contabilidad_validar_codigo_otro() from public,anon;

-- Conserva los UUID de las cuentas de movimiento de la plantilla y la empresa.
create temp table _plan_correccion_codigos(old_code text primary key,new_code text unique) on commit drop;
insert into _plan_correccion_codigos values
('3.1.02.001','3.1.01.002'),
('3.1.03.001','3.1.01.003'),
('3.1.04.001','3.1.01.004'),
('3.1.05.001','3.1.01.005'),
('3.1.06.001','3.1.01.006'),
('4.1.02.001','4.1.01.003');

lock table public.contabilidad_entidades,public.contabilidad_cuentas,
  public.contabilidad_asientos,public.contabilidad_asiento_lineas in share row exclusive mode;

create temp table _plan_correccion_entidades on commit drop as
select id from public.contabilidad_entidades
where nombre='Coproactiva Administración SpA' and tipo='empresa'
  and plan_plantilla_id=(select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION');

create temp table _plan_correccion_historial on commit drop as
select
  (select md5(coalesce(string_agg(to_jsonb(a)::text,'|' order by a.id),''))
   from public.contabilidad_asientos a) as asientos_hash,
  (select md5(coalesce(string_agg(to_jsonb(l)::text,'|' order by l.id),''))
   from public.contabilidad_asiento_lineas l) as lineas_hash;

create temp table _plan_correccion_ids on commit drop as
select c.id,c.entidad_id,coalesce(m.new_code,c.codigo) as codigo
from public.contabilidad_cuentas c
join _plan_correccion_entidades e on e.id=c.entidad_id
left join _plan_correccion_codigos m on m.old_code=c.codigo
where c.imputable;

update public.contabilidad_plan_plantilla_cuentas c
set codigo=m.new_code,parent_codigo=regexp_replace(m.new_code,'\.[^.]+$',''),
    eerr_orden=right(m.new_code,3)::integer
from _plan_correccion_codigos m,public.contabilidad_plan_plantillas p
where p.codigo='EMPRESA_ADMINISTRACION' and c.plantilla_id=p.id and c.codigo=m.old_code;

update public.contabilidad_plan_plantilla_cuentas c
set cuenta=case c.codigo when '3.1.01' then 'Patrimonio Neto' else 'Ingresos por asesorías' end
from public.contabilidad_plan_plantillas p
where p.codigo='EMPRESA_ADMINISTRACION' and c.plantilla_id=p.id
  and c.codigo in ('3.1.01','4.1.01.002');

delete from public.contabilidad_plan_plantilla_cuentas c
using public.contabilidad_plan_plantillas p
where p.codigo='EMPRESA_ADMINISTRACION' and c.plantilla_id=p.id
  and c.codigo in ('3.1.02','3.1.03','3.1.04','3.1.05','3.1.06','4.1.02')
  and c.clase='titulo'
  and not exists(select 1 from public.contabilidad_plan_plantilla_cuentas h where h.plantilla_id=p.id and h.parent_codigo=c.codigo);

-- Excepción controlada de mantenimiento: la protección vuelve a activarse
-- dentro de la misma transacción. Ningún asiento ni línea se actualiza.
alter table public.contabilidad_cuentas disable trigger trg_contabilidad_proteger_cuenta;
alter table public.contabilidad_cuentas disable trigger trg_contabilidad_actualizar_padre;
alter table public.contabilidad_cuentas disable trigger trg_contabilidad_validar_parent;

update public.contabilidad_cuentas c
set codigo=m.new_code,parent_id=padre.id,eerr_orden=right(m.new_code,3)::integer,editado_en=now()
from _plan_correccion_codigos m,_plan_correccion_entidades e,public.contabilidad_cuentas padre
where c.entidad_id=e.id and c.codigo=m.old_code
  and padre.entidad_id=e.id and padre.codigo=regexp_replace(m.new_code,'\.[^.]+$','');

update public.contabilidad_cuentas c
set cuenta=case c.codigo when '3.1.01' then 'Patrimonio Neto' else 'Ingresos por asesorías' end,editado_en=now()
from _plan_correccion_entidades e
where c.entidad_id=e.id and c.codigo in ('3.1.01','4.1.01.002');

delete from public.contabilidad_cuentas c
using _plan_correccion_entidades e
where c.entidad_id=e.id and c.codigo in ('3.1.02','3.1.03','3.1.04','3.1.05','3.1.06','4.1.02')
  and c.clase='titulo'
  and not exists(select 1 from public.contabilidad_cuentas h where h.parent_id=c.id)
  and not exists(select 1 from public.contabilidad_asiento_lineas l where l.cuenta_id=c.id);

alter table public.contabilidad_cuentas enable trigger trg_contabilidad_validar_parent;
alter table public.contabilidad_cuentas enable trigger trg_contabilidad_actualizar_padre;
alter table public.contabilidad_cuentas enable trigger trg_contabilidad_proteger_cuenta;

do $$
begin
  if exists(
    select 1 from _plan_correccion_ids i
    left join public.contabilidad_cuentas c on c.id=i.id and c.entidad_id=i.entidad_id and c.codigo=i.codigo
    where c.id is null
  ) then raise exception 'La corrección debe conservar todos los UUID de cuentas de movimiento.'; end if;

  if (select asientos_hash from _plan_correccion_historial) is distinct from
     (select md5(coalesce(string_agg(to_jsonb(a)::text,'|' order by a.id),'')) from public.contabilidad_asientos a)
     or (select lineas_hash from _plan_correccion_historial) is distinct from
     (select md5(coalesce(string_agg(to_jsonb(l)::text,'|' order by l.id),'')) from public.contabilidad_asiento_lineas l)
  then raise exception 'La corrección debe conservar íntegro el historial contable.'; end if;

  if (select count(*) from public.contabilidad_plan_plantilla_cuentas c
      join public.contabilidad_plan_plantillas p on p.id=c.plantilla_id where p.codigo='EMPRESA_ADMINISTRACION')<>89
  then raise exception 'El plan de referencia debe tener 62 cuentas de movimiento y 27 agrupadoras.'; end if;

  if exists(
    select 1 from public.contabilidad_cuentas c join _plan_correccion_entidades e on e.id=c.entidad_id
    left join public.contabilidad_cuentas padre on padre.id=c.parent_id
    where c.parent_id is not null and (padre.entidad_id<>c.entidad_id or padre.clase<>'titulo'
      or c.codigo not like padre.codigo||'.%')
  ) then raise exception 'La jerarquía corregida no es válida.'; end if;
end;
$$;

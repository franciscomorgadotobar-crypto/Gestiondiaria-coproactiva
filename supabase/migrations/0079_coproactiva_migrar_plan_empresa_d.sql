-- Migración controlada de Coproactiva Administración SpA al Modelo D.
-- Conserva IDs de cuentas históricas para no alterar ningún asiento ni línea contable.

create temp table _copro_plan_d_map(
  old_code text primary key,
  new_code text not null unique
) on commit drop;

insert into _copro_plan_d_map(old_code,new_code) values
('1.1.01','1.1.01.001'),('1.1.02','1.1.01.002'),('1.1.03','1.1.01.003'),
('1.1.04','1.1.01.004'),('1.1.05','1.1.01.005'),('1.1.06','1.1.01.006'),
('1.1.07','1.1.01.007'),('1.1.08','1.1.01.008'),
('1.2.01','1.2.01.001'),('1.2.02','1.2.01.002'),('1.2.03','1.2.01.003'),
('1.2.04','1.2.01.004'),('1.2.05','1.2.01.005'),('1.2.06','1.2.01.006'),
('1.2.07','1.2.01.007'),
('2.1.01','2.1.01.001'),('2.1.02','2.1.01.002'),('2.1.03','2.1.01.003'),
('2.1.04','2.1.01.099'),('2.1.05','2.1.01.004'),('2.1.06','2.1.01.005'),
('2.1.07','2.1.01.006'),('2.1.08','2.1.01.007'),('2.1.09','2.1.01.008'),
('2.1.11','2.1.01.009'),('2.1.12','2.1.01.010'),('2.1.13','2.1.01.011'),
('2.1.14','2.1.01.012'),
('2.2.01','2.2.01.001'),('2.2.02','2.2.01.002'),
('3.1.01','3.1.01.001'),('3.1.02','3.1.02.001'),('3.1.03','3.1.03.001'),
('3.1.04','3.1.04.001'),('3.1.05','3.1.05.001'),('3.1.07','3.1.06.001'),
('4.1.01','4.1.01.001'),('4.1.02','4.1.01.002'),('4.2.01','4.1.02.001'),
('4.3.01','4.2.01.001'),('4.3.02','4.2.01.002'),
('5.1.02','5.2.01.002'),('5.1.03','5.2.01.003'),('5.1.04','5.2.01.004'),
('5.1.05','5.1.01.002'),('5.1.07','5.2.01.005'),('5.1.08','5.2.01.006'),
('5.2.01','5.2.01.001'),('5.2.02','5.3.01.001'),('5.2.03','5.2.01.007'),
('5.2.04','5.2.01.008'),('5.2.05','5.2.01.009'),('5.2.06','5.2.01.010'),
('5.3.01','5.4.01.001'),('5.3.02','5.2.01.011');

create temp table _copro_plan_d_control on commit drop as
with ent as (
  select id from public.contabilidad_entidades
  where nombre='Coproactiva Administración SpA' and activa
  limit 1
)
select
  (select id from ent) entidad_id,
  (select count(*) from public.contabilidad_cuentas where entidad_id=(select id from ent)) cuentas,
  (select count(*) from public.contabilidad_asientos where entidad_id=(select id from ent) and estado='contabilizado') asientos,
  (select count(*) from public.contabilidad_asiento_lineas l
     join public.contabilidad_asientos a on a.id=l.asiento_id
     where a.entidad_id=(select id from ent) and a.estado='contabilizado') lineas,
  (select coalesce(sum(l.debe),0) from public.contabilidad_asiento_lineas l
     join public.contabilidad_asientos a on a.id=l.asiento_id
     where a.entidad_id=(select id from ent) and a.estado='contabilizado') debe,
  (select coalesce(sum(l.haber),0) from public.contabilidad_asiento_lineas l
     join public.contabilidad_asientos a on a.id=l.asiento_id
     where a.entidad_id=(select id from ent) and a.estado='contabilizado') haber,
  (select md5(coalesce(string_agg(
      l.id::text||':'||l.cuenta_id::text||':'||l.debe::text||':'||l.haber::text,
      '|' order by l.id
    ),''))
   from public.contabilidad_asiento_lineas l
   join public.contabilidad_asientos a on a.id=l.asiento_id
   where a.entidad_id=(select id from ent) and a.estado='contabilizado') line_hash;

do $$
declare
  v_entidad uuid;
  v_plantilla uuid;
  v_actual integer;
  v_mapeadas integer;
begin
  select entidad_id into v_entidad from _copro_plan_d_control;
  if v_entidad is null then
    raise exception 'No se encontró Coproactiva Administración SpA.';
  end if;

  select id into v_plantilla
  from public.contabilidad_plan_plantillas
  where codigo='EMPRESA_ADMINISTRACION' and activa
  limit 1;

  if v_plantilla is null then
    raise exception 'No se encontró la plantilla Modelo D / Empresa de Administración.';
  end if;

  select count(*) into v_actual
  from public.contabilidad_cuentas
  where entidad_id=v_entidad;

  select count(*) into v_mapeadas
  from public.contabilidad_cuentas c
  join _copro_plan_d_map m on m.old_code=c.codigo
  where c.entidad_id=v_entidad;

  if v_actual<>55 or v_mapeadas<>55 then
    raise exception 'La migración se detuvo: se esperaban 55 cuentas actuales y 55 correspondencias; actual %, mapeadas %.',v_actual,v_mapeadas;
  end if;
end $$;

create temp table _copro_plan_d_ids on commit drop as
select c.id,m.old_code,m.new_code
from public.contabilidad_cuentas c
join _copro_plan_d_map m on m.old_code=c.codigo
where c.entidad_id=(select entidad_id from _copro_plan_d_control);

alter table public.contabilidad_cuentas disable trigger trg_contabilidad_proteger_cuenta;
alter table public.contabilidad_cuentas disable trigger trg_contabilidad_actualizar_padre;
alter table public.contabilidad_cuentas disable trigger trg_contabilidad_validar_codigo_otro;
alter table public.contabilidad_cuentas disable trigger trg_contabilidad_validar_parent;

-- 1) Reutiliza las 55 cuentas históricas, conservando exactamente sus UUID.
update public.contabilidad_cuentas c
set
  codigo_auxiliar=coalesce(c.codigo_auxiliar,c.codigo),
  codigo=t.codigo,
  cuenta=t.cuenta,
  parent_id=null,
  clase=t.clase,
  tipo_contable=t.tipo_contable,
  grupo=t.grupo,
  naturaleza=t.naturaleza,
  clasificacion_balance=t.clasificacion_balance,
  orden=t.orden,
  activa=true,
  eerr_seccion=t.eerr_seccion,
  eerr_orden=t.eerr_orden,
  nivel=t.nivel,
  imputable=t.imputable,
  requiere_centro_costo=t.requiere_centro_costo,
  editado_en=now()
from _copro_plan_d_map m
join public.contabilidad_plan_plantillas p
  on p.codigo='EMPRESA_ADMINISTRACION'
join public.contabilidad_plan_plantilla_cuentas t
  on t.plantilla_id=p.id and t.codigo=m.new_code
where c.entidad_id=(select entidad_id from _copro_plan_d_control)
  and c.codigo=m.old_code;

-- 2) Agrega las agrupadoras y las 7 cuentas del Modelo D que no existían.
insert into public.contabilidad_cuentas(
  entidad_id,parent_id,codigo,codigo_auxiliar,cuenta,clase,tipo_contable,grupo,naturaleza,
  clasificacion_balance,orden,activa,eerr_seccion,eerr_orden,nivel,imputable,
  requiere_centro_costo,editado_en
)
select
  (select entidad_id from _copro_plan_d_control),
  null,
  t.codigo,
  null,
  t.cuenta,
  t.clase,
  t.tipo_contable,
  t.grupo,
  t.naturaleza,
  t.clasificacion_balance,
  t.orden,
  true,
  t.eerr_seccion,
  t.eerr_orden,
  t.nivel,
  t.imputable,
  t.requiere_centro_costo,
  now()
from public.contabilidad_plan_plantillas p
join public.contabilidad_plan_plantilla_cuentas t on t.plantilla_id=p.id
where p.codigo='EMPRESA_ADMINISTRACION'
  and not exists(
    select 1 from public.contabilidad_cuentas c
    where c.entidad_id=(select entidad_id from _copro_plan_d_control)
      and c.codigo=t.codigo
  )
order by t.nivel,t.orden,t.codigo;

-- 3) Reconstruye la jerarquía usando la plantilla D.
update public.contabilidad_cuentas c
set parent_id=padre.id,
    editado_en=now()
from public.contabilidad_plan_plantillas p
join public.contabilidad_plan_plantilla_cuentas t on t.plantilla_id=p.id
left join public.contabilidad_cuentas padre
  on padre.entidad_id=(select entidad_id from _copro_plan_d_control)
 and padre.codigo=t.parent_codigo
where p.codigo='EMPRESA_ADMINISTRACION'
  and c.entidad_id=(select entidad_id from _copro_plan_d_control)
  and c.codigo=t.codigo
  and c.parent_id is distinct from padre.id;

update public.contabilidad_entidades
set plan_origen='plantilla',
    plan_plantilla_id=(select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
    plan_configurado_en=now(),
    editado_en=now()
where id=(select entidad_id from _copro_plan_d_control);

alter table public.contabilidad_cuentas enable trigger trg_contabilidad_validar_parent;
alter table public.contabilidad_cuentas enable trigger trg_contabilidad_validar_codigo_otro;
alter table public.contabilidad_cuentas enable trigger trg_contabilidad_actualizar_padre;
alter table public.contabilidad_cuentas enable trigger trg_contabilidad_proteger_cuenta;

do $$
declare
  v_entidad uuid;
  v_pre record;
  v_cuentas integer;
  v_asientos integer;
  v_lineas integer;
  v_debe numeric;
  v_haber numeric;
  v_hash text;
  v_ids integer;
begin
  select * into v_pre from _copro_plan_d_control;
  v_entidad:=v_pre.entidad_id;

  select count(*) into v_cuentas
  from public.contabilidad_cuentas where entidad_id=v_entidad;

  select count(*) into v_asientos
  from public.contabilidad_asientos where entidad_id=v_entidad and estado='contabilizado';

  select count(*),coalesce(sum(l.debe),0),coalesce(sum(l.haber),0),
         md5(coalesce(string_agg(
           l.id::text||':'||l.cuenta_id::text||':'||l.debe::text||':'||l.haber::text,
           '|' order by l.id
         ),''))
  into v_lineas,v_debe,v_haber,v_hash
  from public.contabilidad_asiento_lineas l
  join public.contabilidad_asientos a on a.id=l.asiento_id
  where a.entidad_id=v_entidad and a.estado='contabilizado';

  select count(*) into v_ids
  from _copro_plan_d_ids i
  join public.contabilidad_cuentas c on c.id=i.id and c.entidad_id=v_entidad
  where c.codigo=i.new_code;

  if v_cuentas<>95 then
    raise exception 'Validación fallida: Modelo D debe quedar con 95 filas de plan y quedó con %.',v_cuentas;
  end if;

  if v_ids<>55 then
    raise exception 'Validación fallida: no se conservaron los 55 UUID históricos.';
  end if;

  if v_asientos<>v_pre.asientos or v_lineas<>v_pre.lineas
     or round(v_debe,2)<>round(v_pre.debe,2)
     or round(v_haber,2)<>round(v_pre.haber,2)
     or v_hash is distinct from v_pre.line_hash
  then
    raise exception 'Validación fallida: se detectó una modificación en los movimientos históricos.';
  end if;
end $$;

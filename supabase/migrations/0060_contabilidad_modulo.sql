-- Contabilidad CoproActiva.
-- Modelo derivado de CONTABILIDAD_COPROACTIVA.xlsx:
-- PlanCuentas, Formulario, Libro_Diario, Libro_Mayor, Balance_Trib y EERR.

create table if not exists public.contabilidad_entidades (
  id uuid primary key default gen_random_uuid(),
  comunidad_id uuid unique references public.comunidades(id) on delete set null,
  nombre text not null,
  rut text,
  tipo text not null default 'comunidad'
    check (tipo in ('comunidad','empresa','otro')),
  moneda text not null default 'CLP',
  activa boolean not null default true,
  creado_por uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now(),
  editado_en timestamptz not null default now()
);

create table if not exists public.contabilidad_cuentas (
  id uuid primary key default gen_random_uuid(),
  entidad_id uuid not null references public.contabilidad_entidades(id) on delete cascade,
  parent_id uuid references public.contabilidad_cuentas(id) on delete restrict,
  codigo text not null,
  codigo_auxiliar text,
  cuenta text not null,
  clase text not null default 'movimiento'
    check (clase in ('titulo','movimiento')),
  tipo_contable text not null
    check (tipo_contable in ('activo','pasivo','patrimonio','ingreso','costo','gasto','impuesto')),
  grupo text,
  naturaleza text
    check (naturaleza is null or naturaleza in ('deudora','acreedora')),
  clasificacion_balance text
    check (clasificacion_balance is null or clasificacion_balance in ('activo','pasivo','perdida','ganancia')),
  eerr_seccion text,
  eerr_orden integer,
  orden integer not null default 0,
  activa boolean not null default true,
  creado_en timestamptz not null default now(),
  editado_en timestamptz not null default now(),
  unique (entidad_id, codigo)
);

create table if not exists public.contabilidad_asientos (
  id uuid primary key default gen_random_uuid(),
  entidad_id uuid not null references public.contabilidad_entidades(id) on delete restrict,
  numero integer not null,
  fecha date not null default current_date,
  glosa text,
  estado text not null default 'contabilizado'
    check (estado in ('contabilizado','anulado')),
  origen text not null default 'manual',
  referencia text,
  proveedor_id uuid references public.proveedores(id) on delete set null,
  origen_id uuid,
  creado_por uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now(),
  anulado_por uuid references auth.users(id) on delete set null,
  anulado_en timestamptz,
  motivo_anulacion text,
  unique (entidad_id, numero)
);

create table if not exists public.contabilidad_asiento_lineas (
  id uuid primary key default gen_random_uuid(),
  asiento_id uuid not null references public.contabilidad_asientos(id) on delete cascade,
  cuenta_id uuid not null references public.contabilidad_cuentas(id) on delete restrict,
  orden integer not null default 0,
  debe numeric(18,2) not null default 0 check (debe >= 0),
  haber numeric(18,2) not null default 0 check (haber >= 0),
  glosa text,
  creado_en timestamptz not null default now(),
  check ((debe > 0 and haber = 0) or (haber > 0 and debe = 0))
);

create index if not exists contabilidad_cuentas_entidad_idx
  on public.contabilidad_cuentas(entidad_id, orden, codigo);
create index if not exists contabilidad_asientos_entidad_fecha_idx
  on public.contabilidad_asientos(entidad_id, fecha desc, numero desc);
create index if not exists contabilidad_lineas_asiento_idx
  on public.contabilidad_asiento_lineas(asiento_id, orden);
create index if not exists contabilidad_lineas_cuenta_idx
  on public.contabilidad_asiento_lineas(cuenta_id);

alter table public.contabilidad_entidades enable row level security;
alter table public.contabilidad_cuentas enable row level security;
alter table public.contabilidad_asientos enable row level security;
alter table public.contabilidad_asiento_lineas enable row level security;

drop policy if exists contabilidad_entidades_admin on public.contabilidad_entidades;
create policy contabilidad_entidades_admin
on public.contabilidad_entidades for all to authenticated
using (public.es_admin()) with check (public.es_admin());

drop policy if exists contabilidad_cuentas_admin on public.contabilidad_cuentas;
create policy contabilidad_cuentas_admin
on public.contabilidad_cuentas for all to authenticated
using (public.es_admin()) with check (public.es_admin());

drop policy if exists contabilidad_asientos_admin on public.contabilidad_asientos;
create policy contabilidad_asientos_admin
on public.contabilidad_asientos for all to authenticated
using (public.es_admin()) with check (public.es_admin());

drop policy if exists contabilidad_lineas_admin on public.contabilidad_asiento_lineas;
create policy contabilidad_lineas_admin
on public.contabilidad_asiento_lineas for all to authenticated
using (
  public.es_admin() and exists (
    select 1 from public.contabilidad_asientos a where a.id=asiento_id
  )
)
with check (
  public.es_admin() and exists (
    select 1 from public.contabilidad_asientos a where a.id=asiento_id
  )
);

grant select,insert,update,delete on public.contabilidad_entidades to authenticated;
grant select,insert,update,delete on public.contabilidad_cuentas to authenticated;
grant select,insert,update,delete on public.contabilidad_asientos to authenticated;
grant select,insert,update,delete on public.contabilidad_asiento_lineas to authenticated;
grant select,insert,update,delete on public.contabilidad_entidades to service_role;
grant select,insert,update,delete on public.contabilidad_cuentas to service_role;
grant select,insert,update,delete on public.contabilidad_asientos to service_role;
grant select,insert,update,delete on public.contabilidad_asiento_lineas to service_role;

create or replace function public.contabilidad_sembrar_plan(p_entidad uuid)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if exists (select 1 from public.contabilidad_cuentas where entidad_id=p_entidad) then return; end if;
  insert into public.contabilidad_cuentas(
    entidad_id,codigo,cuenta,clase,tipo_contable,grupo,
    naturaleza,clasificacion_balance,eerr_seccion,eerr_orden
  ) values
    (p_entidad,'1101','Caja','movimiento','activo','Activo Corriente','deudora','activo',null,null),
    (p_entidad,'1102','Banco','movimiento','activo','Activo Corriente','deudora','activo',null,null),
    (p_entidad,'1103','Clientes por cobrar','movimiento','activo','Activo Corriente','deudora','activo',null,null),
    (p_entidad,'1104','IVA crédito fiscal','movimiento','activo','Activo Corriente','deudora','activo',null,null),
    (p_entidad,'1105','PPM','movimiento','activo','Activo Corriente','deudora','activo',null,null),
    (p_entidad,'1106','Remanente IVA crédito Fiscal','movimiento','activo','Activo Corriente','deudora','activo',null,null),
    (p_entidad,'1107','Capital por enterar','movimiento','activo','Activo Corriente','deudora','activo',null,null),
    (p_entidad,'1108','Cta cte socio Francisco deudora','movimiento','activo','Activo Corriente','deudora','activo',null,null),
    (p_entidad,'1109','Cta cte socio Osmar deudora','movimiento','activo','Activo Corriente','deudora','activo',null,null),
    (p_entidad,'1201','Equipos de Oficina','movimiento','activo','Activo no Corriente','deudora','activo',null,null),
    (p_entidad,'1202','Depreciación Acumulada','movimiento','activo','Activo no Corriente','acreedora','activo',null,null),
    (p_entidad,'2101','Proveedores','movimiento','pasivo','Pasivo Corriente','acreedora','pasivo',null,null),
    (p_entidad,'2103','IVA débito fiscal','movimiento','pasivo','Pasivo Corriente','acreedora','pasivo',null,null),
    (p_entidad,'2104','Retenciones por pagar','movimiento','pasivo','Pasivo Corriente','acreedora','pasivo',null,null),
    (p_entidad,'2105','Impuesto único por pagar','movimiento','pasivo','Pasivo Corriente','acreedora','pasivo',null,null),
    (p_entidad,'2106','Dividendos por pagar','movimiento','pasivo','Pasivo Corriente','acreedora','pasivo',null,null),
    (p_entidad,'2107','IDPC por pagar','movimiento','pasivo','Pasivo Corriente','acreedora','pasivo',null,null),
    (p_entidad,'2108','Cta cte socio Francisco acreedora','movimiento','pasivo','Pasivo Corriente','acreedora','pasivo',null,null),
    (p_entidad,'2109','Cta cte socio Osmar acreedora','movimiento','pasivo','Pasivo Corriente','acreedora','pasivo',null,null),
    (p_entidad,'2110','Cotizaciones por pagar','movimiento','pasivo','Pasivo Corriente','acreedora','pasivo',null,null),
    (p_entidad,'3101','Capital suscrito','movimiento','patrimonio','Patrimonio','acreedora','pasivo',null,null),
    (p_entidad,'3102','Capital pagado','movimiento','patrimonio','Patrimonio','acreedora','pasivo',null,null),
    (p_entidad,'3103','Resultados acumulados','movimiento','patrimonio','Patrimonio','acreedora','pasivo',null,null),
    (p_entidad,'3104','Resultado ejercicio','movimiento','patrimonio','Patrimonio','acreedora','pasivo',null,null),
    (p_entidad,'3105','Retiros provisorios','movimiento','patrimonio','Patrimonio','acreedora','pasivo',null,null),
    (p_entidad,'3107','Dividendos años anteriores','movimiento','patrimonio','Patrimonio','acreedora','pasivo',null,null),
    (p_entidad,'4101','Ingresos administración','movimiento','ingreso','Resultados','acreedora','ganancia','ingresos_operacionales',10),
    (p_entidad,'4102','Ingresos asesorías','movimiento','ingreso','Resultados','acreedora','ganancia','ingresos_operacionales',20),
    (p_entidad,'4201','Ingresos traspasos','movimiento','ingreso','Resultados','acreedora','ganancia','ingresos_operacionales',30),
    (p_entidad,'4301','Ingresos extraordinarios','movimiento','ingreso','Resultados','acreedora','ganancia','resultado_no_operacional',10),
    (p_entidad,'4401','Intereses','movimiento','ingreso','Resultados','acreedora','ganancia','resultado_no_operacional',20),
    (p_entidad,'5101','Sueldos personal','movimiento','gasto','Resultados','deudora','perdida','costos_prestacion',10),
    (p_entidad,'5102','Software','movimiento','gasto','Resultados','deudora','perdida','costos_prestacion',20),
    (p_entidad,'5103','Servicios básicos','movimiento','gasto','Resultados','deudora','perdida','costos_prestacion',30),
    (p_entidad,'5104','Internet','movimiento','gasto','Resultados','deudora','perdida','costos_prestacion',40),
    (p_entidad,'5105','Intereses y comisiones','movimiento','gasto','Resultados','deudora','perdida',null,null),
    (p_entidad,'5106','Patente municipal','movimiento','gasto','Resultados','deudora','perdida','costos_prestacion',50),
    (p_entidad,'5107','Servicios Web/Hosting','movimiento','gasto','Resultados','deudora','perdida','costos_prestacion',60),
    (p_entidad,'5108','Capacitación','movimiento','gasto','Resultados','deudora','perdida','costos_prestacion',70),
    (p_entidad,'5201','Sueldo empresarial socios','movimiento','gasto','Resultados','deudora','perdida','gastos_administracion',10),
    (p_entidad,'5202','Cotizaciones socios','movimiento','gasto','Resultados','deudora','perdida','gastos_administracion',20),
    (p_entidad,'5301','Gasto IDPC','movimiento','gasto','Resultados','deudora','perdida','impuesto_renta',10),
    (p_entidad,'5302','Depreciación equipos','movimiento','gasto','Resultados','deudora','perdida','gastos_administracion',30);
end;
$$;

revoke all on function public.contabilidad_sembrar_plan(uuid) from public,anon,authenticated;
grant execute on function public.contabilidad_sembrar_plan(uuid) to service_role;

create or replace function public.contabilidad_plan_al_crear_entidad()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  perform public.contabilidad_sembrar_plan(new.id);
  return new;
end;
$$;

drop trigger if exists trg_contabilidad_plan_entidad on public.contabilidad_entidades;
create trigger trg_contabilidad_plan_entidad
after insert on public.contabilidad_entidades
for each row execute function public.contabilidad_plan_al_crear_entidad();

insert into public.contabilidad_entidades(comunidad_id,nombre,rut,tipo,creado_por)
select c.id,c.nombre,c.rut,'comunidad',null
from public.comunidades c
where not exists (
  select 1 from public.contabilidad_entidades e where e.comunidad_id=c.id
);

create or replace function public.contabilidad_registrar_asiento(
  p_entidad_id uuid,
  p_fecha date,
  p_glosa text,
  p_lineas jsonb,
  p_origen text default 'manual',
  p_referencia text default null,
  p_proveedor_id uuid default null,
  p_origen_id uuid default null,
  p_numero integer default null
)
returns public.contabilidad_asientos
language plpgsql security definer set search_path=public
as $$
declare
  v_asiento public.contabilidad_asientos%rowtype;
  v_numero integer;
  v_linea jsonb;
  v_cuenta uuid;
  v_debe numeric(18,2);
  v_haber numeric(18,2);
  v_total_debe numeric(18,2):=0;
  v_total_haber numeric(18,2):=0;
  v_orden integer:=0;
begin
  if not public.es_admin() then raise exception 'No tienes permiso para registrar asientos.'; end if;
  if p_fecha is null then raise exception 'La fecha es obligatoria.'; end if;
  if jsonb_typeof(coalesce(p_lineas,'[]'::jsonb))<>'array'
     or jsonb_array_length(coalesce(p_lineas,'[]'::jsonb))<2 then
    raise exception 'Un asiento necesita al menos dos líneas.';
  end if;

  perform 1 from public.contabilidad_entidades
  where id=p_entidad_id and activa for update;
  if not found then raise exception 'La entidad contable no existe o está inactiva.'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_entidad_id::text,0));

  for v_linea in select value from jsonb_array_elements(p_lineas) loop
    v_cuenta:=nullif(v_linea->>'cuenta_id','')::uuid;
    v_debe:=coalesce(nullif(v_linea->>'debe','')::numeric,0);
    v_haber:=coalesce(nullif(v_linea->>'haber','')::numeric,0);
    if v_cuenta is null then raise exception 'Cada línea debe tener una cuenta.'; end if;
    if v_debe<0 or v_haber<0 or (v_debe>0 and v_haber>0) or (v_debe=0 and v_haber=0) then
      raise exception 'Cada línea debe tener un importe solo en Debe o solo en Haber.';
    end if;
    perform 1 from public.contabilidad_cuentas
    where id=v_cuenta and entidad_id=p_entidad_id and activa and clase='movimiento';
    if not found then raise exception 'La cuenta seleccionada no es una cuenta de movimiento válida.'; end if;
    v_total_debe:=v_total_debe+v_debe;
    v_total_haber:=v_total_haber+v_haber;
  end loop;

  if v_total_debe<=0 or round(v_total_debe,2)<>round(v_total_haber,2) then
    raise exception 'El asiento no cuadra. Debe y Haber deben ser iguales y mayores que cero.';
  end if;

  if p_numero is not null then
    if p_numero<=0 then raise exception 'El número de asiento debe ser mayor que cero.'; end if;
    if exists(select 1 from public.contabilidad_asientos where entidad_id=p_entidad_id and numero=p_numero) then
      raise exception 'Ya existe un asiento con el número % para esta entidad.',p_numero;
    end if;
    v_numero:=p_numero;
  else
    select coalesce(max(numero),0)+1 into v_numero
    from public.contabilidad_asientos where entidad_id=p_entidad_id;
  end if;

  insert into public.contabilidad_asientos(
    entidad_id,numero,fecha,glosa,estado,origen,referencia,proveedor_id,origen_id,creado_por
  ) values (
    p_entidad_id,v_numero,p_fecha,nullif(btrim(coalesce(p_glosa,'')),''),
    'contabilizado',coalesce(nullif(p_origen,''),'manual'),
    nullif(btrim(coalesce(p_referencia,'')),''),
    p_proveedor_id,p_origen_id,auth.uid()
  ) returning * into v_asiento;

  for v_linea in select value from jsonb_array_elements(p_lineas) loop
    v_orden:=v_orden+1;
    insert into public.contabilidad_asiento_lineas(asiento_id,cuenta_id,orden,debe,haber,glosa)
    values (
      v_asiento.id,(v_linea->>'cuenta_id')::uuid,v_orden,
      coalesce(nullif(v_linea->>'debe','')::numeric,0),
      coalesce(nullif(v_linea->>'haber','')::numeric,0),
      nullif(btrim(coalesce(v_linea->>'glosa','')),'')
    );
  end loop;
  return v_asiento;
end;
$$;

revoke all on function public.contabilidad_registrar_asiento(uuid,date,text,jsonb,text,text,uuid,uuid,integer) from public,anon;
grant execute on function public.contabilidad_registrar_asiento(uuid,date,text,jsonb,text,text,uuid,uuid,integer) to authenticated;

create or replace function public.contabilidad_anular_asiento(p_asiento_id uuid,p_motivo text)
returns public.contabilidad_asientos
language plpgsql security definer set search_path=public
as $$
declare v public.contabilidad_asientos%rowtype;
begin
  if not public.es_admin() then raise exception 'No tienes permiso para anular asientos.'; end if;
  update public.contabilidad_asientos
  set estado='anulado',anulado_por=auth.uid(),anulado_en=now(),
      motivo_anulacion=nullif(btrim(coalesce(p_motivo,'')),'')
  where id=p_asiento_id and estado='contabilizado'
  returning * into v;
  if not found then raise exception 'El asiento no existe o ya está anulado.'; end if;
  return v;
end;
$$;

revoke all on function public.contabilidad_anular_asiento(uuid,text) from public,anon;
grant execute on function public.contabilidad_anular_asiento(uuid,text) to authenticated;

create or replace function public.contabilidad_libro_diario(
  p_entidad_id uuid,p_desde date default null,p_hasta date default null
)
returns table(
  asiento_id uuid,numero integer,fecha date,cuenta_id uuid,codigo text,cuenta text,
  debe numeric,haber numeric,glosa text,glosa_linea text,referencia text
)
language plpgsql stable security definer set search_path=public
as $$
begin
  if not public.es_admin() then raise exception 'Sin permiso.'; end if;
  return query
  select a.id,a.numero,a.fecha,l.cuenta_id,c.codigo,c.cuenta,l.debe,l.haber,a.glosa,l.glosa,a.referencia
  from public.contabilidad_asientos a
  join public.contabilidad_asiento_lineas l on l.asiento_id=a.id
  join public.contabilidad_cuentas c on c.id=l.cuenta_id
  where a.entidad_id=p_entidad_id and a.estado='contabilizado'
    and (p_desde is null or a.fecha>=p_desde)
    and (p_hasta is null or a.fecha<=p_hasta)
  order by a.fecha,a.numero,l.orden;
end;
$$;

revoke all on function public.contabilidad_libro_diario(uuid,date,date) from public,anon;
grant execute on function public.contabilidad_libro_diario(uuid,date,date) to authenticated;

create or replace function public.contabilidad_mayor(
  p_entidad_id uuid,p_desde date default null,p_hasta date default null
)
returns table(
  cuenta_id uuid,codigo text,cuenta text,fecha date,numero integer,glosa text,
  debe numeric,haber numeric,saldo numeric
)
language plpgsql stable security definer set search_path=public
as $$
begin
  if not public.es_admin() then raise exception 'Sin permiso.'; end if;
  return query
  select l.cuenta_id,c.codigo,c.cuenta,a.fecha,a.numero,a.glosa,l.debe,l.haber,
    sum(l.debe-l.haber) over (
      partition by l.cuenta_id order by a.fecha,a.numero,l.orden
      rows between unbounded preceding and current row
    )
  from public.contabilidad_asientos a
  join public.contabilidad_asiento_lineas l on l.asiento_id=a.id
  join public.contabilidad_cuentas c on c.id=l.cuenta_id
  where a.entidad_id=p_entidad_id and a.estado='contabilizado'
    and (p_desde is null or a.fecha>=p_desde)
    and (p_hasta is null or a.fecha<=p_hasta)
  order by c.codigo,a.fecha,a.numero,l.orden;
end;
$$;

revoke all on function public.contabilidad_mayor(uuid,date,date) from public,anon;
grant execute on function public.contabilidad_mayor(uuid,date,date) to authenticated;

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
    select c.id,c.codigo,c.cuenta,
      coalesce(sum(l.debe) filter(where a.estado='contabilizado'),0)::numeric as debe,
      coalesce(sum(l.haber) filter(where a.estado='contabilizado'),0)::numeric as haber
    from public.contabilidad_cuentas c
    left join public.contabilidad_asiento_lineas l on l.cuenta_id=c.id
    left join public.contabilidad_asientos a on a.id=l.asiento_id
      and a.entidad_id=p_entidad_id
      and (p_desde is null or a.fecha>=p_desde)
      and (p_hasta is null or a.fecha<=p_hasta)
    where c.entidad_id=p_entidad_id and c.clase='movimiento' and c.activa
    group by c.id,c.codigo,c.cuenta
  )
  select m.id,m.codigo,m.cuenta,m.debe,m.haber,
    case when m.debe>m.haber then m.debe-m.haber else 0 end::numeric,
    case when m.haber>m.debe then m.haber-m.debe else 0 end::numeric,
    case when left(m.codigo,1)='1' and m.debe>m.haber then m.debe-m.haber else 0 end::numeric,
    case when left(m.codigo,1) in ('2','3') and m.haber>m.debe then m.haber-m.debe else 0 end::numeric,
    case when left(m.codigo,1) in ('5','6','7') then abs(m.debe-m.haber) else 0 end::numeric,
    case when left(m.codigo,1)='4' then abs(m.debe-m.haber) else 0 end::numeric
  from movimientos m order by m.codigo;
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
  select c.id,c.codigo,c.cuenta,c.eerr_seccion,c.eerr_orden,
    coalesce(sum(l.debe+l.haber) filter(where a.estado='contabilizado'),0)::numeric
  from public.contabilidad_cuentas c
  left join public.contabilidad_asiento_lineas l on l.cuenta_id=c.id
  left join public.contabilidad_asientos a on a.id=l.asiento_id
    and a.entidad_id=p_entidad_id
    and (p_desde is null or a.fecha>=p_desde)
    and (p_hasta is null or a.fecha<=p_hasta)
  where c.entidad_id=p_entidad_id and c.clase='movimiento' and c.activa
    and c.eerr_seccion is not null
  group by c.id,c.codigo,c.cuenta,c.eerr_seccion,c.eerr_orden
  order by c.eerr_seccion,c.eerr_orden,c.codigo;
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
  select c.id,c.codigo,c.cuenta,sum(l.debe+l.haber)::numeric
  from public.contabilidad_asientos a
  join public.contabilidad_asiento_lineas l on l.asiento_id=a.id
  join public.contabilidad_cuentas c on c.id=l.cuenta_id
  where a.entidad_id=p_entidad_id and a.estado='contabilizado'
    and c.tipo_contable in ('ingreso','costo','gasto','impuesto')
    and c.eerr_seccion is null
    and (p_desde is null or a.fecha>=p_desde)
    and (p_hasta is null or a.fecha<=p_hasta)
  group by c.id,c.codigo,c.cuenta
  having sum(l.debe+l.haber)<>0
  order by c.codigo;
end;
$$;

revoke all on function public.contabilidad_eerr_sin_clasificar(uuid,date,date) from public,anon;
grant execute on function public.contabilidad_eerr_sin_clasificar(uuid,date,date) to authenticated;

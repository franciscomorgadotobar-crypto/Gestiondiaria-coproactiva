
-- Evolución completa del módulo contable: planes maestros, jerarquía,
-- protección histórica, centros de costo e informes filtrables.

create table if not exists public.contabilidad_plan_plantillas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  naturaleza text not null check (naturaleza in ('comunidad','empresa','otro')),
  origen text not null default 'sistema' check (origen in ('sistema','personalizada')),
  creado_por uuid references public.perfiles(id) on delete set null,
  activa boolean not null default true,
  creado_en timestamptz not null default now(),
  editado_en timestamptz not null default now()
);

create table if not exists public.contabilidad_plan_plantilla_cuentas (
  id uuid primary key default gen_random_uuid(),
  plantilla_id uuid not null references public.contabilidad_plan_plantillas(id) on delete cascade,
  codigo text not null,
  parent_codigo text,
  cuenta text not null,
  clase text not null check (clase in ('titulo','movimiento')),
  tipo_contable text not null check (tipo_contable in ('activo','pasivo','patrimonio','ingreso','costo','gasto','impuesto')),
  grupo text,
  naturaleza text check (naturaleza is null or naturaleza in ('deudora','acreedora')),
  clasificacion_balance text check (clasificacion_balance is null or clasificacion_balance in ('activo','pasivo','perdida','ganancia')),
  eerr_seccion text,
  eerr_orden integer,
  nivel smallint not null check (nivel between 1 and 5),
  imputable boolean not null default true,
  requiere_centro_costo boolean not null default false,
  orden integer not null default 0,
  unique(plantilla_id,codigo)
);

alter table public.contabilidad_plan_plantillas enable row level security;
alter table public.contabilidad_plan_plantilla_cuentas enable row level security;

drop policy if exists contabilidad_plantillas_lectura on public.contabilidad_plan_plantillas;
create policy contabilidad_plantillas_lectura on public.contabilidad_plan_plantillas
for select to authenticated
using (
  public.es_admin()
  and (origen='sistema' or creado_por=auth.uid() or public.es_superadmin())
);

drop policy if exists contabilidad_plantilla_cuentas_lectura on public.contabilidad_plan_plantilla_cuentas;
create policy contabilidad_plantilla_cuentas_lectura on public.contabilidad_plan_plantilla_cuentas
for select to authenticated
using (
  public.es_admin() and exists(
    select 1 from public.contabilidad_plan_plantillas p
    where p.id=plantilla_id
      and (p.origen='sistema' or p.creado_por=auth.uid() or public.es_superadmin())
  )
);

grant select on public.contabilidad_plan_plantillas,public.contabilidad_plan_plantilla_cuentas to authenticated;
grant all on public.contabilidad_plan_plantillas,public.contabilidad_plan_plantilla_cuentas to service_role;

alter table public.contabilidad_entidades
  add column if not exists plan_origen text not null default 'pendiente',
  add column if not exists plan_plantilla_id uuid references public.contabilidad_plan_plantillas(id) on delete set null,
  add column if not exists usa_centros_costo boolean not null default false,
  add column if not exists plan_configurado_en timestamptz,
  add column if not exists plan_configurado_por uuid references public.perfiles(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='contabilidad_entidades_plan_origen_check'
  ) then
    alter table public.contabilidad_entidades
      add constraint contabilidad_entidades_plan_origen_check
      check (plan_origen in ('pendiente','plantilla','personalizada','importado','manual','legado'));
  end if;
end $$;

alter table public.contabilidad_cuentas
  add column if not exists nivel smallint,
  add column if not exists imputable boolean not null default true,
  add column if not exists requiere_centro_costo boolean not null default false;

update public.contabilidad_cuentas
set nivel=least(5,greatest(1,array_length(string_to_array(codigo,'.'),1)))
where nivel is null;

alter table public.contabilidad_cuentas
  alter column nivel set default 4,
  alter column nivel set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='contabilidad_cuentas_nivel_check'
  ) then
    alter table public.contabilidad_cuentas
      add constraint contabilidad_cuentas_nivel_check check (nivel between 1 and 5);
  end if;
end $$;

create table if not exists public.contabilidad_centros_costo (
  id uuid primary key default gen_random_uuid(),
  entidad_id uuid not null references public.contabilidad_entidades(id) on delete cascade,
  codigo text not null,
  nombre text not null,
  descripcion text,
  activa boolean not null default true,
  creado_por uuid references public.perfiles(id) on delete set null,
  creado_en timestamptz not null default now(),
  editado_en timestamptz not null default now(),
  unique(entidad_id,codigo)
);

alter table public.contabilidad_asiento_lineas
  add column if not exists centro_costo_id uuid references public.contabilidad_centros_costo(id) on delete restrict;

create index if not exists contabilidad_lineas_centro_idx
  on public.contabilidad_asiento_lineas(centro_costo_id);
create index if not exists contabilidad_centros_entidad_idx
  on public.contabilidad_centros_costo(entidad_id,activa,codigo);

alter table public.contabilidad_centros_costo enable row level security;
drop policy if exists contabilidad_centros_admin on public.contabilidad_centros_costo;
create policy contabilidad_centros_admin on public.contabilidad_centros_costo
for all to authenticated using(public.es_admin()) with check(public.es_admin());
grant select,insert,update,delete on public.contabilidad_centros_costo to authenticated;
grant all on public.contabilidad_centros_costo to service_role;


insert into public.contabilidad_plan_plantillas(codigo,nombre,naturaleza,origen,activa)
values('COMUNIDAD_SIMPLIFICADO','Comunidad - Simplificado','comunidad','sistema',true)
on conflict(codigo) do update set nombre=excluded.nombre,naturaleza=excluded.naturaleza,activa=true,editado_en=now();

delete from public.contabilidad_plan_plantilla_cuentas
where plantilla_id=(select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO');
insert into public.contabilidad_plan_plantilla_cuentas(
  plantilla_id,codigo,parent_codigo,cuenta,clase,tipo_contable,grupo,naturaleza,
  clasificacion_balance,eerr_seccion,eerr_orden,nivel,imputable,requiere_centro_costo,orden
) values
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '1',null,'ACTIVOS','titulo','activo','ACTIVOS',
 'deudora','activo',null,null,1,false,false,1
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '2',null,'PASIVOS','titulo','pasivo','PASIVOS',
 'acreedora','pasivo',null,null,1,false,false,2
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '3',null,'PATRIMONIO / FONDOS PROPIOS','titulo','patrimonio','PATRIMONIO / FONDOS PROPIOS',
 'acreedora','pasivo',null,null,1,false,false,3
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '4',null,'INGRESOS','titulo','ingreso','INGRESOS',
 'acreedora','ganancia','resultado_no_operacional',null,1,false,false,4
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '5',null,'EGRESOS / GASTOS COMUNES','titulo','gasto','EGRESOS / GASTOS COMUNES',
 'deudora','perdida','gastos_administracion',null,1,false,false,5
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '1.1','1','Activos Circulantes / Disponibilidades','titulo','activo','Activos Circulantes / Disponibilidades',
 'deudora','activo',null,null,2,false,false,6
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '1.2','1','Cuentas por Cobrar','titulo','activo','Cuentas por Cobrar',
 'deudora','activo',null,null,2,false,false,7
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '2.1','2','Pasivos Circulantes / Obligaciones a Corto Plazo','titulo','pasivo','Pasivos Circulantes / Obligaciones a Corto Plazo',
 'acreedora','pasivo',null,null,2,false,false,8
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '2.2','2','Fondos de la Copropiedad','titulo','pasivo','Fondos de la Copropiedad',
 'acreedora','pasivo',null,null,2,false,false,9
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '3.1','3','Patrimonio Neto','titulo','patrimonio','Patrimonio Neto',
 'acreedora','pasivo',null,null,2,false,false,10
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '4.1','4','Ingresos Ordinarios','titulo','ingreso','Ingresos Ordinarios',
 'acreedora','ganancia','resultado_no_operacional',null,2,false,false,11
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '4.2','4','Ingresos Extraordinarios y Otros','titulo','ingreso','Ingresos Extraordinarios y Otros',
 'acreedora','ganancia','resultado_no_operacional',null,2,false,false,12
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '5.1','5','Gastos de Administración','titulo','gasto','Gastos de Administración',
 'deudora','perdida','gastos_administracion',null,2,false,false,13
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '5.2','5','Gastos de Mantención Ordinaria','titulo','gasto','Gastos de Mantención Ordinaria',
 'deudora','perdida','gastos_administracion',null,2,false,false,14
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '5.3','5','Consumos de la Comunidad','titulo','gasto','Consumos de la Comunidad',
 'deudora','perdida','gastos_administracion',null,2,false,false,15
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '5.4','5','Gastos de Reparación Ordinaria','titulo','gasto','Gastos de Reparación Ordinaria',
 'deudora','perdida','gastos_administracion',null,2,false,false,16
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '5.5','5','Gastos Extraordinarios y Nuevas Obras','titulo','gasto','Gastos Extraordinarios y Nuevas Obras',
 'deudora','perdida','gastos_administracion',null,2,false,false,17
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '1.1.01','1.1','Disponibilidades','titulo','activo','Activos Circulantes / Disponibilidades',
 'deudora','activo',null,null,3,false,false,18
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '1.2.01','1.2','Cuentas por Cobrar','titulo','activo','Cuentas por Cobrar',
 'deudora','activo',null,null,3,false,false,19
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '2.1.01','2.1','Obligaciones a Corto Plazo','titulo','pasivo','Pasivos Circulantes / Obligaciones a Corto Plazo',
 'acreedora','pasivo',null,null,3,false,false,20
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '2.2.02','2.2','Fondos de la Copropiedad','titulo','pasivo','Fondos de la Copropiedad',
 'acreedora','pasivo',null,null,3,false,false,21
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '3.1.01','3.1','Patrimonio Neto','titulo','patrimonio','Patrimonio Neto',
 'acreedora','pasivo',null,null,3,false,false,22
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '4.1.01','4.1','Ingresos Ordinarios','titulo','ingreso','Ingresos Ordinarios',
 'acreedora','ganancia','ingresos_operacionales',null,3,false,false,23
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '4.2.01','4.2','Ingresos Extraordinarios y Otros','titulo','ingreso','Ingresos Extraordinarios y Otros',
 'acreedora','ganancia','resultado_no_operacional',null,3,false,false,24
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '5.1.01','5.1','Gastos de Administración','titulo','gasto','Gastos de Administración',
 'deudora','perdida','gastos_administracion',null,3,false,false,25
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '5.2.01','5.2','Gastos de Mantención Ordinaria','titulo','gasto','Gastos de Mantención Ordinaria',
 'deudora','perdida','gastos_administracion',null,3,false,false,26
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '5.3.01','5.3','Consumos de la Comunidad','titulo','gasto','Consumos de la Comunidad',
 'deudora','perdida','gastos_administracion',null,3,false,false,27
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '5.4.01','5.4','Gastos de Reparación Ordinaria','titulo','gasto','Gastos de Reparación Ordinaria',
 'deudora','perdida','gastos_administracion',null,3,false,false,28
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '5.5.01','5.5','Gastos Extraordinarios y Nuevas Obras','titulo','gasto','Gastos Extraordinarios y Nuevas Obras',
 'deudora','perdida','gastos_administracion',null,3,false,false,29
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '2.2.02.001','2.2.02','Fondo de Reserva Acumulado','titulo','pasivo','Fondos de la Copropiedad',
 'acreedora','pasivo',null,null,4,false,false,30
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '1.1.01.001','1.1.01','Caja Chica Administración','movimiento','activo','Activos Circulantes / Disponibilidades',
 'deudora','activo',null,1,4,true,false,31
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '1.1.01.002','1.1.01','Banco Principal - Cuenta Corriente Condominio','movimiento','activo','Activos Circulantes / Disponibilidades',
 'deudora','activo',null,2,4,true,false,32
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '1.1.01.003','1.1.01','Banco - Cuenta Fondo de Reserva','movimiento','activo','Activos Circulantes / Disponibilidades',
 'deudora','activo',null,3,4,true,false,33
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '1.2.01.001','1.2.01','Gastos Comunes por Cobrar','movimiento','activo','Cuentas por Cobrar',
 'deudora','activo',null,1,4,true,false,34
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '1.2.01.002','1.2.01','Multas e Intereses por Cobrar','movimiento','activo','Cuentas por Cobrar',
 'deudora','activo',null,2,4,true,false,35
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '1.2.01.003','1.2.01','Convenios de Pago por Cobrar','movimiento','activo','Cuentas por Cobrar',
 'deudora','activo',null,3,4,true,false,36
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '1.2.01.099','1.2.01','Otros Cobros por Recuperar','movimiento','activo','Cuentas por Cobrar',
 'deudora','activo',null,99,4,true,false,37
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '2.1.01.001','2.1.01','Proveedores de Servicios','movimiento','pasivo','Pasivos Circulantes / Obligaciones a Corto Plazo',
 'acreedora','pasivo',null,1,4,true,false,38
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '2.1.01.002','2.1.01','Contratistas y Proveedores de Mantención','movimiento','pasivo','Pasivos Circulantes / Obligaciones a Corto Plazo',
 'acreedora','pasivo',null,2,4,true,false,39
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '2.1.01.003','2.1.01','Retenciones de Impuestos','movimiento','pasivo','Pasivos Circulantes / Obligaciones a Corto Plazo',
 'acreedora','pasivo',null,3,4,true,false,40
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '2.1.01.099','2.1.01','Otros Acreedores / Cuentas por Pagar','movimiento','pasivo','Pasivos Circulantes / Obligaciones a Corto Plazo',
 'acreedora','pasivo',null,99,4,true,false,41
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '2.2.02.001.001','2.2.02.001','F.R. - Recaudación Gasto Común Ordinario','movimiento','pasivo','Fondos de la Copropiedad',
 'acreedora','pasivo',null,1,5,true,false,42
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '2.2.02.001.002','2.2.02.001','F.R. - Intereses por Morosidad Capitalizados','movimiento','pasivo','Fondos de la Copropiedad',
 'acreedora','pasivo',null,2,5,true,false,43
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '2.2.02.001.099','2.2.02.001','F.R. - Otros Aportes al Fondo','movimiento','pasivo','Fondos de la Copropiedad',
 'acreedora','pasivo',null,99,5,true,false,44
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '3.1.01.001','3.1.01','Fondo Inicial de Operación','movimiento','patrimonio','Patrimonio Neto',
 'acreedora','pasivo',null,1,4,true,false,45
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '3.1.01.002','3.1.01','Superávit / Déficit de Ejercicios Anteriores','movimiento','patrimonio','Patrimonio Neto',
 'acreedora','pasivo',null,2,4,true,false,46
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '3.1.01.003','3.1.01','Resultado del Ejercicio Actual','movimiento','patrimonio','Patrimonio Neto',
 'acreedora','pasivo',null,3,4,true,false,47
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '4.1.01.001','4.1.01','Recaudación Gasto Común Ordinario','movimiento','ingreso','Ingresos Ordinarios',
 'acreedora','ganancia','ingresos_operacionales',1,4,true,false,48
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '4.1.01.002','4.1.01','Recaudación para Fondo de Reserva','movimiento','ingreso','Ingresos Ordinarios',
 'acreedora','ganancia','ingresos_operacionales',2,4,true,false,49
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '4.2.01.001','4.2.01','Intereses por Morosidad','movimiento','ingreso','Ingresos Extraordinarios y Otros',
 'acreedora','ganancia','resultado_no_operacional',1,4,true,false,50
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '4.2.01.002','4.2.01','Multas por Infracciones al Reglamento de Copropiedad','movimiento','ingreso','Ingresos Extraordinarios y Otros',
 'acreedora','ganancia','resultado_no_operacional',2,4,true,false,51
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '4.2.01.099','4.2.01','Otros Ingresos No Operacionales','movimiento','ingreso','Ingresos Extraordinarios y Otros',
 'acreedora','ganancia','resultado_no_operacional',99,4,true,false,52
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '5.1.01.001','5.1.01','Honorarios del Administrador','movimiento','gasto','Gastos de Administración',
 'deudora','perdida','gastos_administracion',1,4,true,false,53
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '5.1.01.002','5.1.01','Software de Administración y Gastos Portales Web','movimiento','gasto','Gastos de Administración',
 'deudora','perdida','gastos_administracion',2,4,true,false,54
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '5.1.01.003','5.1.01','Artículos de Oficina, Impresiones y Despacho','movimiento','gasto','Gastos de Administración',
 'deudora','perdida','gastos_administracion',3,4,true,false,55
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '5.1.01.099','5.1.01','Otros Gastos de Administración','movimiento','gasto','Gastos de Administración',
 'deudora','perdida','gastos_administracion',99,4,true,false,56
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '5.2.01.001','5.2.01','Servicio Externo de Jardinería y Paisajismo','movimiento','gasto','Gastos de Mantención Ordinaria',
 'deudora','perdida','gastos_administracion',1,4,true,false,57
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '5.2.01.002','5.2.01','Mantención de Portones Eléctricos y Accesos','movimiento','gasto','Gastos de Mantención Ordinaria',
 'deudora','perdida','gastos_administracion',2,4,true,false,58
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '5.2.01.003','5.2.01','Insumos de Aseo, Alumbrado y Ornato','movimiento','gasto','Gastos de Mantención Ordinaria',
 'deudora','perdida','gastos_administracion',3,4,true,false,59
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '5.2.01.004','5.2.01','Primas de Seguros contra Incendio y Sismo','movimiento','gasto','Gastos de Mantención Ordinaria',
 'deudora','perdida','gastos_administracion',4,4,true,false,60
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '5.2.01.099','5.2.01','Otros Gastos de Mantención','movimiento','gasto','Gastos de Mantención Ordinaria',
 'deudora','perdida','gastos_administracion',99,4,true,false,61
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '5.3.01.001','5.3.01','Consumo de Electricidad Espacios Comunes','movimiento','gasto','Consumos de la Comunidad',
 'deudora','perdida','gastos_administracion',1,4,true,false,62
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '5.3.01.002','5.3.01','Consumo de Agua Potable Áreas Verdes','movimiento','gasto','Consumos de la Comunidad',
 'deudora','perdida','gastos_administracion',2,4,true,false,63
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '5.3.01.099','5.3.01','Otros Consumos de la Comunidad','movimiento','gasto','Consumos de la Comunidad',
 'deudora','perdida','gastos_administracion',99,4,true,false,64
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '5.4.01.001','5.4.01','Reparación de Portones Eléctricos y Citofonía','movimiento','gasto','Gastos de Reparación Ordinaria',
 'deudora','perdida','gastos_administracion',1,4,true,false,65
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '5.4.01.002','5.4.01','Reparaciones Eléctricas e Iluminación Común','movimiento','gasto','Gastos de Reparación Ordinaria',
 'deudora','perdida','gastos_administracion',2,4,true,false,66
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '5.4.01.003','5.4.01','Obras Menores, Cerrajería y Gasfitería Común','movimiento','gasto','Gastos de Reparación Ordinaria',
 'deudora','perdida','gastos_administracion',3,4,true,false,67
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '5.4.01.099','5.4.01','Otros Gastos de Reparación','movimiento','gasto','Gastos de Reparación Ordinaria',
 'deudora','perdida','gastos_administracion',99,4,true,false,68
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '5.5.01.001','5.5.01','Proyectos de Inversión y Mejoras','movimiento','gasto','Gastos Extraordinarios y Nuevas Obras',
 'deudora','perdida','gastos_administracion',1,4,true,false,69
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '5.5.01.002','5.5.01','Reparaciones Mayores por Emergencia','movimiento','gasto','Gastos Extraordinarios y Nuevas Obras',
 'deudora','perdida','gastos_administracion',2,4,true,false,70
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_SIMPLIFICADO'),
 '5.5.01.099','5.5.01','Otros Gastos Extraordinarios','movimiento','gasto','Gastos Extraordinarios y Nuevas Obras',
 'deudora','perdida','gastos_administracion',99,4,true,false,71
);

insert into public.contabilidad_plan_plantillas(codigo,nombre,naturaleza,origen,activa)
values('COMUNIDAD_ESTANDAR','Comunidad - Estándar','comunidad','sistema',true)
on conflict(codigo) do update set nombre=excluded.nombre,naturaleza=excluded.naturaleza,activa=true,editado_en=now();

delete from public.contabilidad_plan_plantilla_cuentas
where plantilla_id=(select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR');
insert into public.contabilidad_plan_plantilla_cuentas(
  plantilla_id,codigo,parent_codigo,cuenta,clase,tipo_contable,grupo,naturaleza,
  clasificacion_balance,eerr_seccion,eerr_orden,nivel,imputable,requiere_centro_costo,orden
) values
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '1',null,'ACTIVOS','titulo','activo','ACTIVOS',
 'deudora','activo',null,null,1,false,false,1
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '2',null,'PASIVOS','titulo','pasivo','PASIVOS',
 'acreedora','pasivo',null,null,1,false,false,2
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '3',null,'PATRIMONIO / FONDOS PROPIOS','titulo','patrimonio','PATRIMONIO / FONDOS PROPIOS',
 'acreedora','pasivo',null,null,1,false,false,3
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '4',null,'INGRESOS','titulo','ingreso','INGRESOS',
 'acreedora','ganancia','resultado_no_operacional',null,1,false,false,4
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5',null,'EGRESOS / GASTOS COMUNES','titulo','gasto','EGRESOS / GASTOS COMUNES',
 'deudora','perdida','gastos_administracion',null,1,false,false,5
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '1.1','1','Activos Circulantes / Disponibilidades','titulo','activo','Activos Circulantes / Disponibilidades',
 'deudora','activo',null,null,2,false,false,6
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '1.2','1','Cuentas por Cobrar','titulo','activo','Cuentas por Cobrar',
 'deudora','activo',null,null,2,false,false,7
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '2.1','2','Pasivos Circulantes / Obligaciones a Corto Plazo','titulo','pasivo','Pasivos Circulantes / Obligaciones a Corto Plazo',
 'acreedora','pasivo',null,null,2,false,false,8
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '2.2','2','Fondos de la Copropiedad','titulo','pasivo','Fondos de la Copropiedad',
 'acreedora','pasivo',null,null,2,false,false,9
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '3.1','3','Patrimonio Neto','titulo','patrimonio','Patrimonio Neto',
 'acreedora','pasivo',null,null,2,false,false,10
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '4.1','4','Ingresos Ordinarios','titulo','ingreso','Ingresos Ordinarios',
 'acreedora','ganancia','resultado_no_operacional',null,2,false,false,11
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '4.2','4','Ingresos Extraordinarios y Otros','titulo','ingreso','Ingresos Extraordinarios y Otros',
 'acreedora','ganancia','resultado_no_operacional',null,2,false,false,12
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.1','5','Gastos de Administración','titulo','gasto','Gastos de Administración',
 'deudora','perdida','gastos_administracion',null,2,false,false,13
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.2','5','Gastos de Mantención Ordinaria','titulo','gasto','Gastos de Mantención Ordinaria',
 'deudora','perdida','gastos_administracion',null,2,false,false,14
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.3','5','Consumos de la Comunidad','titulo','gasto','Consumos de la Comunidad',
 'deudora','perdida','gastos_administracion',null,2,false,false,15
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.4','5','Gastos de Reparación Ordinaria','titulo','gasto','Gastos de Reparación Ordinaria',
 'deudora','perdida','gastos_administracion',null,2,false,false,16
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.5','5','Gastos Extraordinarios y Nuevas Obras','titulo','gasto','Gastos Extraordinarios y Nuevas Obras',
 'deudora','perdida','gastos_administracion',null,2,false,false,17
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '1.1.01','1.1','Disponibilidades','titulo','activo','Activos Circulantes / Disponibilidades',
 'deudora','activo',null,null,3,false,false,18
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '1.2.01','1.2','Cuentas por Cobrar','titulo','activo','Cuentas por Cobrar',
 'deudora','activo',null,null,3,false,false,19
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '2.1.01','2.1','Obligaciones a Corto Plazo','titulo','pasivo','Pasivos Circulantes / Obligaciones a Corto Plazo',
 'acreedora','pasivo',null,null,3,false,false,20
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '2.2.02','2.2','Fondos de la Copropiedad','titulo','pasivo','Fondos de la Copropiedad',
 'acreedora','pasivo',null,null,3,false,false,21
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '3.1.01','3.1','Patrimonio Neto','titulo','patrimonio','Patrimonio Neto',
 'acreedora','pasivo',null,null,3,false,false,22
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '4.1.01','4.1','Ingresos Ordinarios','titulo','ingreso','Ingresos Ordinarios',
 'acreedora','ganancia','ingresos_operacionales',null,3,false,false,23
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '4.2.01','4.2','Ingresos Extraordinarios y Otros','titulo','ingreso','Ingresos Extraordinarios y Otros',
 'acreedora','ganancia','resultado_no_operacional',null,3,false,false,24
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.1.01','5.1','Gastos de Administración','titulo','gasto','Gastos de Administración',
 'deudora','perdida','gastos_administracion',null,3,false,false,25
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.2.01','5.2','Gastos de Mantención Ordinaria','titulo','gasto','Gastos de Mantención Ordinaria',
 'deudora','perdida','gastos_administracion',null,3,false,false,26
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.3.01','5.3','Consumos de la Comunidad','titulo','gasto','Consumos de la Comunidad',
 'deudora','perdida','gastos_administracion',null,3,false,false,27
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.4.01','5.4','Gastos de Reparación Ordinaria','titulo','gasto','Gastos de Reparación Ordinaria',
 'deudora','perdida','gastos_administracion',null,3,false,false,28
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.5.01','5.5','Gastos Extraordinarios y Nuevas Obras','titulo','gasto','Gastos Extraordinarios y Nuevas Obras',
 'deudora','perdida','gastos_administracion',null,3,false,false,29
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '2.2.02.001','2.2.02','Fondo de Reserva Acumulado','titulo','pasivo','Fondos de la Copropiedad',
 'acreedora','pasivo',null,null,4,false,false,30
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '1.1.01.001','1.1.01','Caja Chica Administración','movimiento','activo','Activos Circulantes / Disponibilidades',
 'deudora','activo',null,1,4,true,false,31
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '1.1.01.002','1.1.01','Banco Principal - Cuenta Corriente Condominio','movimiento','activo','Activos Circulantes / Disponibilidades',
 'deudora','activo',null,2,4,true,false,32
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '1.1.01.003','1.1.01','Banco - Cuenta Fondo de Reserva','movimiento','activo','Activos Circulantes / Disponibilidades',
 'deudora','activo',null,3,4,true,false,33
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '1.1.01.004','1.1.01','Banco - Cuenta Fondos de Contingencia / Seguros','movimiento','activo','Activos Circulantes / Disponibilidades',
 'deudora','activo',null,4,4,true,false,34
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '1.2.01.001','1.2.01','Gastos Comunes por Cobrar','movimiento','activo','Cuentas por Cobrar',
 'deudora','activo',null,1,4,true,false,35
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '1.2.01.002','1.2.01','Multas e Intereses por Cobrar','movimiento','activo','Cuentas por Cobrar',
 'deudora','activo',null,2,4,true,false,36
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '1.2.01.003','1.2.01','Convenios de Pago por Cobrar','movimiento','activo','Cuentas por Cobrar',
 'deudora','activo',null,3,4,true,false,37
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '1.2.01.004','1.2.01','Cobros por Uso de Espacios Comunes','movimiento','activo','Cuentas por Cobrar',
 'deudora','activo',null,4,4,true,false,38
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '1.2.01.005','1.2.01','Consumos Individuales por Cobrar','movimiento','activo','Cuentas por Cobrar',
 'deudora','activo',null,5,4,true,false,39
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '1.2.01.099','1.2.01','Otros Cobros por Recuperar','movimiento','activo','Cuentas por Cobrar',
 'deudora','activo',null,99,4,true,false,40
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '2.1.01.001','2.1.01','Proveedores de Servicios','movimiento','pasivo','Pasivos Circulantes / Obligaciones a Corto Plazo',
 'acreedora','pasivo',null,1,4,true,false,41
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '2.1.01.002','2.1.01','Contratistas de Mantenimiento','movimiento','pasivo','Pasivos Circulantes / Obligaciones a Corto Plazo',
 'acreedora','pasivo',null,2,4,true,false,42
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '2.1.01.003','2.1.01','Remuneraciones por Pagar','movimiento','pasivo','Pasivos Circulantes / Obligaciones a Corto Plazo',
 'acreedora','pasivo',null,3,4,true,false,43
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '2.1.01.004','2.1.01','Retenciones de Impuestos','movimiento','pasivo','Pasivos Circulantes / Obligaciones a Corto Plazo',
 'acreedora','pasivo',null,4,4,true,false,44
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '2.1.01.005','2.1.01','Leyes Sociales por Pagar','movimiento','pasivo','Pasivos Circulantes / Obligaciones a Corto Plazo',
 'acreedora','pasivo',null,5,4,true,false,45
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '2.1.01.006','2.1.01','Seguros de Espacios Comunes por Pagar','movimiento','pasivo','Pasivos Circulantes / Obligaciones a Corto Plazo',
 'acreedora','pasivo',null,6,4,true,false,46
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '2.1.01.099','2.1.01','Otros Acreedores / Cuentas por Pagar','movimiento','pasivo','Pasivos Circulantes / Obligaciones a Corto Plazo',
 'acreedora','pasivo',null,99,4,true,false,47
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '2.2.02.001.001','2.2.02.001','F.R. - Recaudación Gasto Común Ordinario','movimiento','pasivo','Fondos de la Copropiedad',
 'acreedora','pasivo',null,1,5,true,false,48
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '2.2.02.001.002','2.2.02.001','F.R. - Intereses por Morosidad Capitalizados','movimiento','pasivo','Fondos de la Copropiedad',
 'acreedora','pasivo',null,2,5,true,false,49
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '2.2.02.001.003','2.2.02.001','F.R. - Multas por Infracciones','movimiento','pasivo','Fondos de la Copropiedad',
 'acreedora','pasivo',null,3,5,true,false,50
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '2.2.02.001.004','2.2.02.001','F.R. - Arriendo de Espacios Comunes','movimiento','pasivo','Fondos de la Copropiedad',
 'acreedora','pasivo',null,4,5,true,false,51
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '2.2.02.001.099','2.2.02.001','F.R. - Otros Aportes al Fondo','movimiento','pasivo','Fondos de la Copropiedad',
 'acreedora','pasivo',null,99,5,true,false,52
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '2.2.02.002','2.2.02','Fondos de Garantía de Proveedores / Contratistas','movimiento','pasivo','Fondos de la Copropiedad',
 'acreedora','pasivo',null,2,4,true,false,53
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '2.2.02.003','2.2.02','Recaudaciones Anticipadas de Copropietarios','movimiento','pasivo','Fondos de la Copropiedad',
 'acreedora','pasivo',null,3,4,true,false,54
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '3.1.01.001','3.1.01','Fondo Inicial de Operación','movimiento','patrimonio','Patrimonio Neto',
 'acreedora','pasivo',null,1,4,true,false,55
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '3.1.01.002','3.1.01','Superávit / Déficit de Ejercicios Anteriores','movimiento','patrimonio','Patrimonio Neto',
 'acreedora','pasivo',null,2,4,true,false,56
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '3.1.01.003','3.1.01','Resultado del Ejercicio Actual','movimiento','patrimonio','Patrimonio Neto',
 'acreedora','pasivo',null,3,4,true,false,57
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '4.1.01.001','4.1.01','Recaudación Gasto Común Ordinario','movimiento','ingreso','Ingresos Ordinarios',
 'acreedora','ganancia','ingresos_operacionales',1,4,true,false,58
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '4.1.01.002','4.1.01','Recaudación para Fondo de Reserva','movimiento','ingreso','Ingresos Ordinarios',
 'acreedora','ganancia','ingresos_operacionales',2,4,true,false,59
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '4.2.01.001','4.2.01','Intereses por Morosidad','movimiento','ingreso','Ingresos Extraordinarios y Otros',
 'acreedora','ganancia','resultado_no_operacional',1,4,true,false,60
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '4.2.01.002','4.2.01','Multas por Infracciones al Reglamento de Copropiedad','movimiento','ingreso','Ingresos Extraordinarios y Otros',
 'acreedora','ganancia','resultado_no_operacional',2,4,true,false,61
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '4.2.01.003','4.2.01','Arriendo de Espacios Comunes','movimiento','ingreso','Ingresos Extraordinarios y Otros',
 'acreedora','ganancia','resultado_no_operacional',3,4,true,false,62
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '4.2.01.004','4.2.01','Ingresos por Publicidad','movimiento','ingreso','Ingresos Extraordinarios y Otros',
 'acreedora','ganancia','resultado_no_operacional',4,4,true,false,63
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '4.2.01.099','4.2.01','Otros Ingresos No Operacionales','movimiento','ingreso','Ingresos Extraordinarios y Otros',
 'acreedora','ganancia','resultado_no_operacional',99,4,true,false,64
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.1.01.001','5.1.01','Honorarios del Administrador','movimiento','gasto','Gastos de Administración',
 'deudora','perdida','gastos_administracion',1,4,true,false,65
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.1.01.002','5.1.01','Sueldos Conserjes y Personal de Planta','movimiento','gasto','Gastos de Administración',
 'deudora','perdida','gastos_administracion',2,4,true,false,66
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.1.01.003','5.1.01','Horas Extraordinarias y Reemplazos','movimiento','gasto','Gastos de Administración',
 'deudora','perdida','gastos_administracion',3,4,true,false,67
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.1.01.004','5.1.01','Leyes Sociales y Mutual de Seguridad','movimiento','gasto','Gastos de Administración',
 'deudora','perdida','gastos_administracion',4,4,true,false,68
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.1.01.005','5.1.01','Software de Administración y Gastos Portales Web','movimiento','gasto','Gastos de Administración',
 'deudora','perdida','gastos_administracion',5,4,true,false,69
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.1.01.006','5.1.01','Artículos de Oficina, Impresiones y Despacho','movimiento','gasto','Gastos de Administración',
 'deudora','perdida','gastos_administracion',6,4,true,false,70
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.1.01.007','5.1.01','Indemnizaciones Laborales / Finiquitos Ordinarios','movimiento','gasto','Gastos de Administración',
 'deudora','perdida','gastos_administracion',7,4,true,false,71
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.1.01.099','5.1.01','Otros Gastos de Administración','movimiento','gasto','Gastos de Administración',
 'deudora','perdida','gastos_administracion',99,4,true,false,72
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.2.01.001','5.2.01','Mantención de Ascensores y Montacargas','movimiento','gasto','Gastos de Mantención Ordinaria',
 'deudora','perdida','gastos_administracion',1,4,true,false,73
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.2.01.002','5.2.01','Mantención de Bombas de Agua y Calderas','movimiento','gasto','Gastos de Mantención Ordinaria',
 'deudora','perdida','gastos_administracion',2,4,true,false,74
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.2.01.003','5.2.01','Mantención de Portones Eléctricos y Seguridad','movimiento','gasto','Gastos de Mantención Ordinaria',
 'deudora','perdida','gastos_administracion',3,4,true,false,75
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.2.01.004','5.2.01','Insumos de Aseo y Sanitización','movimiento','gasto','Gastos de Mantención Ordinaria',
 'deudora','perdida','gastos_administracion',4,4,true,false,76
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.2.01.005','5.2.01','Certificaciones Obligatorias','movimiento','gasto','Gastos de Mantención Ordinaria',
 'deudora','perdida','gastos_administracion',5,4,true,false,77
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.2.01.006','5.2.01','Primas de Seguros contra Incendio y Sismo','movimiento','gasto','Gastos de Mantención Ordinaria',
 'deudora','perdida','gastos_administracion',6,4,true,false,78
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.2.01.099','5.2.01','Otros Gastos de Mantención','movimiento','gasto','Gastos de Mantención Ordinaria',
 'deudora','perdida','gastos_administracion',99,4,true,false,79
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.3.01.001','5.3.01','Consumo de Electricidad Espacios Comunes','movimiento','gasto','Consumos de la Comunidad',
 'deudora','perdida','gastos_administracion',1,4,true,false,80
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.3.01.002','5.3.01','Consumo de Agua Potable y Alcantarillado','movimiento','gasto','Consumos de la Comunidad',
 'deudora','perdida','gastos_administracion',2,4,true,false,81
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.3.01.003','5.3.01','Consumo de Gas de Calderas / Calefacción Central','movimiento','gasto','Consumos de la Comunidad',
 'deudora','perdida','gastos_administracion',3,4,true,false,82
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.3.01.099','5.3.01','Otros Consumos de la Comunidad','movimiento','gasto','Consumos de la Comunidad',
 'deudora','perdida','gastos_administracion',99,4,true,false,83
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.4.01.001','5.4.01','Reparación de Ascensores y Montacargas','movimiento','gasto','Gastos de Reparación Ordinaria',
 'deudora','perdida','gastos_administracion',1,4,true,false,84
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.4.01.002','5.4.01','Reparación de Bombas de Agua, Calderas y Redes de Gas','movimiento','gasto','Gastos de Reparación Ordinaria',
 'deudora','perdida','gastos_administracion',2,4,true,false,85
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.4.01.003','5.4.01','Reparación de Portones Eléctricos, Citofonía y Seguridad','movimiento','gasto','Gastos de Reparación Ordinaria',
 'deudora','perdida','gastos_administracion',3,4,true,false,86
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.4.01.004','5.4.01','Reparaciones Eléctricas e Iluminación Común','movimiento','gasto','Gastos de Reparación Ordinaria',
 'deudora','perdida','gastos_administracion',4,4,true,false,87
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.4.01.005','5.4.01','Obras Menores, Cerrajería y Vidriería','movimiento','gasto','Gastos de Reparación Ordinaria',
 'deudora','perdida','gastos_administracion',5,4,true,false,88
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.4.01.099','5.4.01','Otros Gastos de Reparación','movimiento','gasto','Gastos de Reparación Ordinaria',
 'deudora','perdida','gastos_administracion',99,4,true,false,89
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.5.01.001','5.5.01','Proyectos de Inversión y Mejoras','movimiento','gasto','Gastos Extraordinarios y Nuevas Obras',
 'deudora','perdida','gastos_administracion',1,4,true,false,90
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.5.01.002','5.5.01','Nuevas Adquisiciones y Equipamiento','movimiento','gasto','Gastos Extraordinarios y Nuevas Obras',
 'deudora','perdida','gastos_administracion',2,4,true,false,91
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.5.01.003','5.5.01','Reparaciones Mayores por Emergencia','movimiento','gasto','Gastos Extraordinarios y Nuevas Obras',
 'deudora','perdida','gastos_administracion',3,4,true,false,92
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_ESTANDAR'),
 '5.5.01.099','5.5.01','Otros Gastos Extraordinarios','movimiento','gasto','Gastos Extraordinarios y Nuevas Obras',
 'deudora','perdida','gastos_administracion',99,4,true,false,93
);

insert into public.contabilidad_plan_plantillas(codigo,nombre,naturaleza,origen,activa)
values('COMUNIDAD_COMPLEJO','Comunidad - Complejo / Macro-condominio','comunidad','sistema',true)
on conflict(codigo) do update set nombre=excluded.nombre,naturaleza=excluded.naturaleza,activa=true,editado_en=now();

delete from public.contabilidad_plan_plantilla_cuentas
where plantilla_id=(select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO');
insert into public.contabilidad_plan_plantilla_cuentas(
  plantilla_id,codigo,parent_codigo,cuenta,clase,tipo_contable,grupo,naturaleza,
  clasificacion_balance,eerr_seccion,eerr_orden,nivel,imputable,requiere_centro_costo,orden
) values
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '1',null,'ACTIVOS','titulo','activo','ACTIVOS',
 'deudora','activo',null,null,1,false,false,1
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '2',null,'PASIVOS','titulo','pasivo','PASIVOS',
 'acreedora','pasivo',null,null,1,false,false,2
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '3',null,'PATRIMONIO / FONDOS PROPIOS','titulo','patrimonio','PATRIMONIO / FONDOS PROPIOS',
 'acreedora','pasivo',null,null,1,false,false,3
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '4',null,'INGRESOS','titulo','ingreso','INGRESOS',
 'acreedora','ganancia','resultado_no_operacional',null,1,false,false,4
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5',null,'EGRESOS / GASTOS COMUNES','titulo','gasto','EGRESOS / GASTOS COMUNES',
 'deudora','perdida','gastos_administracion',null,1,false,false,5
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '1.1','1','Activos Circulantes / Disponibilidades','titulo','activo','Activos Circulantes / Disponibilidades',
 'deudora','activo',null,null,2,false,false,6
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '1.2','1','Cuentas por Cobrar','titulo','activo','Cuentas por Cobrar',
 'deudora','activo',null,null,2,false,false,7
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '2.1','2','Pasivos Circulantes / Obligaciones a Corto Plazo','titulo','pasivo','Pasivos Circulantes / Obligaciones a Corto Plazo',
 'acreedora','pasivo',null,null,2,false,false,8
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '2.2','2','Fondos de la Copropiedad','titulo','pasivo','Fondos de la Copropiedad',
 'acreedora','pasivo',null,null,2,false,false,9
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '3.1','3','Patrimonio Neto','titulo','patrimonio','Patrimonio Neto',
 'acreedora','pasivo',null,null,2,false,false,10
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '4.1','4','Ingresos Ordinarios','titulo','ingreso','Ingresos Ordinarios',
 'acreedora','ganancia','resultado_no_operacional',null,2,false,false,11
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '4.2','4','Ingresos Extraordinarios y Otros','titulo','ingreso','Ingresos Extraordinarios y Otros',
 'acreedora','ganancia','resultado_no_operacional',null,2,false,false,12
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.1','5','Gastos de Administración','titulo','gasto','Gastos de Administración',
 'deudora','perdida','gastos_administracion',null,2,false,false,13
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.2','5','Gastos de Mantención Ordinaria','titulo','gasto','Gastos de Mantención Ordinaria',
 'deudora','perdida','gastos_administracion',null,2,false,false,14
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.3','5','Consumos de la Comunidad','titulo','gasto','Consumos de la Comunidad',
 'deudora','perdida','gastos_administracion',null,2,false,false,15
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.4','5','Gastos de Reparación Ordinaria','titulo','gasto','Gastos de Reparación Ordinaria',
 'deudora','perdida','gastos_administracion',null,2,false,false,16
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.5','5','Gastos Extraordinarios y Nuevas Obras','titulo','gasto','Gastos Extraordinarios y Nuevas Obras',
 'deudora','perdida','gastos_administracion',null,2,false,false,17
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '1.1.01','1.1','Disponibilidades','titulo','activo','Activos Circulantes / Disponibilidades',
 'deudora','activo',null,null,3,false,false,18
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '1.2.01','1.2','Cuentas por Cobrar','titulo','activo','Cuentas por Cobrar',
 'deudora','activo',null,null,3,false,false,19
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '2.1.01','2.1','Obligaciones a Corto Plazo','titulo','pasivo','Pasivos Circulantes / Obligaciones a Corto Plazo',
 'acreedora','pasivo',null,null,3,false,false,20
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '2.2.02','2.2','Fondos de la Copropiedad','titulo','pasivo','Fondos de la Copropiedad',
 'acreedora','pasivo',null,null,3,false,false,21
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '3.1.01','3.1','Patrimonio Neto','titulo','patrimonio','Patrimonio Neto',
 'acreedora','pasivo',null,null,3,false,false,22
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '4.1.01','4.1','Ingresos Ordinarios','titulo','ingreso','Ingresos Ordinarios',
 'acreedora','ganancia','ingresos_operacionales',null,3,false,false,23
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '4.2.01','4.2','Ingresos Extraordinarios y Otros','titulo','ingreso','Ingresos Extraordinarios y Otros',
 'acreedora','ganancia','resultado_no_operacional',null,3,false,false,24
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.1.01','5.1','Gastos de Administración','titulo','gasto','Gastos de Administración',
 'deudora','perdida','gastos_administracion',null,3,false,false,25
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.2.01','5.2','Gastos de Mantención Ordinaria','titulo','gasto','Gastos de Mantención Ordinaria',
 'deudora','perdida','gastos_administracion',null,3,false,false,26
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.3.01','5.3','Consumos de la Comunidad','titulo','gasto','Consumos de la Comunidad',
 'deudora','perdida','gastos_administracion',null,3,false,false,27
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.4.01','5.4','Gastos de Reparación Ordinaria','titulo','gasto','Gastos de Reparación Ordinaria',
 'deudora','perdida','gastos_administracion',null,3,false,false,28
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.5.01','5.5','Gastos Extraordinarios y Nuevas Obras','titulo','gasto','Gastos Extraordinarios y Nuevas Obras',
 'deudora','perdida','gastos_administracion',null,3,false,false,29
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '2.2.02.001','2.2.02','Fondo de Reserva Acumulado','titulo','pasivo','Fondos de la Copropiedad',
 'acreedora','pasivo',null,null,4,false,false,30
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '1.1.01.001','1.1.01','Caja Chica Administración General','movimiento','activo','Activos Circulantes / Disponibilidades',
 'deudora','activo',null,1,4,true,false,31
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '1.1.01.002','1.1.01','Caja Chica Recepción / Conserjería','movimiento','activo','Activos Circulantes / Disponibilidades',
 'deudora','activo',null,2,4,true,false,32
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '1.1.01.003','1.1.01','Banco Principal - Cuenta Corriente Operacional','movimiento','activo','Activos Circulantes / Disponibilidades',
 'deudora','activo',null,3,4,true,false,33
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '1.1.01.004','1.1.01','Banco - Cuenta Fondo de Reserva','movimiento','activo','Activos Circulantes / Disponibilidades',
 'deudora','activo',null,4,4,true,false,34
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '1.1.01.005','1.1.01','Banco - Cuenta Fondos de Contingencia / Seguros','movimiento','activo','Activos Circulantes / Disponibilidades',
 'deudora','activo',null,5,4,true,false,35
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '1.2.01.001','1.2.01','Gastos Comunes por Cobrar','movimiento','activo','Cuentas por Cobrar',
 'deudora','activo',null,1,4,true,false,36
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '1.2.01.002','1.2.01','Multas e Intereses por Cobrar','movimiento','activo','Cuentas por Cobrar',
 'deudora','activo',null,2,4,true,false,37
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '1.2.01.003','1.2.01','Convenios de Pago por Cobrar','movimiento','activo','Cuentas por Cobrar',
 'deudora','activo',null,3,4,true,false,38
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '1.2.01.004','1.2.01','Cobros por Uso de Espacios Comunes','movimiento','activo','Cuentas por Cobrar',
 'deudora','activo',null,4,4,true,false,39
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '1.2.01.005','1.2.01','Consumos Individuales por Cobrar','movimiento','activo','Cuentas por Cobrar',
 'deudora','activo',null,5,4,true,false,40
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '1.2.01.006','1.2.01','Deudas por Concesiones y Locales Internos','movimiento','activo','Cuentas por Cobrar',
 'deudora','activo',null,6,4,true,false,41
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '1.2.01.099','1.2.01','Otros Cobros por Recuperar','movimiento','activo','Cuentas por Cobrar',
 'deudora','activo',null,99,4,true,false,42
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '2.1.01.001','2.1.01','Proveedores de Servicios Básicos','movimiento','pasivo','Pasivos Circulantes / Obligaciones a Corto Plazo',
 'acreedora','pasivo',null,1,4,true,false,43
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '2.1.01.002','2.1.01','Contratistas de Mantenimiento Tecnomecánico','movimiento','pasivo','Pasivos Circulantes / Obligaciones a Corto Plazo',
 'acreedora','pasivo',null,2,4,true,false,44
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '2.1.01.003','2.1.01','Empresas de Seguridad y Vigilancia Externa','movimiento','pasivo','Pasivos Circulantes / Obligaciones a Corto Plazo',
 'acreedora','pasivo',null,3,4,true,false,45
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '2.1.01.004','2.1.01','Remuneraciones por Pagar','movimiento','pasivo','Pasivos Circulantes / Obligaciones a Corto Plazo',
 'acreedora','pasivo',null,4,4,true,false,46
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '2.1.01.005','2.1.01','Retenciones de Impuestos','movimiento','pasivo','Pasivos Circulantes / Obligaciones a Corto Plazo',
 'acreedora','pasivo',null,5,4,true,false,47
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '2.1.01.006','2.1.01','Leyes Sociales por Pagar','movimiento','pasivo','Pasivos Circulantes / Obligaciones a Corto Plazo',
 'acreedora','pasivo',null,6,4,true,false,48
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '2.1.01.007','2.1.01','Seguros de Espacios Comunes por Pagar','movimiento','pasivo','Pasivos Circulantes / Obligaciones a Corto Plazo',
 'acreedora','pasivo',null,7,4,true,false,49
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '2.1.01.099','2.1.01','Otros Acreedores / Cuentas por Pagar','movimiento','pasivo','Pasivos Circulantes / Obligaciones a Corto Plazo',
 'acreedora','pasivo',null,99,4,true,false,50
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '2.2.02.001.001','2.2.02.001','F.R. - Recaudación Gasto Común Ordinario','movimiento','pasivo','Fondos de la Copropiedad',
 'acreedora','pasivo',null,1,5,true,false,51
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '2.2.02.001.002','2.2.02.001','F.R. - Intereses por Morosidad Capitalizados','movimiento','pasivo','Fondos de la Copropiedad',
 'acreedora','pasivo',null,2,5,true,false,52
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '2.2.02.001.003','2.2.02.001','F.R. - Multas por Infracciones','movimiento','pasivo','Fondos de la Copropiedad',
 'acreedora','pasivo',null,3,5,true,false,53
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '2.2.02.001.004','2.2.02.001','F.R. - Arriendo de Espacios Comunes','movimiento','pasivo','Fondos de la Copropiedad',
 'acreedora','pasivo',null,4,5,true,false,54
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '2.2.02.001.005','2.2.02.001','F.R. - Explotación de Concesiones e Inmuebles','movimiento','pasivo','Fondos de la Copropiedad',
 'acreedora','pasivo',null,5,5,true,false,55
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '2.2.02.001.099','2.2.02.001','F.R. - Otros Aportes al Fondo','movimiento','pasivo','Fondos de la Copropiedad',
 'acreedora','pasivo',null,99,5,true,false,56
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '2.2.02.002','2.2.02','Fondos de Garantía de Proveedores / Contratistas','movimiento','pasivo','Fondos de la Copropiedad',
 'acreedora','pasivo',null,2,4,true,false,57
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '2.2.02.003','2.2.02','Recaudaciones Anticipadas de Copropietarios','movimiento','pasivo','Fondos de la Copropiedad',
 'acreedora','pasivo',null,3,4,true,false,58
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '3.1.01.001','3.1.01','Fondo Inicial de Operación','movimiento','patrimonio','Patrimonio Neto',
 'acreedora','pasivo',null,1,4,true,false,59
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '3.1.01.002','3.1.01','Superávit / Déficit de Ejercicios Anteriores','movimiento','patrimonio','Patrimonio Neto',
 'acreedora','pasivo',null,2,4,true,false,60
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '3.1.01.003','3.1.01','Resultado del Ejercicio Actual','movimiento','patrimonio','Patrimonio Neto',
 'acreedora','pasivo',null,3,4,true,false,61
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '4.1.01.001','4.1.01','Recaudación Gasto Común Ordinario','movimiento','ingreso','Ingresos Ordinarios',
 'acreedora','ganancia','ingresos_operacionales',1,4,true,false,62
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '4.1.01.002','4.1.01','Recaudación para Fondo de Reserva','movimiento','ingreso','Ingresos Ordinarios',
 'acreedora','ganancia','ingresos_operacionales',2,4,true,false,63
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '4.2.01.001','4.2.01','Intereses por Morosidad','movimiento','ingreso','Ingresos Extraordinarios y Otros',
 'acreedora','ganancia','resultado_no_operacional',1,4,true,false,64
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '4.2.01.002','4.2.01','Multas por Infracciones al Reglamento de Copropiedad','movimiento','ingreso','Ingresos Extraordinarios y Otros',
 'acreedora','ganancia','resultado_no_operacional',2,4,true,false,65
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '4.2.01.003','4.2.01','Arriendo de Espacios Comunes y Quinchos','movimiento','ingreso','Ingresos Extraordinarios y Otros',
 'acreedora','ganancia','resultado_no_operacional',3,4,true,false,66
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '4.2.01.004','4.2.01','Ingresos por Concesiones, Lavandería y Cafetería','movimiento','ingreso','Ingresos Extraordinarios y Otros',
 'acreedora','ganancia','resultado_no_operacional',4,4,true,false,67
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '4.2.01.005','4.2.01','Ingresos por Publicidad y Antenas','movimiento','ingreso','Ingresos Extraordinarios y Otros',
 'acreedora','ganancia','resultado_no_operacional',5,4,true,false,68
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '4.2.01.099','4.2.01','Otros Ingresos No Operacionales','movimiento','ingreso','Ingresos Extraordinarios y Otros',
 'acreedora','ganancia','resultado_no_operacional',99,4,true,false,69
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.1.01.001','5.1.01','Honorarios de Administración General','movimiento','gasto','Gastos de Administración',
 'deudora','perdida','gastos_administracion',1,4,true,false,70
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.1.01.002','5.1.01','Sueldos Jefaturas, Supervisores y Administradores Residentes','movimiento','gasto','Gastos de Administración',
 'deudora','perdida','gastos_administracion',2,4,true,false,71
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.1.01.003','5.1.01','Sueldos Conserjes, Guardias y Personal de Planta','movimiento','gasto','Gastos de Administración',
 'deudora','perdida','gastos_administracion',3,4,true,false,72
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.1.01.004','5.1.01','Horas Extraordinarias, Reemplazos y Turnos de Contingencia','movimiento','gasto','Gastos de Administración',
 'deudora','perdida','gastos_administracion',4,4,true,false,73
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.1.01.005','5.1.01','Leyes Sociales y Mutual de Seguridad','movimiento','gasto','Gastos de Administración',
 'deudora','perdida','gastos_administracion',5,4,true,false,74
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.1.01.006','5.1.01','Software de Administración, Gastos Web y Licencias','movimiento','gasto','Gastos de Administración',
 'deudora','perdida','gastos_administracion',6,4,true,false,75
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.1.01.007','5.1.01','Artículos de Oficina, Impresiones y Despacho','movimiento','gasto','Gastos de Administración',
 'deudora','perdida','gastos_administracion',7,4,true,false,76
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.1.01.008','5.1.01','Gastos Legales, Auditorías Externas y Asesorías','movimiento','gasto','Gastos de Administración',
 'deudora','perdida','gastos_administracion',8,4,true,false,77
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.1.01.009','5.1.01','Indemnizaciones Laborales / Finiquitos Ordinarios','movimiento','gasto','Gastos de Administración',
 'deudora','perdida','gastos_administracion',9,4,true,false,78
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.1.01.099','5.1.01','Otros Gastos de Administración','movimiento','gasto','Gastos de Administración',
 'deudora','perdida','gastos_administracion',99,4,true,false,79
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.2.01.001','5.2.01','Mantención de Ascensores, Escaleras Mecánicas y Montacargas','movimiento','gasto','Gastos de Mantención Ordinaria',
 'deudora','perdida','gastos_administracion',1,4,true,false,80
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.2.01.002','5.2.01','Mantención de Bombas de Agua, Calderas y Centrales Térmicas','movimiento','gasto','Gastos de Mantención Ordinaria',
 'deudora','perdida','gastos_administracion',2,4,true,false,81
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.2.01.003','5.2.01','Mantención de Portones, Barreras de Acceso y Citofonía','movimiento','gasto','Gastos de Mantención Ordinaria',
 'deudora','perdida','gastos_administracion',3,4,true,false,82
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.2.01.004','5.2.01','Mantención de Sistemas de Seguridad, CCTV y Alarmas','movimiento','gasto','Gastos de Mantención Ordinaria',
 'deudora','perdida','gastos_administracion',4,4,true,false,83
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.2.01.005','5.2.01','Servicio Externo de Seguridad, Conserjería o Vigilancia Privada','movimiento','gasto','Gastos de Mantención Ordinaria',
 'deudora','perdida','gastos_administracion',5,4,true,false,84
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.2.01.006','5.2.01','Mantención, Químicos e Insumos de Piscinas y Spas','movimiento','gasto','Gastos de Mantención Ordinaria',
 'deudora','perdida','gastos_administracion',6,4,true,false,85
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.2.01.007','5.2.01','Mantención de Áreas Verdes, Paisajismo y Sistemas de Riego','movimiento','gasto','Gastos de Mantención Ordinaria',
 'deudora','perdida','gastos_administracion',7,4,true,false,86
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.2.01.008','5.2.01','Mantención de Grupos Electrógenos y Subestaciones Eléctricas','movimiento','gasto','Gastos de Mantención Ordinaria',
 'deudora','perdida','gastos_administracion',8,4,true,false,87
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.2.01.009','5.2.01','Mantención de Sistemas de Ventilación y Extracción Forzada','movimiento','gasto','Gastos de Mantención Ordinaria',
 'deudora','perdida','gastos_administracion',9,4,true,false,88
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.2.01.010','5.2.01','Certificaciones Obligatorias y Sellos de Seguridad','movimiento','gasto','Gastos de Mantención Ordinaria',
 'deudora','perdida','gastos_administracion',10,4,true,false,89
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.2.01.011','5.2.01','Insumos de Aseo, Sanitización y Control de Plagas','movimiento','gasto','Gastos de Mantención Ordinaria',
 'deudora','perdida','gastos_administracion',11,4,true,false,90
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.2.01.012','5.2.01','Primas de Seguros contra Incendio, Sismo y Responsabilidad Civil','movimiento','gasto','Gastos de Mantención Ordinaria',
 'deudora','perdida','gastos_administracion',12,4,true,false,91
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.2.01.099','5.2.01','Otros Gastos de Mantención','movimiento','gasto','Gastos de Mantención Ordinaria',
 'deudora','perdida','gastos_administracion',99,4,true,false,92
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.3.01.001','5.3.01','Consumo de Electricidad Espacios Comunes','movimiento','gasto','Consumos de la Comunidad',
 'deudora','perdida','gastos_administracion',1,4,true,false,93
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.3.01.002','5.3.01','Consumo de Electricidad Climatización e Iluminación Perimetral','movimiento','gasto','Consumos de la Comunidad',
 'deudora','perdida','gastos_administracion',2,4,true,false,94
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.3.01.003','5.3.01','Consumo de Agua Potable Espacios Comunes y Riego','movimiento','gasto','Consumos de la Comunidad',
 'deudora','perdida','gastos_administracion',3,4,true,false,95
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.3.01.004','5.3.01','Consumo de Gas Combustible para Calderas y Calefacción Central','movimiento','gasto','Consumos de la Comunidad',
 'deudora','perdida','gastos_administracion',4,4,true,false,96
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.3.01.099','5.3.01','Otros Consumos de la Comunidad','movimiento','gasto','Consumos de la Comunidad',
 'deudora','perdida','gastos_administracion',99,4,true,false,97
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.4.01.001','5.4.01','Reparación de Ascensores, Escaleras Mecánicas y Montacargas','movimiento','gasto','Gastos de Reparación Ordinaria',
 'deudora','perdida','gastos_administracion',1,4,true,false,98
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.4.01.002','5.4.01','Reparación de Bombas de Agua, Calderas y Centrales Térmicas','movimiento','gasto','Gastos de Reparación Ordinaria',
 'deudora','perdida','gastos_administracion',2,4,true,false,99
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.4.01.003','5.4.01','Reparación de Portones, Barreras de Acceso y Citofonía','movimiento','gasto','Gastos de Reparación Ordinaria',
 'deudora','perdida','gastos_administracion',3,4,true,false,100
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.4.01.004','5.4.01','Reparación de Sistemas de Seguridad, CCTV y Alarmas','movimiento','gasto','Gastos de Reparación Ordinaria',
 'deudora','perdida','gastos_administracion',4,4,true,false,101
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.4.01.005','5.4.01','Reparaciones Eléctricas, Grupos Electrógenos e Iluminación','movimiento','gasto','Gastos de Reparación Ordinaria',
 'deudora','perdida','gastos_administracion',5,4,true,false,102
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.4.01.006','5.4.01','Reparaciones de Piscinas, Equipos de Filtrado y Climatización','movimiento','gasto','Gastos de Reparación Ordinaria',
 'deudora','perdida','gastos_administracion',6,4,true,false,103
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.4.01.007','5.4.01','Reparaciones de Redes Hidráulicas, Gasfitería y Alcantarillado','movimiento','gasto','Gastos de Reparación Ordinaria',
 'deudora','perdida','gastos_administracion',7,4,true,false,104
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.4.01.008','5.4.01','Obras Menores, Cerrajería, Pintura y Vidriería de Espacios Comunes','movimiento','gasto','Gastos de Reparación Ordinaria',
 'deudora','perdida','gastos_administracion',8,4,true,false,105
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.4.01.099','5.4.01','Otros Gastos de Reparación','movimiento','gasto','Gastos de Reparación Ordinaria',
 'deudora','perdida','gastos_administracion',99,4,true,false,106
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.5.01.001','5.5.01','Proyectos de Inversión, Remodelaciones y Mejoras Estructurales','movimiento','gasto','Gastos Extraordinarios y Nuevas Obras',
 'deudora','perdida','gastos_administracion',1,4,true,false,107
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.5.01.002','5.5.01','Nuevas Adquisiciones, Mobiliario de Áreas Comunes y Equipamiento','movimiento','gasto','Gastos Extraordinarios y Nuevas Obras',
 'deudora','perdida','gastos_administracion',2,4,true,false,108
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.5.01.003','5.5.01','Reparaciones Mayores por Emergencia','movimiento','gasto','Gastos Extraordinarios y Nuevas Obras',
 'deudora','perdida','gastos_administracion',3,4,true,false,109
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='COMUNIDAD_COMPLEJO'),
 '5.5.01.099','5.5.01','Otros Gastos Extraordinarios','movimiento','gasto','Gastos Extraordinarios y Nuevas Obras',
 'deudora','perdida','gastos_administracion',99,4,true,false,110
);

insert into public.contabilidad_plan_plantillas(codigo,nombre,naturaleza,origen,activa)
values('EMPRESA_ADMINISTRACION','Empresa de Administración','empresa','sistema',true)
on conflict(codigo) do update set nombre=excluded.nombre,naturaleza=excluded.naturaleza,activa=true,editado_en=now();

delete from public.contabilidad_plan_plantilla_cuentas
where plantilla_id=(select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION');
insert into public.contabilidad_plan_plantilla_cuentas(
  plantilla_id,codigo,parent_codigo,cuenta,clase,tipo_contable,grupo,naturaleza,
  clasificacion_balance,eerr_seccion,eerr_orden,nivel,imputable,requiere_centro_costo,orden
) values
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '1',null,'ACTIVOS','titulo','activo','ACTIVOS',
 'deudora','activo',null,null,1,false,false,1
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '2',null,'PASIVOS','titulo','pasivo','PASIVOS',
 'acreedora','pasivo',null,null,1,false,false,2
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '3',null,'PATRIMONIO','titulo','patrimonio','PATRIMONIO',
 'acreedora','pasivo',null,null,1,false,false,3
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '4',null,'INGRESOS','titulo','ingreso','INGRESOS',
 'acreedora','ganancia','resultado_no_operacional',null,1,false,false,4
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '5',null,'EGRESOS / GASTOS','titulo','gasto','EGRESOS / GASTOS',
 'deudora','perdida',null,null,1,false,false,5
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '1.1','1','Activos Corrientes','titulo','activo','Activos Corrientes',
 'deudora','activo',null,null,2,false,false,6
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '1.2','1','Activos no Corrientes','titulo','activo','Activos no Corrientes',
 'deudora','activo',null,null,2,false,false,7
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '2.1','2','Pasivos Corrientes','titulo','pasivo','Pasivos Corrientes',
 'acreedora','pasivo',null,null,2,false,false,8
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '2.2','2','Pasivos No Corrientes','titulo','pasivo','Pasivos No Corrientes',
 'acreedora','pasivo',null,null,2,false,false,9
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '3.1','3','Patrimonio Neto','titulo','patrimonio','Patrimonio Neto',
 'acreedora','pasivo',null,null,2,false,false,10
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '4.1','4','Ingresos Operacionales','titulo','ingreso','Ingresos Operacionales',
 'acreedora','ganancia','resultado_no_operacional',null,2,false,false,11
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '4.2','4','Resultado No Operacional (Ingresos)','titulo','ingreso','Resultado No Operacional (Ingresos)',
 'acreedora','ganancia','resultado_no_operacional',null,2,false,false,12
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '5.1','5','Costos de Prestación de Servicios (Costos Directos)','titulo','gasto','Costos de Prestación de Servicios (Costos Directos)',
 'deudora','perdida',null,null,2,false,false,13
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '5.2','5','Gastos de Administración y Ventas (GAV / Costos Fijos)','titulo','gasto','Gastos de Administración y Ventas (GAV / Costos Fijos)',
 'deudora','perdida',null,null,2,false,false,14
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '5.3','5','Resultado No Operacional (Egresos)','titulo','gasto','Resultado No Operacional (Egresos)',
 'deudora','perdida',null,null,2,false,false,15
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '5.4','5','Impuesto a la Renta','titulo','gasto','Impuesto a la Renta',
 'deudora','perdida',null,null,2,false,false,16
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '1.1.01','1.1','Activos Corrientes','titulo','activo','Activos Corrientes',
 'deudora','activo',null,null,3,false,false,17
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '1.2.01','1.2','Activos no Corrientes','titulo','activo','Activos no Corrientes',
 'deudora','activo',null,null,3,false,false,18
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '2.1.01','2.1','Pasivos Corrientes','titulo','pasivo','Pasivos Corrientes',
 'acreedora','pasivo',null,null,3,false,false,19
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '2.2.01','2.2','Pasivos No Corrientes','titulo','pasivo','Pasivos No Corrientes',
 'acreedora','pasivo',null,null,3,false,false,20
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '3.1.01','3.1','Capital suscrito','titulo','patrimonio','Patrimonio Neto',
 'acreedora','pasivo',null,null,3,false,false,21
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '3.1.02','3.1','Capital pagado','titulo','patrimonio','Patrimonio Neto',
 'acreedora','pasivo',null,null,3,false,false,22
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '3.1.03','3.1','Resultados acumulados','titulo','patrimonio','Patrimonio Neto',
 'acreedora','pasivo',null,null,3,false,false,23
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '3.1.04','3.1','Resultado ejercicio','titulo','patrimonio','Patrimonio Neto',
 'acreedora','pasivo',null,null,3,false,false,24
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '3.1.05','3.1','Retiros provisorios','titulo','patrimonio','Patrimonio Neto',
 'acreedora','pasivo',null,null,3,false,false,25
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '3.1.06','3.1','Dividendos años anteriores','titulo','patrimonio','Patrimonio Neto',
 'acreedora','pasivo',null,null,3,false,false,26
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '4.1.01','4.1','Ingresos administración y servicios','titulo','ingreso','Ingresos Operacionales',
 'acreedora','ganancia','ingresos_operacionales',null,3,false,false,27
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '4.1.02','4.1','Ingresos por corretajes o traspasos','titulo','ingreso','Ingresos Operacionales',
 'acreedora','ganancia','ingresos_operacionales',null,3,false,false,28
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '4.2.01','4.2','Resultado No Operacional (Ingresos)','titulo','ingreso','Resultado No Operacional (Ingresos)',
 'acreedora','ganancia','resultado_no_operacional',null,3,false,false,29
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '5.1.01','5.1','Costos de Prestación de Servicios','titulo','costo','Costos de Prestación de Servicios (Costos Directos)',
 'deudora','perdida','costos_prestacion',null,3,false,false,30
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '5.2.01','5.2','Gastos de Administración y Ventas','titulo','gasto','Gastos de Administración y Ventas (GAV / Costos Fijos)',
 'deudora','perdida','gastos_administracion',null,3,false,false,31
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '5.3.01','5.3','Resultado No Operacional (Egresos)','titulo','gasto','Resultado No Operacional (Egresos)',
 'deudora','perdida','resultado_no_operacional',null,3,false,false,32
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '5.4.01','5.4','Impuesto a la Renta','titulo','impuesto','Impuesto a la Renta',
 'deudora','perdida','impuesto_renta',null,3,false,false,33
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '1.1.01.001','1.1.01','Caja','movimiento','activo','Activos Corrientes',
 'deudora','activo',null,1,4,true,false,34
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '1.1.01.002','1.1.01','Banco','movimiento','activo','Activos Corrientes',
 'deudora','activo',null,2,4,true,false,35
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '1.1.01.003','1.1.01','Clientes por cobrar','movimiento','activo','Activos Corrientes',
 'deudora','activo',null,3,4,true,false,36
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '1.1.01.004','1.1.01','IVA crédito fiscal','movimiento','activo','Activos Corrientes',
 'deudora','activo',null,4,4,true,false,37
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '1.1.01.005','1.1.01','PPM por Recuperar','movimiento','activo','Activos Corrientes',
 'deudora','activo',null,5,4,true,false,38
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '1.1.01.006','1.1.01','Remanente IVA crédito Fiscal','movimiento','activo','Activos Corrientes',
 'deudora','activo',null,6,4,true,false,39
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '1.1.01.007','1.1.01','Anticipos Proveedores','movimiento','activo','Activos Corrientes',
 'deudora','activo',null,7,4,true,false,40
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '1.1.01.008','1.1.01','Anticipos Remuneraciones','movimiento','activo','Activos Corrientes',
 'deudora','activo',null,8,4,true,false,41
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '1.1.01.099','1.1.01','Otros Activos Corrientes','movimiento','activo','Activos Corrientes',
 'deudora','activo',null,99,4,true,false,42
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '1.2.01.001','1.2.01','Equipos de Oficina','movimiento','activo','Activos no Corrientes',
 'deudora','activo',null,1,4,true,false,43
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '1.2.01.002','1.2.01','Vehículos','movimiento','activo','Activos no Corrientes',
 'deudora','activo',null,2,4,true,false,44
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '1.2.01.003','1.2.01','Muebles y Útiles','movimiento','activo','Activos no Corrientes',
 'deudora','activo',null,3,4,true,false,45
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '1.2.01.004','1.2.01','Capital por enterar','movimiento','activo','Activos no Corrientes',
 'deudora','activo',null,4,4,true,false,46
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '1.2.01.005','1.2.01','Cta cte socio Francisco deudora','movimiento','activo','Activos no Corrientes',
 'deudora','activo',null,5,4,true,false,47
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '1.2.01.006','1.2.01','Cta cte socio Osmar deudora','movimiento','activo','Activos no Corrientes',
 'deudora','activo',null,6,4,true,false,48
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '1.2.01.007','1.2.01','Depreciación Acumulada','movimiento','activo','Activos no Corrientes',
 'acreedora','activo',null,7,4,true,false,49
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '1.2.01.099','1.2.01','Otros Activos No Corrientes','movimiento','activo','Activos no Corrientes',
 'deudora','activo',null,99,4,true,false,50
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '2.1.01.001','2.1.01','Obligaciones con Bancos','movimiento','pasivo','Pasivos Corrientes',
 'acreedora','pasivo',null,1,4,true,false,51
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '2.1.01.002','2.1.01','Proveedores','movimiento','pasivo','Pasivos Corrientes',
 'acreedora','pasivo',null,2,4,true,false,52
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '2.1.01.003','2.1.01','IVA débito fiscal','movimiento','pasivo','Pasivos Corrientes',
 'acreedora','pasivo',null,3,4,true,false,53
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '2.1.01.004','2.1.01','Retenciones por pagar','movimiento','pasivo','Pasivos Corrientes',
 'acreedora','pasivo',null,4,4,true,false,54
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '2.1.01.005','2.1.01','Impuesto único por pagar','movimiento','pasivo','Pasivos Corrientes',
 'acreedora','pasivo',null,5,4,true,false,55
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '2.1.01.006','2.1.01','Impuesto a la Renta por pagar','movimiento','pasivo','Pasivos Corrientes',
 'acreedora','pasivo',null,6,4,true,false,56
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '2.1.01.007','2.1.01','Cotizaciones Previsionales por pagar','movimiento','pasivo','Pasivos Corrientes',
 'acreedora','pasivo',null,7,4,true,false,57
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '2.1.01.008','2.1.01','Remuneraciones por Pagar','movimiento','pasivo','Pasivos Corrientes',
 'acreedora','pasivo',null,8,4,true,false,58
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '2.1.01.009','2.1.01','Provisiones','movimiento','pasivo','Pasivos Corrientes',
 'acreedora','pasivo',null,9,4,true,false,59
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '2.1.01.010','2.1.01','Dividendos por pagar','movimiento','pasivo','Pasivos Corrientes',
 'acreedora','pasivo',null,10,4,true,false,60
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '2.1.01.011','2.1.01','Cta cte socio Francisco acreedora','movimiento','pasivo','Pasivos Corrientes',
 'acreedora','pasivo',null,11,4,true,false,61
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '2.1.01.012','2.1.01','Cta cte socio Osmar acreedora','movimiento','pasivo','Pasivos Corrientes',
 'acreedora','pasivo',null,12,4,true,false,62
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '2.1.01.099','2.1.01','Otros Pasivos Corrientes','movimiento','pasivo','Pasivos Corrientes',
 'acreedora','pasivo',null,99,4,true,false,63
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '2.2.01.001','2.2.01','Obligaciones con Bancos L/P','movimiento','pasivo','Pasivos No Corrientes',
 'acreedora','pasivo',null,1,4,true,false,64
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '2.2.01.002','2.2.01','Leasing','movimiento','pasivo','Pasivos No Corrientes',
 'acreedora','pasivo',null,2,4,true,false,65
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '2.2.01.099','2.2.01','Otros Pasivos No Corrientes','movimiento','pasivo','Pasivos No Corrientes',
 'acreedora','pasivo',null,99,4,true,false,66
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '3.1.01.001','3.1.01','Capital suscrito','movimiento','patrimonio','Patrimonio Neto',
 'acreedora','pasivo',null,1,4,true,false,67
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '3.1.02.001','3.1.02','Capital pagado','movimiento','patrimonio','Patrimonio Neto',
 'acreedora','pasivo',null,1,4,true,false,68
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '3.1.03.001','3.1.03','Resultados acumulados','movimiento','patrimonio','Patrimonio Neto',
 'acreedora','pasivo',null,1,4,true,false,69
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '3.1.04.001','3.1.04','Resultado ejercicio','movimiento','patrimonio','Patrimonio Neto',
 'acreedora','pasivo',null,1,4,true,false,70
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '3.1.05.001','3.1.05','Retiros provisorios','movimiento','patrimonio','Patrimonio Neto',
 'acreedora','pasivo',null,1,4,true,false,71
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '3.1.06.001','3.1.06','Dividendos años anteriores','movimiento','patrimonio','Patrimonio Neto',
 'acreedora','pasivo',null,1,4,true,false,72
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '4.1.01.001','4.1.01','Ingresos administración','movimiento','ingreso','Ingresos Operacionales',
 'acreedora','ganancia','ingresos_operacionales',1,4,true,false,73
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '4.1.01.002','4.1.01','Subcontrataciones de servicios o asesorías','movimiento','ingreso','Ingresos Operacionales',
 'acreedora','ganancia','ingresos_operacionales',2,4,true,false,74
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '4.1.02.001','4.1.02','Ingresos por corretajes o traspasos externos','movimiento','ingreso','Ingresos Operacionales',
 'acreedora','ganancia','ingresos_operacionales',1,4,true,false,75
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '4.2.01.001','4.2.01','Ingresos extraordinarios','movimiento','ingreso','Resultado No Operacional (Ingresos)',
 'acreedora','ganancia','resultado_no_operacional',1,4,true,false,76
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '4.2.01.002','4.2.01','Intereses ganados','movimiento','ingreso','Resultado No Operacional (Ingresos)',
 'acreedora','ganancia','resultado_no_operacional',2,4,true,false,77
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '4.2.01.099','4.2.01','Otros Ingresos No Operacionales','movimiento','ingreso','Resultado No Operacional (Ingresos)',
 'acreedora','ganancia','resultado_no_operacional',99,4,true,false,78
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '5.1.01.001','5.1.01','Remuneraciones Operacionales','movimiento','costo','Costos de Prestación de Servicios (Costos Directos)',
 'deudora','perdida','costos_prestacion',1,4,true,false,79
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '5.1.01.002','5.1.01','Publicidad/Marketing','movimiento','costo','Costos de Prestación de Servicios (Costos Directos)',
 'deudora','perdida','costos_prestacion',2,4,true,false,80
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '5.1.01.099','5.1.01','Otros Costos Directos','movimiento','costo','Costos de Prestación de Servicios (Costos Directos)',
 'deudora','perdida','costos_prestacion',99,4,true,false,81
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '5.2.01.001','5.2.01','Remuneraciones Administrativas','movimiento','gasto','Gastos de Administración y Ventas (GAV / Costos Fijos)',
 'deudora','perdida','gastos_administracion',1,4,true,false,82
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '5.2.01.002','5.2.01','Software y Herramientas TI','movimiento','gasto','Gastos de Administración y Ventas (GAV / Costos Fijos)',
 'deudora','perdida','gastos_administracion',2,4,true,false,83
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '5.2.01.003','5.2.01','Servicios básicos','movimiento','gasto','Gastos de Administración y Ventas (GAV / Costos Fijos)',
 'deudora','perdida','gastos_administracion',3,4,true,false,84
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '5.2.01.004','5.2.01','Internet y Conectividad','movimiento','gasto','Gastos de Administración y Ventas (GAV / Costos Fijos)',
 'deudora','perdida','gastos_administracion',4,4,true,false,85
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '5.2.01.005','5.2.01','Servicios Web/Hosting','movimiento','gasto','Gastos de Administración y Ventas (GAV / Costos Fijos)',
 'deudora','perdida','gastos_administracion',5,4,true,false,86
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '5.2.01.006','5.2.01','Capacitación','movimiento','gasto','Gastos de Administración y Ventas (GAV / Costos Fijos)',
 'deudora','perdida','gastos_administracion',6,4,true,false,87
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '5.2.01.007','5.2.01','Patente municipal','movimiento','gasto','Gastos de Administración y Ventas (GAV / Costos Fijos)',
 'deudora','perdida','gastos_administracion',7,4,true,false,88
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '5.2.01.008','5.2.01','Cotizaciones Patronales','movimiento','gasto','Gastos de Administración y Ventas (GAV / Costos Fijos)',
 'deudora','perdida','gastos_administracion',8,4,true,false,89
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '5.2.01.009','5.2.01','Sueldo empresarial socios','movimiento','gasto','Gastos de Administración y Ventas (GAV / Costos Fijos)',
 'deudora','perdida','gastos_administracion',9,4,true,false,90
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '5.2.01.010','5.2.01','Cotizaciones socios','movimiento','gasto','Gastos de Administración y Ventas (GAV / Costos Fijos)',
 'deudora','perdida','gastos_administracion',10,4,true,false,91
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '5.2.01.011','5.2.01','Depreciación del Ejercicio','movimiento','gasto','Gastos de Administración y Ventas (GAV / Costos Fijos)',
 'deudora','perdida','gastos_administracion',11,4,true,false,92
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '5.2.01.099','5.2.01','Otros Gastos de Administración','movimiento','gasto','Gastos de Administración y Ventas (GAV / Costos Fijos)',
 'deudora','perdida','gastos_administracion',99,4,true,false,93
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '5.3.01.001','5.3.01','Gastos financieros y comisiones bancarias','movimiento','gasto','Resultado No Operacional (Egresos)',
 'deudora','perdida','resultado_no_operacional',1,4,true,false,94
),
(
 (select id from public.contabilidad_plan_plantillas where codigo='EMPRESA_ADMINISTRACION'),
 '5.4.01.001','5.4.01','Impuesto a la Renta del Ejercicio','movimiento','impuesto','Impuesto a la Renta',
 'deudora','perdida','impuesto_renta',1,4,true,false,95
);


-- El plan histórico de entidades con movimientos se reconoce como importado/legado y no se reemplaza.
update public.contabilidad_entidades e
set plan_origen='importado',
    plan_configurado_en=coalesce(plan_configurado_en,now())
where exists(select 1 from public.contabilidad_asientos a where a.entidad_id=e.id);

-- Las comunidades sin movimientos que heredaron el plan empresarial antiguo vuelven a estado pendiente.
delete from public.contabilidad_cuentas c
using public.contabilidad_entidades e
where e.id=c.entidad_id
  and e.tipo='comunidad'
  and not exists(select 1 from public.contabilidad_asientos a where a.entidad_id=e.id);

update public.contabilidad_entidades e
set plan_origen='pendiente',
    plan_plantilla_id=null,
    plan_configurado_en=null,
    plan_configurado_por=null
where e.tipo='comunidad'
  and not exists(select 1 from public.contabilidad_asientos a where a.entidad_id=e.id);

-- Las nuevas entidades ya no reciben automáticamente un plan empresarial.
drop trigger if exists trg_contabilidad_plan_entidad on public.contabilidad_entidades;

create or replace function public.contabilidad_entidad_tiene_movimientos(p_entidad uuid)
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists(
    select 1 from public.contabilidad_asientos
    where entidad_id=p_entidad
  );
$$;
revoke all on function public.contabilidad_entidad_tiene_movimientos(uuid) from public,anon;
grant execute on function public.contabilidad_entidad_tiene_movimientos(uuid) to authenticated;

create or replace function public.contabilidad_aplicar_plantilla(
  p_entidad uuid,
  p_plantilla uuid
)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  v_ent public.contabilidad_entidades%rowtype;
  v_tpl public.contabilidad_plan_plantillas%rowtype;
  r record;
  v_parent uuid;
  v_origen text;
begin
  if not public.es_admin() then raise exception 'Sin permiso.'; end if;
  select * into v_ent from public.contabilidad_entidades where id=p_entidad and activa for update;
  if not found then raise exception 'Entidad no disponible.'; end if;
  if public.contabilidad_entidad_tiene_movimientos(p_entidad) then
    raise exception 'El plan está protegido porque la entidad ya tiene movimientos.';
  end if;

  select * into v_tpl
  from public.contabilidad_plan_plantillas
  where id=p_plantilla and activa
    and (origen='sistema' or creado_por=auth.uid() or public.es_superadmin());
  if not found then raise exception 'Plantilla no disponible.'; end if;

  if v_ent.tipo='comunidad' and v_tpl.naturaleza<>'comunidad' then
    raise exception 'La plantilla seleccionada no corresponde a una comunidad.';
  end if;
  if v_ent.tipo='empresa' and v_tpl.naturaleza<>'empresa' then
    raise exception 'La plantilla seleccionada no corresponde a una empresa.';
  end if;

  delete from public.contabilidad_cuentas where entidad_id=p_entidad;

  for r in
    select * from public.contabilidad_plan_plantilla_cuentas
    where plantilla_id=p_plantilla
    order by nivel,orden,codigo
  loop
    v_parent:=null;
    if r.parent_codigo is not null then
      select id into v_parent from public.contabilidad_cuentas
      where entidad_id=p_entidad and codigo=r.parent_codigo;
    end if;

    insert into public.contabilidad_cuentas(
      entidad_id,parent_id,codigo,cuenta,clase,tipo_contable,grupo,naturaleza,
      clasificacion_balance,eerr_seccion,eerr_orden,orden,activa,nivel,imputable,
      requiere_centro_costo,editado_en
    ) values(
      p_entidad,v_parent,r.codigo,r.cuenta,r.clase,r.tipo_contable,r.grupo,r.naturaleza,
      r.clasificacion_balance,r.eerr_seccion,r.eerr_orden,r.orden,true,r.nivel,r.imputable,
      r.requiere_centro_costo,now()
    );
  end loop;

  v_origen:=case when v_tpl.origen='personalizada' then 'personalizada' else 'plantilla' end;
  update public.contabilidad_entidades
  set plan_origen=v_origen,
      plan_plantilla_id=p_plantilla,
      plan_configurado_en=now(),
      plan_configurado_por=auth.uid(),
      editado_en=now()
  where id=p_entidad;

  return jsonb_build_object('ok',true,'cuentas',(select count(*) from public.contabilidad_cuentas where entidad_id=p_entidad));
end;
$$;
revoke all on function public.contabilidad_aplicar_plantilla(uuid,uuid) from public,anon;
grant execute on function public.contabilidad_aplicar_plantilla(uuid,uuid) to authenticated;

create or replace function public.contabilidad_crear_plan_vacio(p_entidad uuid)
returns jsonb
language plpgsql security definer set search_path=public
as $$
begin
  if not public.es_admin() then raise exception 'Sin permiso.'; end if;
  if public.contabilidad_entidad_tiene_movimientos(p_entidad) then
    raise exception 'El plan está protegido porque la entidad ya tiene movimientos.';
  end if;
  delete from public.contabilidad_cuentas where entidad_id=p_entidad;
  update public.contabilidad_entidades
  set plan_origen='manual',plan_plantilla_id=null,plan_configurado_en=now(),
      plan_configurado_por=auth.uid(),editado_en=now()
  where id=p_entidad and activa;
  if not found then raise exception 'Entidad no disponible.'; end if;
  return jsonb_build_object('ok',true);
end;
$$;
revoke all on function public.contabilidad_crear_plan_vacio(uuid) from public,anon;
grant execute on function public.contabilidad_crear_plan_vacio(uuid) to authenticated;

create or replace function public.contabilidad_importar_plan(p_entidad uuid,p_lineas jsonb)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  r jsonb;
  v_codigo text;
  v_parent_codigo text;
  v_parent uuid;
  v_nivel integer;
  v_tipo text;
  v_naturaleza text;
  v_clas text;
  v_clase text;
  v_imp boolean;
  v_orden integer:=0;
begin
  if not public.es_admin() then raise exception 'Sin permiso.'; end if;
  if public.contabilidad_entidad_tiene_movimientos(p_entidad) then
    raise exception 'El plan está protegido porque la entidad ya tiene movimientos.';
  end if;
  if jsonb_typeof(coalesce(p_lineas,'[]'::jsonb))<>'array' or jsonb_array_length(p_lineas)=0 then
    raise exception 'El archivo no contiene cuentas.';
  end if;

  delete from public.contabilidad_cuentas where entidad_id=p_entidad;

  for r in select value from jsonb_array_elements(p_lineas) loop
    v_orden:=v_orden+1;
    v_codigo:=btrim(coalesce(r->>'codigo',''));
    if v_codigo='' or nullif(btrim(coalesce(r->>'cuenta','')),'') is null then
      raise exception 'Cada fila debe incluir codigo y cuenta.';
    end if;
    if exists(select 1 from public.contabilidad_cuentas where entidad_id=p_entidad and codigo=v_codigo) then
      raise exception 'Código duplicado: %',v_codigo;
    end if;

    v_nivel:=coalesce(nullif(r->>'nivel','')::integer,array_length(string_to_array(v_codigo,'.'),1));
    if v_nivel<1 or v_nivel>5 then raise exception 'Nivel inválido en %.',v_codigo; end if;
    v_tipo:=coalesce(nullif(r->>'tipo_contable',''),
      case left(v_codigo,1) when '1' then 'activo' when '2' then 'pasivo' when '3' then 'patrimonio'
        when '4' then 'ingreso' when '5' then 'gasto' else 'gasto' end);
    v_naturaleza:=coalesce(nullif(r->>'naturaleza',''),
      case when left(v_codigo,1) in ('2','3','4') then 'acreedora' else 'deudora' end);
    v_clas:=coalesce(nullif(r->>'clasificacion_balance',''),
      case left(v_codigo,1) when '1' then 'activo' when '2' then 'pasivo' when '3' then 'pasivo'
        when '4' then 'ganancia' when '5' then 'perdida' else null end);
    v_clase:=coalesce(nullif(r->>'clase',''),'movimiento');
    v_imp:=coalesce(nullif(r->>'imputable','')::boolean,v_clase='movimiento');

    insert into public.contabilidad_cuentas(
      entidad_id,parent_id,codigo,cuenta,clase,tipo_contable,grupo,naturaleza,
      clasificacion_balance,eerr_seccion,eerr_orden,orden,activa,nivel,imputable,
      requiere_centro_costo,editado_en
    ) values(
      p_entidad,null,v_codigo,btrim(r->>'cuenta'),v_clase,v_tipo,
      nullif(btrim(coalesce(r->>'grupo','')),''),v_naturaleza,v_clas,
      nullif(btrim(coalesce(r->>'eerr_seccion','')),''),
      nullif(r->>'eerr_orden','')::integer,v_orden,true,v_nivel,v_imp,
      coalesce(nullif(r->>'requiere_centro_costo','')::boolean,false),now()
    );
  end loop;

  for r in select value from jsonb_array_elements(p_lineas) loop
    v_codigo:=btrim(r->>'codigo');
    v_parent_codigo:=nullif(btrim(coalesce(r->>'parent_codigo','')),'');
    if v_parent_codigo is null and position('.' in v_codigo)>0 then
      v_parent_codigo:=regexp_replace(v_codigo,'\.[^.]+$','');
    end if;
    if v_parent_codigo is not null then
      select id into v_parent from public.contabilidad_cuentas
      where entidad_id=p_entidad and codigo=v_parent_codigo;
      if v_parent is not null then
        update public.contabilidad_cuentas set parent_id=v_parent where entidad_id=p_entidad and codigo=v_codigo;
        update public.contabilidad_cuentas set clase='titulo',imputable=false where id=v_parent;
      end if;
    end if;
  end loop;

  update public.contabilidad_entidades
  set plan_origen='importado',plan_plantilla_id=null,plan_configurado_en=now(),
      plan_configurado_por=auth.uid(),editado_en=now()
  where id=p_entidad and activa;

  return jsonb_build_object('ok',true,'cuentas',(select count(*) from public.contabilidad_cuentas where entidad_id=p_entidad));
end;
$$;
revoke all on function public.contabilidad_importar_plan(uuid,jsonb) from public,anon;
grant execute on function public.contabilidad_importar_plan(uuid,jsonb) to authenticated;

create or replace function public.contabilidad_guardar_plan_como_plantilla(p_entidad uuid,p_nombre text)
returns uuid
language plpgsql security definer set search_path=public
as $$
declare
  v_id uuid;
  v_ent public.contabilidad_entidades%rowtype;
begin
  if not public.es_admin() then raise exception 'Sin permiso.'; end if;
  if nullif(btrim(coalesce(p_nombre,'')),'') is null then raise exception 'El nombre es obligatorio.'; end if;
  select * into v_ent from public.contabilidad_entidades where id=p_entidad and activa;
  if not found then raise exception 'Entidad no disponible.'; end if;
  if not exists(select 1 from public.contabilidad_cuentas where entidad_id=p_entidad) then
    raise exception 'No hay cuentas para guardar.';
  end if;

  insert into public.contabilidad_plan_plantillas(codigo,nombre,naturaleza,origen,creado_por)
  values(
    'PERSONAL_'||replace(gen_random_uuid()::text,'-',''),
    btrim(p_nombre),
    case when v_ent.tipo='comunidad' then 'comunidad' when v_ent.tipo='empresa' then 'empresa' else 'otro' end,
    'personalizada',auth.uid()
  ) returning id into v_id;

  insert into public.contabilidad_plan_plantilla_cuentas(
    plantilla_id,codigo,parent_codigo,cuenta,clase,tipo_contable,grupo,naturaleza,
    clasificacion_balance,eerr_seccion,eerr_orden,nivel,imputable,requiere_centro_costo,orden
  )
  select
    v_id,c.codigo,p.codigo,c.cuenta,c.clase,c.tipo_contable,c.grupo,c.naturaleza,
    c.clasificacion_balance,c.eerr_seccion,c.eerr_orden,c.nivel,c.imputable,c.requiere_centro_costo,c.orden
  from public.contabilidad_cuentas c
  left join public.contabilidad_cuentas p on p.id=c.parent_id
  where c.entidad_id=p_entidad
  order by c.nivel,c.orden,c.codigo;

  return v_id;
end;
$$;
revoke all on function public.contabilidad_guardar_plan_como_plantilla(uuid,text) from public,anon;
grant execute on function public.contabilidad_guardar_plan_como_plantilla(uuid,text) to authenticated;

create or replace function public.contabilidad_proteger_cuenta()
returns trigger
language plpgsql security definer set search_path=public
as $$
declare
  v_mov boolean;
  v_parent public.contabilidad_cuentas%rowtype;
  v_mov_actual boolean;
begin
  if tg_op='DELETE' then
    v_mov:=public.contabilidad_entidad_tiene_movimientos(old.entidad_id);
    if v_mov then raise exception 'No se pueden eliminar cuentas porque la entidad ya tiene movimientos.'; end if;
    return old;
  end if;

  if tg_op='INSERT' then
    v_mov:=public.contabilidad_entidad_tiene_movimientos(new.entidad_id);
    if new.parent_id is not null then
      select * into v_parent from public.contabilidad_cuentas where id=new.parent_id and entidad_id=new.entidad_id;
      if not found then raise exception 'La cuenta agrupadora no pertenece a la entidad.'; end if;
      if v_parent.nivel>=5 then raise exception 'No se puede crear un nivel inferior al quinto nivel.'; end if;
      new.nivel:=v_parent.nivel+1;
      if new.codigo not like v_parent.codigo||'.%' then
        raise exception 'El código debe depender de la cuenta agrupadora %.',v_parent.codigo;
      end if;
      if exists(
        select 1 from public.contabilidad_asiento_lineas l
        join public.contabilidad_asientos a on a.id=l.asiento_id
        where l.cuenta_id=v_parent.id
      ) then
        raise exception 'No se puede convertir en agrupadora una cuenta que ya tiene movimientos.';
      end if;
    elsif v_mov then
      raise exception 'Con historial contable, las nuevas cuentas deben agregarse en un nivel inferior de una cuenta existente.';
    end if;
    new.imputable:=coalesce(new.imputable,true);
    new.clase:=case when new.imputable then 'movimiento' else 'titulo' end;
    return new;
  end if;

  v_mov:=public.contabilidad_entidad_tiene_movimientos(old.entidad_id);
  if v_mov then
    if new.codigo is distinct from old.codigo
       or new.parent_id is distinct from old.parent_id
       or new.clase is distinct from old.clase
       or new.tipo_contable is distinct from old.tipo_contable
       or new.grupo is distinct from old.grupo
       or new.naturaleza is distinct from old.naturaleza
       or new.clasificacion_balance is distinct from old.clasificacion_balance
       or new.eerr_seccion is distinct from old.eerr_seccion
       or new.eerr_orden is distinct from old.eerr_orden
       or new.nivel is distinct from old.nivel
       or new.imputable is distinct from old.imputable
    then
      raise exception 'Con movimientos registrados solo puedes editar el nombre, el orden, la exigencia de centro de costo o el estado de la cuenta.';
    end if;
  end if;

  if old.activa and not new.activa then
    select exists(
      select 1
      from public.contabilidad_asiento_lineas l
      join public.contabilidad_asientos a on a.id=l.asiento_id
      where l.cuenta_id=old.id
        and a.estado='contabilizado'
        and extract(year from a.fecha)=extract(year from current_date)
    ) into v_mov_actual;
    if v_mov_actual then
      raise exception 'No se puede desactivar una cuenta con movimientos en el ejercicio comercial en curso.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_contabilidad_proteger_cuenta on public.contabilidad_cuentas;
create trigger trg_contabilidad_proteger_cuenta
before insert or update or delete on public.contabilidad_cuentas
for each row execute function public.contabilidad_proteger_cuenta();

create or replace function public.contabilidad_actualizar_padre()
returns trigger
language plpgsql security definer set search_path=public
as $$
begin
  if new.parent_id is not null then
    update public.contabilidad_cuentas
    set clase='titulo',imputable=false,editado_en=now()
    where id=new.parent_id
      and (clase<>'titulo' or imputable);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_contabilidad_actualizar_padre on public.contabilidad_cuentas;
create trigger trg_contabilidad_actualizar_padre
after insert or update of parent_id on public.contabilidad_cuentas
for each row execute function public.contabilidad_actualizar_padre();

create or replace function public.contabilidad_eliminar_cuenta(p_cuenta uuid)
returns void
language plpgsql security definer set search_path=public
as $$
declare v_ent uuid;
begin
  if not public.es_admin() then raise exception 'Sin permiso.'; end if;
  select entidad_id into v_ent from public.contabilidad_cuentas where id=p_cuenta;
  if v_ent is null then raise exception 'Cuenta no encontrada.'; end if;
  if public.contabilidad_entidad_tiene_movimientos(v_ent) then
    raise exception 'No se pueden eliminar cuentas porque la entidad ya tiene movimientos.';
  end if;
  if exists(select 1 from public.contabilidad_cuentas where parent_id=p_cuenta) then
    raise exception 'Elimina primero las subcuentas.';
  end if;
  delete from public.contabilidad_cuentas where id=p_cuenta;
end;
$$;
revoke all on function public.contabilidad_eliminar_cuenta(uuid) from public,anon;
grant execute on function public.contabilidad_eliminar_cuenta(uuid) to authenticated;

create or replace function public.contabilidad_configurar_centros(p_entidad uuid,p_usar boolean)
returns void
language plpgsql security definer set search_path=public
as $$
begin
  if not public.es_admin() then raise exception 'Sin permiso.'; end if;
  update public.contabilidad_entidades
  set usa_centros_costo=coalesce(p_usar,false),editado_en=now()
  where id=p_entidad and activa;
  if not found then raise exception 'Entidad no disponible.'; end if;
end;
$$;
revoke all on function public.contabilidad_configurar_centros(uuid,boolean) from public,anon;
grant execute on function public.contabilidad_configurar_centros(uuid,boolean) to authenticated;

create or replace function public.contabilidad_guardar_centro(
  p_entidad uuid,p_id uuid,p_codigo text,p_nombre text,p_descripcion text,p_activa boolean
)
returns public.contabilidad_centros_costo
language plpgsql security definer set search_path=public
as $$
declare v public.contabilidad_centros_costo%rowtype;
begin
  if not public.es_admin() then raise exception 'Sin permiso.'; end if;
  if nullif(btrim(coalesce(p_codigo,'')),'') is null or nullif(btrim(coalesce(p_nombre,'')),'') is null then
    raise exception 'Código y nombre son obligatorios.';
  end if;
  if p_id is null then
    insert into public.contabilidad_centros_costo(entidad_id,codigo,nombre,descripcion,activa,creado_por)
    values(p_entidad,btrim(p_codigo),btrim(p_nombre),nullif(btrim(coalesce(p_descripcion,'')),''),coalesce(p_activa,true),auth.uid())
    returning * into v;
  else
    update public.contabilidad_centros_costo
    set codigo=btrim(p_codigo),nombre=btrim(p_nombre),
        descripcion=nullif(btrim(coalesce(p_descripcion,'')),''),
        activa=coalesce(p_activa,true),editado_en=now()
    where id=p_id and entidad_id=p_entidad
    returning * into v;
    if not found then raise exception 'Centro de costo no encontrado.'; end if;
  end if;
  return v;
end;
$$;
revoke all on function public.contabilidad_guardar_centro(uuid,uuid,text,text,text,boolean) from public,anon;
grant execute on function public.contabilidad_guardar_centro(uuid,uuid,text,text,text,boolean) to authenticated;

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
  v_ent public.contabilidad_entidades%rowtype;
  v_numero integer;
  v_linea jsonb;
  v_cuenta uuid;
  v_cuenta_row public.contabilidad_cuentas%rowtype;
  v_centro uuid;
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

  select * into v_ent from public.contabilidad_entidades
  where id=p_entidad_id and activa for update;
  if not found then raise exception 'La entidad contable no existe o está inactiva.'; end if;
  if not exists(select 1 from public.contabilidad_cuentas where entidad_id=p_entidad_id and imputable and activa) then
    raise exception 'Configura el plan de cuentas antes de registrar asientos.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_entidad_id::text,0));

  for v_linea in select value from jsonb_array_elements(p_lineas) loop
    v_cuenta:=nullif(v_linea->>'cuenta_id','')::uuid;
    v_centro:=nullif(v_linea->>'centro_costo_id','')::uuid;
    v_debe:=coalesce(nullif(v_linea->>'debe','')::numeric,0);
    v_haber:=coalesce(nullif(v_linea->>'haber','')::numeric,0);
    if v_cuenta is null then raise exception 'Cada línea debe tener una cuenta.'; end if;
    if v_debe<0 or v_haber<0 or (v_debe>0 and v_haber>0) or (v_debe=0 and v_haber=0) then
      raise exception 'Cada línea debe tener un importe solo en Debe o solo en Haber.';
    end if;

    select * into v_cuenta_row from public.contabilidad_cuentas
    where id=v_cuenta and entidad_id=p_entidad_id and activa and imputable and clase='movimiento';
    if not found then raise exception 'La cuenta seleccionada no es imputable o está inactiva.'; end if;
    if exists(select 1 from public.contabilidad_cuentas where parent_id=v_cuenta) then
      raise exception 'No se puede imputar directamente a una cuenta agrupadora.';
    end if;

    if v_centro is not null and not exists(
      select 1 from public.contabilidad_centros_costo
      where id=v_centro and entidad_id=p_entidad_id and activa
    ) then
      raise exception 'El centro de costo no pertenece a la entidad o está inactivo.';
    end if;

    if v_ent.usa_centros_costo
       and left(v_cuenta_row.codigo,1) in ('4','5')
       and v_cuenta_row.requiere_centro_costo
       and v_centro is null
    then
      raise exception 'La cuenta % requiere centro de costo.',v_cuenta_row.codigo;
    end if;

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
    select coalesce(max(numero),0)+1 into v_numero from public.contabilidad_asientos where entidad_id=p_entidad_id;
  end if;

  insert into public.contabilidad_asientos(
    entidad_id,numero,fecha,glosa,estado,origen,referencia,proveedor_id,origen_id,creado_por
  ) values(
    p_entidad_id,v_numero,p_fecha,nullif(btrim(coalesce(p_glosa,'')),''),
    'contabilizado',coalesce(nullif(p_origen,''),'manual'),
    nullif(btrim(coalesce(p_referencia,'')),''),
    p_proveedor_id,p_origen_id,auth.uid()
  ) returning * into v_asiento;

  for v_linea in select value from jsonb_array_elements(p_lineas) loop
    v_orden:=v_orden+1;
    insert into public.contabilidad_asiento_lineas(
      asiento_id,cuenta_id,centro_costo_id,orden,debe,haber,glosa
    ) values(
      v_asiento.id,(v_linea->>'cuenta_id')::uuid,
      nullif(v_linea->>'centro_costo_id','')::uuid,
      v_orden,coalesce(nullif(v_linea->>'debe','')::numeric,0),
      coalesce(nullif(v_linea->>'haber','')::numeric,0),
      nullif(btrim(coalesce(v_linea->>'glosa','')),'')
    );
  end loop;

  return v_asiento;
end;
$$;

revoke all on function public.contabilidad_registrar_asiento(uuid,date,text,jsonb,text,text,uuid,uuid,integer) from public,anon;
grant execute on function public.contabilidad_registrar_asiento(uuid,date,text,jsonb,text,text,uuid,uuid,integer) to authenticated;

create or replace function public.contabilidad_libro_diario_v2(
  p_entidad_id uuid,p_desde date default null,p_hasta date default null,p_centro_costo_id uuid default null
)
returns table(
  asiento_id uuid,numero integer,fecha date,cuenta_id uuid,codigo text,cuenta text,
  debe numeric,haber numeric,glosa text,glosa_linea text,referencia text,
  centro_costo_id uuid,centro_costo text
)
language plpgsql stable security definer set search_path=public
as $$
begin
  if not public.es_admin() then raise exception 'Sin permiso.'; end if;
  return query
  select a.id,a.numero,a.fecha,l.cuenta_id,c.codigo,c.cuenta,l.debe,l.haber,
         a.glosa,l.glosa,a.referencia,l.centro_costo_id,coalesce(cc.nombre,'General / Sin asignar')
  from public.contabilidad_asientos a
  join public.contabilidad_asiento_lineas l on l.asiento_id=a.id
  join public.contabilidad_cuentas c on c.id=l.cuenta_id
  left join public.contabilidad_centros_costo cc on cc.id=l.centro_costo_id
  where a.entidad_id=p_entidad_id and a.estado='contabilizado'
    and (p_desde is null or a.fecha>=p_desde)
    and (p_hasta is null or a.fecha<=p_hasta)
    and (p_centro_costo_id is null or l.centro_costo_id=p_centro_costo_id)
  order by a.fecha,a.numero,l.orden;
end;
$$;
revoke all on function public.contabilidad_libro_diario_v2(uuid,date,date,uuid) from public,anon;
grant execute on function public.contabilidad_libro_diario_v2(uuid,date,date,uuid) to authenticated;

create or replace function public.contabilidad_balance_v2(
  p_entidad_id uuid,p_desde date default null,p_hasta date default null,p_centro_costo_id uuid default null
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
    select c.id,c.codigo,c.cuenta,c.clasificacion_balance,c.activa,
      coalesce(sum(l.debe) filter(where a.estado='contabilizado'),0)::numeric debe,
      coalesce(sum(l.haber) filter(where a.estado='contabilizado'),0)::numeric haber
    from public.contabilidad_cuentas c
    left join public.contabilidad_asiento_lineas l on l.cuenta_id=c.id
      and (p_centro_costo_id is null or l.centro_costo_id=p_centro_costo_id)
    left join public.contabilidad_asientos a on a.id=l.asiento_id
      and a.entidad_id=p_entidad_id
      and (p_desde is null or a.fecha>=p_desde)
      and (p_hasta is null or a.fecha<=p_hasta)
    where c.entidad_id=p_entidad_id and c.clase='movimiento'
    group by c.id,c.codigo,c.cuenta,c.clasificacion_balance,c.activa
  )
  select m.id,m.codigo,m.cuenta,m.debe,m.haber,
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
revoke all on function public.contabilidad_balance_v2(uuid,date,date,uuid) from public,anon;
grant execute on function public.contabilidad_balance_v2(uuid,date,date,uuid) to authenticated;

create or replace function public.contabilidad_eerr_detalle_v2(
  p_entidad_id uuid,p_desde date default null,p_hasta date default null,p_centro_costo_id uuid default null
)
returns table(cuenta_id uuid,codigo text,cuenta text,seccion text,orden integer,monto numeric)
language plpgsql stable security definer set search_path=public
as $$
begin
  if not public.es_admin() then raise exception 'Sin permiso.'; end if;
  return query
  with movimientos as (
    select c.id,c.codigo,c.cuenta,c.eerr_seccion,c.eerr_orden,c.activa,
      coalesce(sum(l.debe) filter(where a.estado='contabilizado'),0)::numeric debe,
      coalesce(sum(l.haber) filter(where a.estado='contabilizado'),0)::numeric haber
    from public.contabilidad_cuentas c
    left join public.contabilidad_asiento_lineas l on l.cuenta_id=c.id
      and (p_centro_costo_id is null or l.centro_costo_id=p_centro_costo_id)
    left join public.contabilidad_asientos a on a.id=l.asiento_id
      and a.entidad_id=p_entidad_id
      and (p_desde is null or a.fecha>=p_desde)
      and (p_hasta is null or a.fecha<=p_hasta)
    where c.entidad_id=p_entidad_id and c.clase='movimiento' and c.eerr_seccion is not null
    group by c.id,c.codigo,c.cuenta,c.eerr_seccion,c.eerr_orden,c.activa
  )
  select m.id,m.codigo,m.cuenta,m.eerr_seccion,m.eerr_orden,
    case when m.eerr_seccion in ('ingresos_operacionales','resultado_no_operacional')
      then m.haber-m.debe else m.debe-m.haber end::numeric
  from movimientos m
  where m.activa or m.debe<>0 or m.haber<>0
  order by m.eerr_seccion,m.eerr_orden,m.codigo;
end;
$$;
revoke all on function public.contabilidad_eerr_detalle_v2(uuid,date,date,uuid) from public,anon;
grant execute on function public.contabilidad_eerr_detalle_v2(uuid,date,date,uuid) to authenticated;

create or replace function public.contabilidad_eerr_sin_clasificar_v2(
  p_entidad_id uuid,p_desde date default null,p_hasta date default null,p_centro_costo_id uuid default null
)
returns table(cuenta_id uuid,codigo text,cuenta text,monto numeric)
language plpgsql stable security definer set search_path=public
as $$
begin
  if not public.es_admin() then raise exception 'Sin permiso.'; end if;
  return query
  select c.id,c.codigo,c.cuenta,
    case when c.tipo_contable='ingreso' then sum(l.haber-l.debe) else sum(l.debe-l.haber) end::numeric
  from public.contabilidad_asientos a
  join public.contabilidad_asiento_lineas l on l.asiento_id=a.id
  join public.contabilidad_cuentas c on c.id=l.cuenta_id
  where a.entidad_id=p_entidad_id and a.estado='contabilizado'
    and c.tipo_contable in ('ingreso','costo','gasto','impuesto')
    and c.eerr_seccion is null
    and (p_desde is null or a.fecha>=p_desde)
    and (p_hasta is null or a.fecha<=p_hasta)
    and (p_centro_costo_id is null or l.centro_costo_id=p_centro_costo_id)
  group by c.id,c.codigo,c.cuenta,c.tipo_contable
  having case when c.tipo_contable='ingreso' then sum(l.haber-l.debe) else sum(l.debe-l.haber) end<>0
  order by c.codigo;
end;
$$;
revoke all on function public.contabilidad_eerr_sin_clasificar_v2(uuid,date,date,uuid) from public,anon;
grant execute on function public.contabilidad_eerr_sin_clasificar_v2(uuid,date,date,uuid) to authenticated;

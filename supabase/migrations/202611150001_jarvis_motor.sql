-- Jarvis: motor de anticipación de la gestión de Coproactiva.
--
-- Jarvis no guarda una copia de los datos: lee lo que ya vive en Gestión Diaria
-- (compromisos, mantenciones, levantamientos, bitácora, CRM, proveedores,
-- postulantes, WhatsApp) y lo ordena en una sola agenda con fecha, urgencia y
-- la acción que corresponde. Lo que no se puede anticipar porque falta el dato
-- (fecha de contrato, comité, fecha de asamblea...) se informa como "brecha":
-- una variable que hay que completar para que el flujo quede cubierto.
--
-- Piezas:
--   jarvis_ciclo_reglas      Obligaciones recurrentes (ciclo legal y contractual).
--   jarvis_ciclo_comunidad   Fechas de cada obligación por comunidad.
--   jarvis_analisis          Lectura diaria escrita por el análisis conectado.
--   jarvis_agenda(dias)      Agenda unificada. SECURITY INVOKER: respeta la RLS
--                            de cada tabla de origen.
--   jarvis_generar_avisos()  Aviso diario en la campana (cron).
--
-- Cambio aditivo: no modifica tablas ni datos de negocio existentes.

-- ---------------------------------------------------------------------------
-- 1. Ciclo recurrente
-- ---------------------------------------------------------------------------
create table if not exists public.jarvis_ciclo_reglas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  ambito text not null default 'legal' check (ambito in ('legal', 'operacion')),
  titulo text not null,
  descripcion text,
  base text,
  -- Meses entre una ocurrencia y la siguiente. NULL: la próxima fecha se
  -- registra a mano (por ejemplo, el vencimiento que indica un certificado).
  frecuencia_meses integer check (frecuencia_meses is null or frecuencia_meses > 0),
  anticipo_dias integer not null default 30 check (anticipo_dias >= 0),
  accion text not null,
  activa boolean not null default true,
  orden integer not null default 0,
  creado_en timestamptz not null default now()
);

comment on table public.jarvis_ciclo_reglas is
  'Jarvis: obligaciones recurrentes de la administración (ciclo legal Ley 21.442 y contractual).';

create table if not exists public.jarvis_ciclo_comunidad (
  id uuid primary key default gen_random_uuid(),
  comunidad_id uuid not null references public.comunidades(id) on delete cascade,
  regla_id uuid not null references public.jarvis_ciclo_reglas(id) on delete cascade,
  aplica boolean not null default true,
  ultima_fecha date,
  proxima_fecha date,
  notas text,
  actualizado_por uuid references public.perfiles(id) on delete set null,
  actualizado_en timestamptz not null default now(),
  unique (comunidad_id, regla_id)
);

comment on table public.jarvis_ciclo_comunidad is
  'Jarvis: última y próxima fecha de cada obligación recurrente por comunidad.';

create index if not exists jarvis_ciclo_comunidad_proxima
  on public.jarvis_ciclo_comunidad (proxima_fecha);

insert into public.jarvis_ciclo_reglas
  (codigo, ambito, titulo, descripcion, base, frecuencia_meses, anticipo_dias, accion, orden)
values
  ('ASAMBLEA_ORDINARIA', 'legal', 'Asamblea ordinaria anual',
   'Cuenta documentada, balances, respaldos disponibles y, cuando corresponda, elección del comité.',
   'Ley 21.442, artículo 14', 12, 45,
   'Preparar la cuenta documentada y citar a la asamblea ordinaria', 10),
  ('RENDICION_MENSUAL', 'legal', 'Rendición de cuentas mensual al comité',
   'Ingresos, gastos, remuneraciones, cotizaciones, cartolas y seguros, con los respaldos disponibles al menos 24 horas antes.',
   'Ley 21.442, artículo 21', 1, 7,
   'Preparar la rendición del mes y dejar los respaldos a disposición del comité', 20),
  ('PRESUPUESTO_ANUAL', 'legal', 'Presupuesto anual del condominio',
   'Proyección de los próximos 12 meses, incluido el fondo de reserva. Se remite al menos 30 días antes del período en que regirá.',
   'Ley 21.442, presupuesto anual', 12, 60,
   'Elaborar el presupuesto de 12 meses y remitirlo con 30 días de anticipación', 30),
  ('PLAN_EMERGENCIA', 'legal', 'Actualización del plan de emergencia y evacuación',
   'Se actualiza al menos una vez al año e incorpora a personas con movilidad reducida. Debe quedar disponible en conserjería.',
   'Ley 21.442, artículo 40', 12, 45,
   'Actualizar el plan de emergencia y evacuación y dejarlo en conserjería', 40),
  ('SEGUROS', 'legal', 'Vigencia de seguros del condominio',
   'Registrar el vencimiento de la póliza para renovarla antes de que termine la cobertura.',
   'Ley 21.442, seguros del condominio', 12, 45,
   'Cotizar y renovar la póliza antes del vencimiento', 50),
  ('CERT_ASCENSORES', 'legal', 'Certificación de ascensores',
   'Registrar el vencimiento del certificado. Solo aplica a comunidades con ascensores.',
   'Normativa sectorial de ascensores', null, 60,
   'Coordinar la certificación con el proveedor habilitado', 60),
  ('CERT_GAS', 'legal', 'Certificación de instalaciones de gas',
   'Registrar el vencimiento del certificado. Solo aplica a comunidades con red de gas.',
   'Normativa sectorial de gas', null, 60,
   'Coordinar la inspección y certificación de gas', 70)
on conflict (codigo) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Lectura diaria del análisis conectado
-- ---------------------------------------------------------------------------
create table if not exists public.jarvis_analisis (
  id uuid primary key default gen_random_uuid(),
  fecha date not null unique,
  resumen text not null,
  -- [{ "titulo", "detalle", "ambito", "ruta" }]
  prioridades jsonb not null default '[]'::jsonb check (jsonb_typeof(prioridades) = 'array'),
  riesgos jsonb not null default '[]'::jsonb check (jsonb_typeof(riesgos) = 'array'),
  fuentes jsonb not null default '[]'::jsonb check (jsonb_typeof(fuentes) = 'array'),
  generado_por text not null default 'claude',
  generado_en timestamptz not null default now()
);

comment on table public.jarvis_analisis is
  'Jarvis: lectura diaria del negocio (correo, WhatsApp y datos de la app) escrita por el análisis conectado.';

-- ---------------------------------------------------------------------------
-- 3. Permisos
-- ---------------------------------------------------------------------------
alter table public.jarvis_ciclo_reglas enable row level security;
alter table public.jarvis_ciclo_comunidad enable row level security;
alter table public.jarvis_analisis enable row level security;

drop policy if exists jarvis_ciclo_reglas_lectura on public.jarvis_ciclo_reglas;
create policy jarvis_ciclo_reglas_lectura on public.jarvis_ciclo_reglas
  for select to authenticated
  using (public.es_admin() or public.mi_rol() = 'jefatura'::public.rol_usuario);

drop policy if exists jarvis_ciclo_reglas_escritura on public.jarvis_ciclo_reglas;
create policy jarvis_ciclo_reglas_escritura on public.jarvis_ciclo_reglas
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists jarvis_ciclo_comunidad_gestion on public.jarvis_ciclo_comunidad;
create policy jarvis_ciclo_comunidad_gestion on public.jarvis_ciclo_comunidad
  for all to authenticated
  using (public.es_admin() or public.mi_rol() = 'jefatura'::public.rol_usuario)
  with check (public.es_admin() or public.mi_rol() = 'jefatura'::public.rol_usuario);

drop policy if exists jarvis_analisis_lectura on public.jarvis_analisis;
create policy jarvis_analisis_lectura on public.jarvis_analisis
  for select to authenticated
  using (public.es_admin() or public.mi_rol() = 'jefatura'::public.rol_usuario);

-- Las dos tablas de Jarvis ya existentes tenían RLS sin políticas: nadie podía
-- leerlas desde la app.
drop policy if exists jarvis_compromisos_gestion on public.jarvis_compromisos;
create policy jarvis_compromisos_gestion on public.jarvis_compromisos
  for all to authenticated
  using (public.es_admin() or public.mi_rol() = 'jefatura'::public.rol_usuario)
  with check (public.es_admin() or public.mi_rol() = 'jefatura'::public.rol_usuario);

drop policy if exists jarvis_metricas_web_lectura on public.jarvis_metricas_web;
create policy jarvis_metricas_web_lectura on public.jarvis_metricas_web
  for select to authenticated
  using (public.es_admin());

-- ---------------------------------------------------------------------------
-- 4. Agenda unificada
-- ---------------------------------------------------------------------------
-- urgencia: vencido | hoy | semana | proximo | brecha
-- dias:     días hasta la fecha (negativo = atraso). NULL en las brechas.
create or replace function public.jarvis_agenda(p_dias integer default 30)
returns table (
  clave text,
  ambito text,
  tipo text,
  titulo text,
  detalle text,
  comunidad_id uuid,
  comunidad text,
  prospecto_id uuid,
  fecha date,
  dias integer,
  urgencia text,
  accion text,
  ruta text
)
language sql
stable
security invoker
set search_path = public
as $$
with ref as (
  select (now() at time zone 'America/Santiago')::date as hoy,
         greatest(coalesce(p_dias, 30), 1) as horizonte
),
activas as (
  select c.id, c.nombre, c.fecha_inicio_contrato, c.fecha_renovacion
  from comunidades c
  where c.estado in ('activo', 'marcha_blanca')
),
bruto as (
  -- ---------------- Operación: compromisos por comunidad ----------------
  select 'compromiso:' || ca.id as clave, 'operacion' as ambito, 'compromiso' as tipo,
         ca.titulo,
         nullif(concat_ws(' · ',
           case ca.estado when 'pendiente' then 'Pendiente' when 'en_curso' then 'En ejecución'
             when 'en_espera' then 'En espera' when 'en_pausa' then 'En pausa'
             when 'bloqueado' then 'Bloqueado' else ca.estado end,
           ca.avance || '% de avance',
           nullif(ca.responsable, '')), '') as detalle,
         ca.comunidad_id, co.nombre as comunidad, null::uuid as prospecto_id,
         coalesce(ca.fecha_proxima_accion, ca.fecha_limite) as fecha,
         coalesce(nullif(ca.proxima_accion_texto, ''),
           case when coalesce(ca.fecha_proxima_accion, ca.fecha_limite) is null
                then 'Definir fecha límite o próxima acción'
                when ca.estado = 'bloqueado' then 'Destrabar el compromiso'
                else 'Registrar avance o cerrar el compromiso' end) as accion,
         '/comunidades/' || ca.comunidad_id || '?seccion=compromisos' as ruta,
         true as siempre
  from compromisos_administracion ca
  join comunidades co on co.id = ca.comunidad_id
  where ca.archivado_en is null and ca.estado <> 'completado'

  union all
  -- ---------------- Compromisos asumidos por Coproactiva ----------------
  select 'asumido:' || jc.id,
         case when jc.comunidad_id is not null then 'operacion'
              when jc.prospecto_id is not null then 'comercial'
              when jc.contraparte ilike 'proveedor%' then 'proveedores'
              else 'operacion' end,
         'compromiso_asumido', jc.titulo,
         nullif(concat_ws(' · ', nullif(jc.contraparte, ''), nullif(jc.responsable, '')), ''),
         jc.comunidad_id, co.nombre, jc.prospecto_id,
         jc.fecha_limite,
         case jc.tipo when 'informe' then 'Enviar el informe comprometido'
           when 'visita' then 'Coordinar y realizar la visita'
           when 'propuesta' then 'Enviar la propuesta comprometida'
           when 'seguimiento' then 'Hacer el seguimiento comprometido'
           when 'documento' then 'Enviar el documento comprometido'
           when 'respuesta' then 'Responder lo comprometido'
           when 'reunion' then 'Agendar o realizar la reunión'
           else 'Cumplir o cerrar el compromiso' end,
         '/jarvis?vista=asumidos', true
  from jarvis_compromisos jc
  left join comunidades co on co.id = jc.comunidad_id
  where jc.estado in ('pendiente', 'en_curso')

  union all
  -- ---------------- Mantenciones ----------------
  select 'mantencion:' || ma.id, 'operacion', 'mantencion', ma.trabajo,
         nullif(concat_ws(' · ', ac.nombre, nullif(ma.proveedor, '')), ''),
         ma.comunidad_id, co.nombre, null::uuid,
         ma.proxima_exigible,
         'Agendar o ejecutar la mantención', '/mantenciones', false
  from mantenimiento_actividades ma
  join comunidades co on co.id = ma.comunidad_id
  left join activos_comunidad ac on ac.id = ma.activo_id
  where ma.activa and ma.proxima_exigible is not null
    and not exists (
      select 1 from mantenimiento_agendamientos ag
      where ag.actividad_id = ma.id and ag.estado in ('agendada', 'en_curso'))

  union all
  select 'agenda:' || ag.id, 'operacion', 'mantencion_agendada', ma.trabajo,
         'Mantención agendada', ag.comunidad_id, co.nombre, null::uuid,
         (ag.programado_para at time zone 'America/Santiago')::date,
         'Ejecutar la mantención y cargar la evidencia', '/mantenciones', false
  from mantenimiento_agendamientos ag
  join mantenimiento_actividades ma on ma.id = ag.actividad_id
  join comunidades co on co.id = ag.comunidad_id
  where ag.estado in ('agendada', 'en_curso')

  union all
  -- ---------------- Levantamientos ----------------
  select 'requerimiento:' || lr.id, 'operacion', 'levantamiento', lr.nombre,
         'Levantamiento periódico', lr.comunidad_id, co.nombre, null::uuid,
         lr.proxima_exigible, 'Programar el levantamiento', '/nuevo', false
  from levantamiento_requerimientos lr
  join comunidades co on co.id = lr.comunidad_id
  where lr.activa and lr.proxima_exigible is not null

  union all
  select 'control:' || ct.id, 'operacion', 'levantamiento',
         coalesce(pl.nombre, 'Levantamiento'),
         case ct.estado::text when 'pendiente' then 'Programado, sin iniciar'
           when 'en_curso' then 'Iniciado, sin enviar' else 'En pausa' end,
         ct.comunidad_id, coalesce(co.nombre, pr.nombre_condominio), ct.prospecto_id,
         coalesce((ct.programado_para at time zone 'America/Santiago')::date,
                  (ct.checkin_en at time zone 'America/Santiago')::date,
                  (ct.creado_en at time zone 'America/Santiago')::date),
         case ct.estado::text when 'pendiente' then 'Realizar el levantamiento'
           else 'Terminar y enviar el levantamiento' end,
         '/control/' || ct.id, true
  from controles ct
  left join plantillas_control pl on pl.id = ct.plantilla_id
  left join comunidades co on co.id = ct.comunidad_id
  left join prospectos pr on pr.id = ct.prospecto_id
  where ct.estado::text in ('pendiente', 'en_curso', 'pausado')

  union all
  -- ---------------- Órdenes de trabajo, hallazgos y bitácora ----------------
  select 'ot:' || ot.id, 'operacion', 'orden_trabajo', ot.titulo,
         nullif(concat_ws(' · ', 'OT ' || ot.folio, nullif(ot.proveedor, '')), ''),
         ot.comunidad_id, co.nombre, null::uuid,
         (ot.vence_el at time zone 'America/Santiago')::date,
         'Gestionar el cierre de la orden de trabajo',
         '/comunidades/' || ot.comunidad_id, true
  from ordenes_trabajo ot
  join comunidades co on co.id = ot.comunidad_id
  where ot.estado::text in ('pendiente', 'en_curso')

  union all
  select 'hallazgo:' || h.id, 'operacion', 'hallazgo', h.titulo,
         'Hallazgo ' || h.severidad::text || ' sin resolver',
         h.comunidad_id, co.nombre, null::uuid,
         (h.registrado_en at time zone 'America/Santiago')::date,
         'Resolver el hallazgo o derivarlo a una orden de trabajo',
         '/comunidades/' || h.comunidad_id, true
  from hallazgos h
  join comunidades co on co.id = h.comunidad_id
  where h.resuelto_en is null and h.severidad::text in ('importante', 'critica')

  union all
  select 'bitacora:' || b.id, 'operacion', 'bitacora', b.titulo,
         case b.nivel when 'urgente' then 'Registro urgente abierto'
           when 'atencion' then 'Registro de atención abierto' else 'Registro abierto' end,
         b.comunidad_id, co.nombre, null::uuid,
         (b.registrado_en at time zone 'America/Santiago')::date,
         'Resolver y finalizar el registro de bitácora', '/bitacora/' || b.id, true
  from bitacora_registros b
  left join comunidades co on co.id = b.comunidad_id
  where b.estado = 'abierta' and b.nivel in ('urgente', 'atencion')

  union all
  -- ---------------- Comercial: próxima acción definida ----------------
  select 'prospecto:' || p.id, 'comercial', 'prospecto',
         coalesce(nullif(p.proxima_accion, ''), 'Próxima acción') || ' · ' || p.nombre_condominio,
         'Etapa: ' || p.etapa::text, null::uuid, null::text, p.id,
         (p.fecha_proxima_accion at time zone 'America/Santiago')::date,
         coalesce(nullif(p.proxima_accion, ''), 'Ejecutar la próxima acción comercial'),
         '/pipeline?prospecto=' || p.id, true
  from prospectos p
  where p.etapa::text not in ('ganado', 'perdido') and p.fecha_proxima_accion is not null

  union all
  -- ---------------- Comercial: sin próxima acción, se anticipa por etapa ----
  select 'prospecto-flujo:' || p.id, 'comercial', 'prospecto_flujo',
         p.nombre_condominio,
         'Etapa: ' || p.etapa::text || ' · sin próxima acción definida',
         null::uuid, null::text, p.id,
         (coalesce(p.fecha_ultima_interaccion, p.creado_en) at time zone 'America/Santiago')::date
           + case p.etapa::text when 'nuevo' then 1 when 'contacto' then 5
               when 'diagnostico' then 7 else 5 end,
         case p.etapa::text
           when 'nuevo' then 'Hacer el primer contacto'
           when 'contacto' then 'Agendar la reunión o el diagnóstico'
           when 'diagnostico' then 'Enviar la propuesta'
           when 'propuesta' then 'Hacer seguimiento a la propuesta'
           else 'Cerrar la negociación' end,
         '/pipeline?prospecto=' || p.id, true
  from prospectos p
  where p.etapa::text not in ('ganado', 'perdido') and p.fecha_proxima_accion is null

  union all
  -- ---------------- Comercial: correo recibido sin respuesta ----------------
  select 'correo:' || u.id, 'comercial', 'correo_sin_respuesta',
         'Correo sin responder · ' || p.nombre_condominio,
         nullif(u.asunto, ''), null::uuid, null::text, p.id,
         (u.momento at time zone 'America/Santiago')::date + 1,
         'Responder el correo del prospecto',
         '/pipeline?prospecto=' || p.id, true
  from prospectos p
  cross join lateral (
    select pc.id, pc.asunto, pc.estado, coalesce(pc.enviado_en, pc.creado_en) as momento
    from prospecto_correos pc
    where pc.prospecto_id = p.id and pc.estado in ('enviado', 'recibido')
    order by coalesce(pc.enviado_en, pc.creado_en) desc
    limit 1
  ) u
  where p.etapa::text <> 'perdido' and u.estado = 'recibido'

  union all
  -- ---------------- Comercial: ganado sin puesta en marcha ----------------
  select 'ganado:' || p.id, 'comercial', 'puesta_en_marcha',
         'Puesta en marcha pendiente · ' || p.nombre_condominio,
         'Prospecto ganado sin comunidad creada', null::uuid, null::text, p.id,
         (coalesce(p.fecha_ultima_interaccion, p.editado_en) at time zone 'America/Santiago')::date + 3,
         'Crear la comunidad e iniciar la puesta en marcha',
         '/pipeline?prospecto=' || p.id, true
  from prospectos p
  where p.etapa::text = 'ganado' and p.comunidad_id is null

  union all
  select 'lead:' || l.id, 'comercial', 'lead',
         'Lead sin contactar · ' || coalesce(nullif(l.nombre_condominio, ''), l.nombre_contacto, 'Sin nombre'),
         nullif(l.fuente, ''), null::uuid, null::text, l.prospecto_id,
         (l.fecha_ingreso at time zone 'America/Santiago')::date + 1,
         'Contactar el lead', '/pipeline', true
  from leads l
  where l.estado::text = 'nuevo' and not coalesce(l.archivado, false)

  union all
  -- ---------------- Ciclo legal y contractual ----------------
  select 'ciclo:' || a.id || ':' || r.codigo, r.ambito, 'ciclo', r.titulo,
         r.base, a.id, a.nombre, null::uuid,
         coalesce(cc.proxima_fecha,
                  (cc.ultima_fecha + make_interval(months => r.frecuencia_meses))::date),
         r.accion, '/jarvis?vista=ciclo', false
  from activas a
  cross join jarvis_ciclo_reglas r
  left join jarvis_ciclo_comunidad cc on cc.comunidad_id = a.id and cc.regla_id = r.id
  where r.activa and coalesce(cc.aplica, true)
    and coalesce(cc.proxima_fecha,
                 (cc.ultima_fecha + make_interval(months => r.frecuencia_meses))::date) is not null
    and coalesce(cc.proxima_fecha,
                 (cc.ultima_fecha + make_interval(months => r.frecuencia_meses))::date)
        <= (select hoy + greatest(horizonte, r.anticipo_dias) from ref)

  union all
  select 'renovacion:' || a.id, 'legal', 'contrato', 'Renovación del contrato de administración',
         'Contrato vigente desde ' || coalesce(to_char(a.fecha_inicio_contrato, 'DD-MM-YYYY'), 'fecha no registrada'),
         a.id, a.nombre, null::uuid, a.fecha_renovacion,
         'Preparar la renovación y revisar honorarios con el comité',
         '/comunidades/' || a.id, false
  from activas a
  where a.fecha_renovacion is not null
    and a.fecha_renovacion <= (select hoy + greatest(horizonte, 90) from ref)

  union all
  -- ---------------- Proveedores y personal (agrupados) ----------------
  select 'postulantes:nuevos', 'proveedores', 'postulantes',
         count(*) || case when count(*) = 1 then ' postulante sin revisar' else ' postulantes sin revisar' end,
         'El más antiguo espera desde el ' || to_char(min(po.fecha_postulacion) at time zone 'America/Santiago', 'DD-MM-YYYY'),
         null::uuid, null::text, null::uuid,
         (min(coalesce(po.fecha_postulacion, po.creado_en)) at time zone 'America/Santiago')::date + 3,
         'Revisar y clasificar las postulaciones', '/proveedores/postulantes', true
  from postulantes po
  where po.estado = 'nuevo'
  having count(*) > 0

  union all
  select 'proveedor-correos:sin-clasificar', 'proveedores', 'correos_proveedores',
         count(*) || case when count(*) = 1 then ' correo de proveedores sin clasificar' else ' correos de proveedores sin clasificar' end,
         'Último recibido el ' || to_char(max(pc.fecha_correo) at time zone 'America/Santiago', 'DD-MM-YYYY'),
         null::uuid, null::text, null::uuid,
         (max(pc.fecha_correo) at time zone 'America/Santiago')::date + 3,
         'Clasificar los correos recibidos', '/proveedores/correos', true
  from proveedor_correos pc
  where pc.clasificacion is null
  having count(*) > 0

  union all
  select 'whatsapp:derivadas', 'proveedores', 'whatsapp',
         count(*) || case when count(*) = 1 then ' conversación de WhatsApp espera atención' else ' conversaciones de WhatsApp esperan atención' end,
         'La más antigua desde el ' || to_char(min(w.ultima_interaccion) at time zone 'America/Santiago', 'DD-MM-YYYY'),
         null::uuid, null::text, null::uuid,
         (min(w.ultima_interaccion) at time zone 'America/Santiago')::date,
         'Atender las conversaciones derivadas', '/whatsapp', true
  from whatsapp_conversations w
  where w.estado in ('derivada', 'atencion_humana')
  having count(*) > 0
),
brechas as (
  -- Variables que faltan para poder anticipar.
  select 'brecha-ciclo:' || a.id || ':' || r.codigo as clave, r.ambito, 'brecha_ciclo' as tipo,
         r.titulo, 'Sin fecha registrada · ' || coalesce(r.base, '') as detalle,
         a.id as comunidad_id, a.nombre as comunidad, null::uuid as prospecto_id,
         'Registrar la última o la próxima fecha, o marcar que no aplica' as accion,
         '/jarvis?vista=ciclo' as ruta
  from activas a
  cross join jarvis_ciclo_reglas r
  left join jarvis_ciclo_comunidad cc on cc.comunidad_id = a.id and cc.regla_id = r.id
  where r.activa and coalesce(cc.aplica, true)
    and cc.proxima_fecha is null
    and (cc.ultima_fecha is null or r.frecuencia_meses is null)

  union all
  select 'brecha-contrato:' || a.id, 'legal', 'brecha_contrato',
         'Fechas del contrato de administración',
         concat_ws(' · ',
           case when a.fecha_inicio_contrato is null then 'Sin fecha de inicio' end,
           case when a.fecha_renovacion is null then 'Sin fecha de renovación' end),
         a.id, a.nombre, null::uuid,
         'Completar las fechas del contrato en la ficha de la comunidad',
         '/comunidades/' || a.id
  from activas a
  where a.fecha_inicio_contrato is null or a.fecha_renovacion is null

  union all
  select 'brecha-comite:' || a.id, 'operacion', 'brecha_comite', 'Comité de administración',
         'Sin integrantes registrados', a.id, a.nombre, null::uuid,
         'Registrar a los integrantes del comité y sus contactos',
         '/comunidades/' || a.id
  from activas a
  where not exists (select 1 from comite cm where cm.comunidad_id = a.id)

  union all
  select 'brecha-mantencion:' || a.id, 'operacion', 'brecha_mantencion', 'Plan de mantenciones',
         'Sin actividades de mantención activas', a.id, a.nombre, null::uuid,
         'Cargar los activos y el plan de mantención preventiva', '/mantenciones'
  from activas a
  where not exists (
    select 1 from mantenimiento_actividades ma where ma.comunidad_id = a.id and ma.activa)

  union all
  select 'brecha-levantamiento:' || a.id, 'operacion', 'brecha_levantamiento',
         'Levantamientos periódicos', 'Sin levantamientos periódicos definidos',
         a.id, a.nombre, null::uuid,
         'Definir qué levantamientos se repiten y con qué frecuencia', '/nuevo'
  from activas a
  where not exists (
    select 1 from levantamiento_requerimientos lr where lr.comunidad_id = a.id and lr.activa)
),
todo as (
  select b.clave, b.ambito, b.tipo, b.titulo, b.detalle, b.comunidad_id, b.comunidad,
         b.prospecto_id, b.fecha,
         (b.fecha - r.hoy) as dias,
         case when b.fecha is null then 'brecha'
              when b.fecha < r.hoy then 'vencido'
              when b.fecha = r.hoy then 'hoy'
              when b.fecha <= r.hoy + 7 then 'semana'
              else 'proximo' end as urgencia,
         b.accion, b.ruta
  from bruto b cross join ref r
  where b.fecha is null or b.siempre or b.fecha <= r.hoy + r.horizonte
     or b.tipo in ('ciclo', 'contrato')

  union all
  select clave, ambito, tipo, titulo, detalle, comunidad_id, comunidad, prospecto_id,
         null::date, null::integer, 'brecha', accion, ruta
  from brechas
)
select t.clave, t.ambito, t.tipo, t.titulo, t.detalle, t.comunidad_id, t.comunidad,
       t.prospecto_id, t.fecha, t.dias, t.urgencia, t.accion, t.ruta
from todo t
-- Desde la app solo dirección y jefatura. El cron (sin sesión de usuario)
-- pasa por jarvis_generar_avisos, que no es ejecutable por usuarios.
where current_user not in ('authenticated', 'anon')
   or public.es_admin()
   or public.mi_rol() = 'jefatura'::public.rol_usuario
order by case t.urgencia when 'vencido' then 0 when 'hoy' then 1 when 'semana' then 2
           when 'proximo' then 3 else 4 end,
         t.fecha nulls last, t.titulo;
$$;

comment on function public.jarvis_agenda(integer) is
  'Jarvis: agenda unificada de lo que viene y de las variables que faltan. SECURITY INVOKER.';

revoke all on function public.jarvis_agenda(integer) from public, anon;
grant execute on function public.jarvis_agenda(integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Aviso diario en la campana
-- ---------------------------------------------------------------------------
create or replace function public.jarvis_generar_avisos()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vencidos integer;
  v_hoy integer;
  v_semana integer;
  v_brechas integer;
  v_fecha date := (now() at time zone 'America/Santiago')::date;
  v_mensaje text;
  v_insertadas integer := 0;
begin
  select count(*) filter (where urgencia = 'vencido'),
         count(*) filter (where urgencia = 'hoy'),
         count(*) filter (where urgencia = 'semana'),
         count(*) filter (where urgencia = 'brecha')
    into v_vencidos, v_hoy, v_semana, v_brechas
  from public.jarvis_agenda(30);

  if v_vencidos + v_hoy + v_semana = 0 then
    return 0;
  end if;

  v_mensaje := concat_ws(' · ',
    case when v_vencidos > 0 then v_vencidos || ' con atraso' end,
    case when v_hoy > 0 then v_hoy || ' para hoy' end,
    case when v_semana > 0 then v_semana || ' en los próximos 7 días' end,
    case when v_brechas > 0 then v_brechas || ' datos por completar' end);

  insert into public.notificaciones (destinatario_id, tipo, titulo, mensaje)
  select p.id, 'jarvis_resumen', 'Jarvis: lo que viene', v_mensaje
  from public.perfiles p
  where p.activo and p.rol in ('superadmin', 'admin', 'jefatura')
    and not exists (
      select 1 from public.notificaciones n
      where n.destinatario_id = p.id and n.tipo = 'jarvis_resumen'
        and (n.creado_en at time zone 'America/Santiago')::date = v_fecha);

  get diagnostics v_insertadas = row_count;
  return v_insertadas;
end;
$$;

comment on function public.jarvis_generar_avisos() is
  'Jarvis: deja un aviso diario en la campana de dirección y jefatura. Solo cron.';

revoke all on function public.jarvis_generar_avisos() from public, anon, authenticated;

-- 11:30 UTC: 08:30 en horario de verano de Chile continental y 07:30 en invierno.
select cron.unschedule('jarvis-avisos-diarios')
where exists (select 1 from cron.job where jobname = 'jarvis-avisos-diarios');
select cron.schedule('jarvis-avisos-diarios', '30 11 * * *',
  $cron$select public.jarvis_generar_avisos();$cron$);

-- Estado de avance por materia: fuente documental independiente de las 25 gestiones anteriores.
-- Referencia inicial: Estado de Avance Santa Clara, 17-11-2026.
-- Migración aditiva; no altera compromisos_administracion ni sus evidencias.
create table if not exists public.estado_avance_materias (
  id uuid primary key default gen_random_uuid(),
  comunidad_id uuid not null references public.comunidades(id) on delete cascade,
  orden integer not null default 999 check (orden > 0),
  materia text not null check (length(trim(materia)) > 0),
  avance text not null default 'pendiente'
    check (avance in ('completado','en_curso','pendiente')),
  estado_detalle text not null default '',
  a_cargo_de text not null default '',
  fecha_informe date not null default ((now() at time zone 'America/Santiago')::date),
  publicado boolean not null default true,
  creado_por uuid default auth.uid() references auth.users(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint estado_avance_materias_unica unique (comunidad_id, materia)
);

create index if not exists estado_avance_materias_comunidad_orden_idx
  on public.estado_avance_materias (comunidad_id, orden, creado_en);

create or replace function public.estado_avance_materias_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

drop trigger if exists tr_estado_avance_materias_touch on public.estado_avance_materias;
create trigger tr_estado_avance_materias_touch
before update on public.estado_avance_materias
for each row execute function public.estado_avance_materias_touch();

alter table public.estado_avance_materias enable row level security;
grant select, insert, update on public.estado_avance_materias to authenticated;
revoke all on public.estado_avance_materias from anon;

create policy estado_materias_lectura on public.estado_avance_materias
for select to authenticated using (
  public.puede_gestionar_compromisos()
  or (
    publicado = true and exists (
      select 1 from public.portal_cliente_dashboard() d
      where d.comunidad_id::text = estado_avance_materias.comunidad_id::text
    )
  )
);
create policy estado_materias_creacion on public.estado_avance_materias
for insert to authenticated with check (public.puede_gestionar_compromisos());
create policy estado_materias_actualizacion on public.estado_avance_materias
for update to authenticated using (public.puede_gestionar_compromisos())
with check (public.puede_gestionar_compromisos());

-- Reproducción literal de las 12 materias, estados y responsables del informe.
-- Idempotente: no reemplaza ninguna edición realizada con posterioridad.
insert into public.estado_avance_materias
(comunidad_id, orden, materia, avance, estado_detalle, a_cargo_de, fecha_informe, publicado)
select c.id, datos.orden, datos.materia, datos.avance, datos.estado_detalle, datos.a_cargo_de, date '2026-11-17', true
from public.comunidades c
cross join (
  values
  (1,'Designación del primer administrador','completado','Escritura pública del 13 de octubre de 2026','Coproactiva'),
  (2,'RUT de la comunidad','completado','53.328.255-5','Coproactiva'),
  (3,'Cuenta corriente de la comunidad','completado','Habilitada. Banco Scotiabank, cuenta corriente terminada en 5450','Coproactiva'),
  (4,'Contraparte de la inmobiliaria','completado','Designadas Andrea Bugueño, Deyanira Flores y Nubia Hormazabal','Inmobiliaria'),
  (5,'Contrato de administración','en_curso','En revisión, con observaciones respondidas por ambas partes','Ambas partes'),
  (6,'Observaciones al reglamento de copropiedad','en_curso','Enviadas a la inmobiliaria el 26 de octubre de 2026','Inmobiliaria'),
  (7,'Visita inicial e informe de gestión del primer mes','completado','Realizados y enviados','Coproactiva'),
  (8,'Seguridad, conserjería y fondo operacional inicial','en_curso','Proyección enviada junto a este informe, con tres estándares de servicio. Pendiente la elección del estándar','Inmobiliaria'),
  (9,'Seguro colectivo contra incendio','pendiente','Por cotizar. Se contrata para la entrega de los bienes comunes','Coproactiva'),
  (10,'Plan de emergencia y evacuación','pendiente','Por elaborar. Incluido en el fondo operacional','Coproactiva'),
  (11,'Mantención de áreas verdes','pendiente','Cotización pendiente, tras la visita del proveedor','Coproactiva'),
  (12,'Entrega de los bienes comunes de la Etapa I','pendiente','Fecha por confirmar por la inmobiliaria','Inmobiliaria')
) as datos(orden,materia,avance,estado_detalle,a_cargo_de)
where c.nombre = 'Reserva Santa Clara'
on conflict (comunidad_id, materia) do nothing;

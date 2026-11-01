-- Documentos corporativos editables, vinculables a contextos y con versiones inmutables.
-- No reemplaza ni elimina propuestas comerciales históricas o archivos de Drive.
create table if not exists public.documentos_gestion (
 id uuid primary key default gen_random_uuid(),
 tipo text not null check(tipo in ('seguimiento_documental','primera_administracion','informe_gestion')),
 titulo text not null check(length(trim(titulo)) between 2 and 180),
 estado text not null default 'borrador'
   check(estado in ('borrador','en_revision','aprobado','emitido','archivado')),
 contexto_tipo text check(contexto_tipo in ('prospecto','comunidad','proveedor')),
 contexto_id uuid,
 contenido jsonb not null default '{}'::jsonb check(jsonb_typeof(contenido)='object' and pg_column_size(contenido)<120000),
 version integer not null default 1 check(version between 1 and 10000),
 creado_por uuid not null default auth.uid() references auth.users(id),
 actualizado_por uuid not null default auth.uid() references auth.users(id),
 creado_en timestamptz not null default now(),
 actualizado_en timestamptz not null default now(),
 constraint documentos_contexto_completo check((contexto_tipo is null)=(contexto_id is null))
);
create index if not exists documentos_gestion_contexto_idx on public.documentos_gestion(contexto_tipo,contexto_id);
create index if not exists documentos_gestion_ultimo_idx on public.documentos_gestion(actualizado_en desc);
create table if not exists public.documentos_versiones (
 id uuid primary key default gen_random_uuid(),
 documento_id uuid not null references public.documentos_gestion(id) on delete restrict,
 version integer not null check(version between 1 and 10000),
 titulo text not null,
 estado text not null,
 contenido jsonb not null,
 guardado_por uuid not null references auth.users(id),
 creado_en timestamptz not null default now(),
 unique(documento_id,version)
);
alter table public.documentos_gestion enable row level security;
alter table public.documentos_versiones enable row level security;
revoke all on public.documentos_gestion, public.documentos_versiones from anon, public;
grant select on public.documentos_gestion to authenticated;
grant select on public.documentos_versiones to authenticated;
drop policy if exists documentos_gestion_lectura on public.documentos_gestion;
create policy documentos_gestion_lectura on public.documentos_gestion
 for select to authenticated using (exists (
  select 1 from public.perfiles p where p.id=auth.uid() and p.activo
   and p.rol::text in ('superadmin','admin','jefatura')));
drop policy if exists documentos_gestion_insertar on public.documentos_gestion;
create policy documentos_gestion_insertar on public.documentos_gestion
 for insert to authenticated with check (creado_por=auth.uid() and actualizado_por=auth.uid()
  and exists(select 1 from public.perfiles p where p.id=auth.uid() and p.activo
   and p.rol::text in ('superadmin','admin','jefatura')));
drop policy if exists documentos_gestion_actualizar on public.documentos_gestion;
create policy documentos_gestion_actualizar on public.documentos_gestion
 for update to authenticated using (exists(
  select 1 from public.perfiles p where p.id=auth.uid() and p.activo
   and p.rol::text in ('superadmin','admin','jefatura')))
 with check (actualizado_por=auth.uid() and exists (
  select 1 from public.perfiles p where p.id=auth.uid() and p.activo
   and p.rol::text in ('superadmin','admin','jefatura')));
drop policy if exists documentos_versiones_lectura on public.documentos_versiones;
create policy documentos_versiones_lectura on public.documentos_versiones
 for select to authenticated using (exists(
  select 1 from public.documentos_gestion d where d.id=documento_id));
-- Todas las versiones deben crearse mediante RPC, nunca modificarse o eliminarse.
revoke insert,update,delete on public.documentos_versiones from authenticated;
revoke insert,update,delete on public.documentos_gestion from authenticated;
create or replace function public.guardar_documento_gestion(
 p_id uuid,p_tipo text,p_titulo text,p_estado text,p_contexto_tipo text,
 p_contexto_id uuid,p_contenido jsonb,p_version_esperada integer default null
) returns public.documentos_gestion
language plpgsql security definer set search_path=public,pg_temp as $
declare v_doc public.documentos_gestion; v_user uuid:=auth.uid();
begin
 if v_user is null then raise exception 'No autenticado' using errcode='28000'; end if;
 if not exists(select 1 from public.perfiles p where p.id=v_user and p.activo
   and p.rol::text in ('superadmin','admin','jefatura')) then
    raise exception 'No autorizado' using errcode='42501';
 end if;
 if p_tipo not in ('seguimiento_documental','primera_administracion','informe_gestion') or
    p_estado not in ('borrador','en_revision','aprobado','emitido','archivado') or
    length(trim(coalesce(p_titulo,''))) not between 2 and 180 or
    jsonb_typeof(p_contenido) is distinct from 'object' or
    pg_column_size(p_contenido)>120000 or
    (p_contexto_tipo is null) <> (p_contexto_id is null) or
    (p_contexto_tipo is not null and p_contexto_tipo not in ('prospecto','comunidad','proveedor'))
    then raise exception 'Documento inválido' using errcode='22023';
 end if;
 if p_contexto_tipo='prospecto' and not exists(select 1 from public.prospectos where id=p_contexto_id) or
    p_contexto_tipo='comunidad' and not exists(select 1 from public.comunidades where id=p_contexto_id) or
    p_contexto_tipo='proveedor' and not exists(select 1 from public.proveedores where id=p_contexto_id)
    then raise exception 'Contexto vinculado no encontrado' using errcode='22023';
 end if;
 if p_id is null then
  insert into public.documentos_gestion(tipo,titulo,estado,contexto_tipo,contexto_id,contenido,creado_por,actualizado_por)
  values(p_tipo,trim(p_titulo),p_estado,p_contexto_tipo,p_contexto_id,p_contenido,v_user,v_user)
  returning * into v_doc;
 else
  update public.documentos_gestion set
   titulo=trim(p_titulo),estado=p_estado,contenido=p_contenido,
   actualizado_por=v_user,actualizado_en=now(),version=version+1
  where id=p_id and tipo=p_tipo and version=p_version_esperada
    and contexto_tipo is not distinct from p_contexto_tipo
    and contexto_id is not distinct from p_contexto_id
  returning * into v_doc;
  if not found then raise exception 'Conflicto: el documento cambió. Recarga antes de guardar.' using errcode='P0001';end if;
 end if;
 insert into public.documentos_versiones(documento_id,version,titulo,estado,contenido,guardado_por)
 values(v_doc.id,v_doc.version,v_doc.titulo,v_doc.estado,v_doc.contenido,v_user);
 return v_doc;
end;$$;
revoke all on function public.guardar_documento_gestion(uuid,text,text,text,text,uuid,jsonb,integer) from public,anon;
grant execute on function public.guardar_documento_gestion(uuid,text,text,text,text,uuid,jsonb,integer) to authenticated;

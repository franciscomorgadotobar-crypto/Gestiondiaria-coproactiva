-- Historial: esta migración se aplicó en Supabase productivo el 20-11-2026.
-- Contenido del modelo corporativo administrable por usuarios comerciales autorizados.
create table if not exists public.plantillas_documentales_app (
 tipo text primary key check (tipo in ('propuesta_comercial','seguimiento_documental','primera_administracion','informe_gestion')),
 contenido jsonb not null default '{}'::jsonb check (jsonb_typeof(contenido)='object' and pg_column_size(contenido) < 120000),
 version integer not null default 1 check (version between 1 and 10000),
 actualizado_por uuid references auth.users(id),
 actualizado_en timestamptz not null default now()
);
alter table public.plantillas_documentales_app enable row level security;
revoke all on public.plantillas_documentales_app from anon,authenticated,public;
grant select on public.plantillas_documentales_app to authenticated;
drop policy if exists plantillas_documentales_app_lectura on public.plantillas_documentales_app;
create policy plantillas_documentales_app_lectura on public.plantillas_documentales_app
 for select to authenticated using (
  exists(select 1 from public.perfiles p where p.id=auth.uid() and p.activo
   and p.rol::text in ('superadmin','admin','jefatura'))
 );
create or replace function public.guardar_plantilla_documental_app(
 p_tipo text,p_contenido jsonb,p_version_esperada integer default null
) returns public.plantillas_documentales_app
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid:=auth.uid(); v_plantilla public.plantillas_documentales_app;
begin
 if v_user is null or not exists(
   select 1 from public.perfiles p where p.id=v_user and p.activo
   and p.rol::text in ('superadmin','admin','jefatura')
 ) then raise exception 'Sin autorización para editar plantillas' using errcode='42501'; end if;
 if p_tipo not in ('propuesta_comercial','seguimiento_documental','primera_administracion','informe_gestion')
   or jsonb_typeof(p_contenido) is distinct from 'object'
   or pg_column_size(p_contenido)>=120000
 then raise exception 'Plantilla inválida' using errcode='22023'; end if;
 select * into v_plantilla from public.plantillas_documentales_app where tipo=p_tipo for update;
 if found then
   if p_version_esperada is distinct from v_plantilla.version then
     raise exception 'Esta plantilla fue modificada por otra persona. Recarga antes de guardar.'
     using errcode='P0001';
   end if;
   update public.plantillas_documentales_app
    set contenido=p_contenido,version=version+1,actualizado_por=v_user,actualizado_en=now()
    where tipo=p_tipo returning * into v_plantilla;
 else
   if p_version_esperada is not null then
     raise exception 'La plantilla fue creada por otra persona. Recarga antes de guardar.'
     using errcode='P0001';
   end if;
   insert into public.plantillas_documentales_app(tipo,contenido,actualizado_por)
    values(p_tipo,p_contenido,v_user) returning * into v_plantilla;
 end if;
 return v_plantilla;
end;$$;
revoke all on function public.guardar_plantilla_documental_app(text,jsonb,integer) from public,anon;
grant execute on function public.guardar_plantilla_documental_app(text,jsonb,integer) to authenticated;

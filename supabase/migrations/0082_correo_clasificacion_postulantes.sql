-- Reuse the existing applicant table and email history; files stay in Gmail.
-- This table existed in production without a tracked migration.
create table if not exists public.postulantes (
 id uuid primary key default gen_random_uuid(),nombre text not null,email text,telefono text,cargo_propuesto text,experiencia_resumen text,comuna text,
 tiene_cv_adjunto boolean not null default false,estado text not null default 'nuevo',notas text,gmail_thread_id text unique,fecha_postulacion timestamptz,
 creado_en timestamptz not null default now(),editado_en timestamptz not null default now()
);
alter table public.postulantes add column if not exists origen text not null default 'correo';
alter table public.proveedor_correos add column if not exists postulante_id uuid references public.postulantes(id);
alter table public.proveedor_correos add column if not exists clasificacion text check(clasificacion in ('proveedor','postulante','otro'));
alter table public.proveedor_correos add column if not exists clasificado_por uuid references public.perfiles(id);
alter table public.proveedor_correos add column if not exists clasificado_en timestamptz;
update public.proveedor_correos set clasificacion='proveedor' where proveedor_id is not null and clasificacion is null;
create index if not exists proveedor_correos_postulante on public.proveedor_correos(postulante_id) where postulante_id is not null;
create index if not exists proveedor_correos_pendientes on public.proveedor_correos(fecha_correo desc) where clasificacion is null;
do $$declare c record;begin
 for c in select conname from pg_constraint where conrelid='public.postulantes'::regclass and contype='c' and pg_get_constraintdef(oid) like '%estado%' loop
  execute format('alter table public.postulantes drop constraint %I',c.conname);
 end loop;
end;$$;
alter table public.postulantes add constraint postulantes_estado_check check(estado in ('nuevo','revisado','contactado','entrevista','contratado','descartado','base_futura'));
alter table public.postulantes enable row level security;
-- Restrictive policy also excludes inactive accounts regardless of old permissive policies.
create policy postulantes_admin_activo on public.postulantes as restrictive for all to authenticated using(public.whatsapp_es_admin()) with check(public.whatsapp_es_admin());
create policy postulantes_admin_gestion on public.postulantes for all to authenticated using(public.whatsapp_es_admin()) with check(public.whatsapp_es_admin());
create policy correos_admin_activo on public.proveedor_correos as restrictive for all to authenticated using(public.whatsapp_es_admin()) with check(public.whatsapp_es_admin());
grant select,insert,update on public.postulantes to authenticated;

create or replace function public.clasificar_correo_contacto(p_correo uuid,p_clase text,p_nombre text,p_destino uuid default null) returns uuid language plpgsql security definer set search_path=public as $$
declare e public.proveedor_correos;v_id uuid;begin
 if not public.whatsapp_es_admin() then raise exception 'Sin permiso';end if;
 if p_clase not in ('proveedor','postulante','otro') then raise exception 'Clasificación no válida';end if;
 select * into e from public.proveedor_correos where id=p_correo for update;
 if e.id is null then raise exception 'Correo inexistente';end if;
 if e.clasificacion is not null then raise exception 'Correo ya clasificado';end if;
 if p_clase<>'otro' and nullif(btrim(p_nombre),'') is null then raise exception 'Nombre requerido';end if;
 if e.remitente_email is not null then perform pg_advisory_xact_lock(hashtextextended('correo-clasificacion:'||lower(e.remitente_email),0));end if;
 if p_clase='postulante' then
   v_id:=p_destino;
   if v_id is not null and not exists(select 1 from public.postulantes where id=v_id) then raise exception 'Postulante inexistente';end if;
   if v_id is null then
     select id into v_id from public.postulantes where lower(email)=lower(e.remitente_email) or (e.gmail_thread_id is not null and gmail_thread_id=e.gmail_thread_id) order by creado_en limit 1;
   end if;
   if v_id is null then
     insert into public.postulantes(nombre,email,telefono,cargo_propuesto,comuna,tiene_cv_adjunto,notas,gmail_thread_id,fecha_postulacion,origen)
     values(btrim(p_nombre),e.remitente_email,e.datos_extraidos->'telefonos'->>0,null,null,jsonb_array_length(e.adjuntos)>0,e.snippet,e.gmail_thread_id,e.fecha_correo,'correo') returning id into v_id;
   else
     update public.postulantes set tiene_cv_adjunto=tiene_cv_adjunto or jsonb_array_length(e.adjuntos)>0,editado_en=now() where id=v_id;
   end if;
   update public.proveedor_correos set postulante_id=v_id,proveedor_id=null where id=e.id;
 elsif p_clase='proveedor' then
   v_id:=p_destino;
   if v_id is not null and not exists(select 1 from public.proveedores where id=v_id) then raise exception 'Proveedor inexistente';end if;
   if v_id is null then
     select id into v_id from public.proveedores where lower(email)=lower(e.remitente_email) or (e.gmail_thread_id is not null and gmail_thread_id=e.gmail_thread_id) order by creado_en limit 1;
   end if;
   if v_id is null then
     insert into public.proveedores(empresa,contacto_nombre,email,telefono,rut,rubro,servicios,origen,gmail_thread_id,notas,creado_por)
     values(btrim(p_nombre),e.remitente_nombre,e.remitente_email,e.datos_extraidos->'telefonos'->>0,e.datos_extraidos->>'rut','Por clasificar',null,'correo',e.gmail_thread_id,e.snippet,auth.uid()) returning id into v_id;
   end if;
   update public.proveedor_correos set proveedor_id=v_id,postulante_id=null where id=e.id;
   insert into public.proveedor_interacciones(proveedor_id,canal,detalle,realizado_por) values(v_id,'correo','Presentación de servicios recibida y clasificada. Correo: '||e.id::text,auth.uid());
 end if;
 update public.proveedor_correos set clasificacion=p_clase,clasificado_por=auth.uid(),clasificado_en=now() where id=e.id;
 return v_id;
end; $$;
revoke all on function public.clasificar_correo_contacto(uuid,text,text,uuid) from public,anon;
grant execute on function public.clasificar_correo_contacto(uuid,text,text,uuid) to authenticated;
comment on table public.proveedor_correos is 'Historial compartido de correos clasificados por administración como proveedor o postulante. Los adjuntos nuevos permanecen exclusivamente en Gmail.';

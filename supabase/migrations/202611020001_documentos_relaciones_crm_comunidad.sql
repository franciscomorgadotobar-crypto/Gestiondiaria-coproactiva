-- Vínculo bidireccional desde Gestor Documental <-> Comunidad y CRM (prospectos).
-- Cambio aditivo: compatible con los documentos/contextos existentes y con la RPC antigua.
alter table public.documentos_gestion
 add column if not exists prospecto_id uuid references public.prospectos(id) on delete set null,
 add column if not exists comunidad_id uuid references public.comunidades(id) on delete set null;

create index if not exists documentos_gestion_prospecto_idx on public.documentos_gestion(prospecto_id) where prospecto_id is not null;
create index if not exists documentos_gestion_comunidad_idx on public.documentos_gestion(comunidad_id) where comunidad_id is not null;

-- Históricos: conservar el contexto legado, y exponerlo como relación explícita.
update public.documentos_gestion set
 prospecto_id=case when contexto_tipo='prospecto' then contexto_id else prospecto_id end,
 comunidad_id=case when contexto_tipo='comunidad' then contexto_id else comunidad_id end
where (contexto_tipo='prospecto' and prospecto_id is null)
   or (contexto_tipo='comunidad' and comunidad_id is null);

-- Guardar documento + sus DOS vínculos en una única transacción.
-- La RPC previa mantiene toda la lógica de permisos, versiones e integridad,
-- y sigue disponible para versiones antiguas de la app.
create or replace function public.guardar_documento_con_relaciones(
 p_id uuid,
 p_tipo text,
 p_titulo text,
 p_estado text,
 p_contenido jsonb,
 p_version_esperada integer default null,
 p_prospecto_id uuid default null,
 p_comunidad_id uuid default null
) returns public.documentos_gestion
language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_doc public.documentos_gestion;
 v_contexto_tipo text;
 v_contexto_id uuid;
begin
 if auth.uid() is null then raise exception 'No autenticado' using errcode='28000'; end if;
 if p_prospecto_id is not null and not exists(
   select 1 from public.prospectos where id=p_prospecto_id
 ) then raise exception 'El lead seleccionado no existe' using errcode='22023'; end if;
 if p_comunidad_id is not null and not exists(
   select 1 from public.comunidades where id=p_comunidad_id
 ) then raise exception 'La comunidad seleccionada no existe' using errcode='22023'; end if;

 if p_id is null then
  v_contexto_tipo=case when p_comunidad_id is not null then 'comunidad'
                       when p_prospecto_id is not null then 'prospecto' end;
  v_contexto_id=coalesce(p_comunidad_id,p_prospecto_id);
 else
  select contexto_tipo,contexto_id into v_contexto_tipo,v_contexto_id
  from public.documentos_gestion where id=p_id for update;
  if not found then raise exception 'Documento no encontrado' using errcode='22023'; end if;
 end if;

 -- No modifica ni salta autorización ni control de versión de la RPC existente.
 v_doc:=public.guardar_documento_gestion(
   p_id,p_tipo,p_titulo,p_estado,v_contexto_tipo,v_contexto_id,p_contenido,p_version_esperada
 );

 update public.documentos_gestion set
   prospecto_id=p_prospecto_id,
   comunidad_id=p_comunidad_id,
   contexto_tipo=case
      when v_contexto_tipo='proveedor' then v_contexto_tipo
      when p_comunidad_id is not null then 'comunidad'
      when p_prospecto_id is not null then 'prospecto'
      else null end,
   contexto_id=case
      when v_contexto_tipo='proveedor' then v_contexto_id
      else coalesce(p_comunidad_id,p_prospecto_id) end
 where id=v_doc.id
 returning * into v_doc;

 return v_doc;
end;$$;

revoke all on function public.guardar_documento_con_relaciones(uuid,text,text,text,jsonb,integer,uuid,uuid)
 from public,anon;
grant execute on function public.guardar_documento_con_relaciones(uuid,text,text,text,jsonb,integer,uuid,uuid)
 to authenticated;

-- Ningún INSERT/UPDATE directo por el cliente: sólo la RPC autorizada.
revoke insert,update,delete on public.documentos_gestion from anon,authenticated;
-- La política select actual continúa vigente y se aplica a ambos vínculos.

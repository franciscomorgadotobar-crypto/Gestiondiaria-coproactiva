-- Vista de cliente interna: se simula exclusivamente una cuenta cliente vinculada.
-- Todas las consultas son de solo lectura y la sesión del personal no cambia.
CREATE OR REPLACE FUNCTION public.vista_cliente_puede_ver_comunidad(
 p_comunidad uuid,p_usuario_cliente uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT public.mi_rol()::text IN ('superadmin','admin','jefatura')
 AND EXISTS(SELECT 1 FROM public.portal_cliente_comunidades pc
 JOIN public.perfiles p ON p.id=pc.usuario_id
 WHERE pc.comunidad_id=p_comunidad AND pc.usuario_id=p_usuario_cliente
 AND pc.activa AND p.activo AND p.rol::text='cliente');
$$;
CREATE OR REPLACE FUNCTION public.vista_cliente_puede_ver_plantilla(
 p_comunidad uuid,p_plantilla uuid,p_usuario_cliente uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT public.vista_cliente_puede_ver_comunidad(p_comunidad,p_usuario_cliente)
 AND EXISTS(SELECT 1 FROM public.portal_cliente_plantillas pp
 WHERE pp.comunidad_id=p_comunidad AND pp.plantilla_id=p_plantilla
 AND pp.usuario_id=p_usuario_cliente AND pp.visible);
$$;
CREATE OR REPLACE FUNCTION public.vista_cliente_cuentas(p_comunidad_id uuid)
RETURNS TABLE(cliente_id uuid,cliente_nombre text,cliente_email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT p.id,p.nombre,p.email FROM public.portal_cliente_comunidades pc
 JOIN public.perfiles p ON p.id=pc.usuario_id
 WHERE pc.comunidad_id=p_comunidad_id AND pc.activa
 AND p.activo AND p.rol::text='cliente'
 AND public.mi_rol()::text IN ('superadmin','admin','jefatura')
 ORDER BY p.nombre;
$$;
CREATE OR REPLACE FUNCTION public.vista_cliente_documentos(p_comunidad_id uuid, p_usuario_cliente uuid)
 RETURNS TABLE(id text, referencia_id text, origen text, titulo text, nombre_archivo text, tipo_mime text, fecha text, url text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.vista_cliente_puede_ver_comunidad(p_comunidad_id,p_usuario_cliente) then
    raise exception 'No tienes acceso a esta comunidad.';
  end if;

  -- PDF/informe guardado directamente en el registro del levantamiento.
  return query
  with cp as (
    select c.id, c.plantilla_id, p.nombre as plantilla_nombre, to_jsonb(c) as jc
    from public.controles c
    join public.plantillas_control p on p.id = c.plantilla_id
    where c.comunidad_id = p_comunidad_id
      and c.estado::text <> 'anulado'
      and public.vista_cliente_puede_ver_plantilla(c.comunidad_id, c.plantilla_id,p_usuario_cliente)
  )
  select
    'control-' || cp.id::text,
    cp.id::text,
    'Levantamiento'::text,
    ('Informe ' || cp.plantilla_nombre)::text,
    coalesce(
      nullif(cp.jc->>'pdf_nombre', ''),
      nullif(cp.jc->>'nombre_pdf', ''),
      ('Informe ' || cp.plantilla_nombre || '.pdf')::text
    ),
    'application/pdf'::text,
    coalesce(
      nullif(cp.jc->>'enviado_en', ''),
      nullif(cp.jc->>'finalizado_en', ''),
      nullif(cp.jc->>'actualizado_en', ''),
      nullif(cp.jc->>'creado_en', '')
    ),
    coalesce(
      nullif(cp.jc->>'pdf_url', ''),
      nullif(cp.jc->>'informe_pdf_url', ''),
      nullif(cp.jc->>'informe_url', ''),
      nullif(cp.jc->>'documento_url', '')
    )
  from cp
  where coalesce(
    nullif(cp.jc->>'pdf_url', ''),
    nullif(cp.jc->>'informe_pdf_url', ''),
    nullif(cp.jc->>'informe_url', ''),
    nullif(cp.jc->>'documento_url', '')
  ) is not null;

  -- Adjuntos relacionados a levantamientos. Se leen como JSON para tolerar
  -- variantes de nombres de columnas entre migraciones históricas.
  if to_regclass('public.control_adjuntos') is not null then
    return query
    with cp as (
      select c.id, p.nombre as plantilla_nombre
      from public.controles c
      join public.plantillas_control p on p.id = c.plantilla_id
      where c.comunidad_id = p_comunidad_id
        and c.estado::text <> 'anulado'
        and public.vista_cliente_puede_ver_plantilla(c.comunidad_id, c.plantilla_id,p_usuario_cliente)
    ),
    ca as (
      select to_jsonb(x) as jca
      from public.control_adjuntos x
    ),
    enlazados as (
      select
        cp.id as control_id,
        cp.plantilla_nombre,
        ca.jca,
        public.portal_adjunto_json(coalesce(ca.jca->>'adjunto_id', ca.jca->>'archivo_id')) as ja
      from ca
      join cp on cp.id = coalesce(
        public.portal_texto_uuid(ca.jca->>'control_id'),
        public.portal_texto_uuid(ca.jca->>'levantamiento_id')
      )
    )
    select
      coalesce(e.jca->>'id', e.control_id::text || '-' || md5(e.jca::text)),
      e.control_id::text,
      'Levantamiento'::text,
      coalesce(
        nullif(e.ja->>'titulo', ''),
        nullif(e.jca->>'titulo', ''),
        ('Informe ' || e.plantilla_nombre)::text
      ),
      coalesce(
        nullif(e.ja->>'nombre_archivo', ''),
        nullif(e.ja->>'nombre', ''),
        nullif(e.ja->>'archivo', ''),
        nullif(e.jca->>'nombre_archivo', ''),
        nullif(e.jca->>'nombre', '')
      ),
      coalesce(
        nullif(e.ja->>'tipo_mime', ''),
        nullif(e.ja->>'mime_type', ''),
        nullif(e.ja->>'tipo', ''),
        nullif(e.jca->>'tipo_mime', ''),
        nullif(e.jca->>'mime_type', '')
      ),
      coalesce(
        nullif(e.ja->>'creado_en', ''),
        nullif(e.ja->>'created_at', ''),
        nullif(e.jca->>'creado_en', ''),
        nullif(e.jca->>'created_at', '')
      ),
      coalesce(
        nullif(e.ja->>'url', ''),
        nullif(e.ja->>'public_url', ''),
        nullif(e.ja->>'archivo_url', ''),
        nullif(e.ja->>'enlace', ''),
        nullif(e.jca->>'url', ''),
        nullif(e.jca->>'public_url', ''),
        nullif(e.jca->>'archivo_url', ''),
        nullif(e.jca->>'enlace', '')
      )
    from enlazados e
    where coalesce(
      nullif(e.ja->>'url', ''),
      nullif(e.ja->>'public_url', ''),
      nullif(e.ja->>'archivo_url', ''),
      nullif(e.ja->>'enlace', ''),
      nullif(e.jca->>'url', ''),
      nullif(e.jca->>'public_url', ''),
      nullif(e.jca->>'archivo_url', ''),
      nullif(e.jca->>'enlace', '')
    ) is not null;
  end if;

  -- Adjuntos que enlazan directamente al control sin tabla intermedia.
  if to_regclass('public.adjuntos') is not null then
    return query
    with cp as (
      select c.id, p.nombre as plantilla_nombre
      from public.controles c
      join public.plantillas_control p on p.id = c.plantilla_id
      where c.comunidad_id = p_comunidad_id
        and c.estado::text <> 'anulado'
        and public.vista_cliente_puede_ver_plantilla(c.comunidad_id, c.plantilla_id,p_usuario_cliente)
    ),
    aa as (
      select to_jsonb(a) as ja
      from public.adjuntos a
    )
    select
      coalesce(aa.ja->>'id', cp.id::text || '-' || md5(aa.ja::text)),
      cp.id::text,
      'Levantamiento'::text,
      coalesce(nullif(aa.ja->>'titulo', ''), nullif(aa.ja->>'descripcion', ''), ('Informe ' || cp.plantilla_nombre)::text),
      coalesce(nullif(aa.ja->>'nombre_archivo', ''), nullif(aa.ja->>'nombre', ''), nullif(aa.ja->>'archivo', ''), nullif(aa.ja->>'nombre_original', '')),
      coalesce(nullif(aa.ja->>'tipo_mime', ''), nullif(aa.ja->>'mime_type', ''), nullif(aa.ja->>'tipo', ''), nullif(aa.ja->>'mime', '')),
      coalesce(nullif(aa.ja->>'creado_en', ''), nullif(aa.ja->>'created_at', '')),
      coalesce(nullif(aa.ja->>'url', ''), nullif(aa.ja->>'public_url', ''), nullif(aa.ja->>'archivo_url', ''), nullif(aa.ja->>'enlace', ''))
    from aa
    join cp on cp.id = coalesce(
      public.portal_texto_uuid(aa.ja->>'control_id'),
      public.portal_texto_uuid(aa.ja->>'levantamiento_id')
    )
    where coalesce(nullif(aa.ja->>'url', ''), nullif(aa.ja->>'public_url', ''), nullif(aa.ja->>'archivo_url', ''), nullif(aa.ja->>'enlace', '')) is not null;
  end if;

  -- Respaldo principal y evidencias URL de mantenciones realizadas.
  if to_regclass('public.ejecuciones_mantenimiento') is not null then
    return query
    select
      'mant-' || e.id::text,
      a.id::text,
      'Mantención'::text,
      ('Respaldo ' || ac.nombre || ': ' || a.trabajo)::text,
      null::text,
      null::text,
      e.realizado_en::text,
      e.respaldo_url::text
    from public.ejecuciones_mantenimiento e
    join public.mantenimiento_actividades a on a.id = e.actividad_id
    join public.activos_comunidad ac on ac.id = a.activo_id
    where a.comunidad_id = p_comunidad_id
      and e.respaldo_url is not null
      and btrim(e.respaldo_url) <> '';

    return query
    select
      'mant-evid-' || e.id::text || '-' || md5(ev.valor),
      a.id::text,
      'Mantención'::text,
      ('Evidencia ' || ac.nombre || ': ' || a.trabajo)::text,
      null::text,
      null::text,
      e.realizado_en::text,
      ev.valor
    from public.ejecuciones_mantenimiento e
    join public.mantenimiento_actividades a on a.id = e.actividad_id
    join public.activos_comunidad ac on ac.id = a.activo_id
    cross join lateral jsonb_array_elements_text(
      case when jsonb_typeof(e.evidencias) = 'array' then e.evidencias else '[]'::jsonb end
    ) as ev(valor)
    where a.comunidad_id = p_comunidad_id
      and ev.valor is not null
      and btrim(ev.valor) <> ''
      and ev.valor <> coalesce(e.respaldo_url, '');
  end if;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.vista_cliente_incidencias(p_comunidad_id uuid, p_usuario_cliente uuid)
 RETURNS TABLE(id text, control_id uuid, titulo text, descripcion text, estado text, prioridad text, creado_en text, programado_para text, resuelto_en text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.vista_cliente_puede_ver_comunidad(p_comunidad_id,p_usuario_cliente) then
    raise exception 'No tienes acceso a esta comunidad.';
  end if;

  if to_regclass('public.hallazgos') is null then
    return;
  end if;

  return query
  with base as (
    select to_jsonb(h) as jh
    from public.hallazgos h
  ),
  contexto as (
    select
      b.jh,
      coalesce(
        public.portal_texto_uuid(b.jh->>'control_id'),
        public.portal_texto_uuid(b.jh->>'levantamiento_id'),
        (
          select public.portal_texto_uuid(to_jsonb(ci)->>'control_id')
          from public.control_items ci
          where to_jsonb(ci)->>'id' = coalesce(b.jh->>'control_item_id', b.jh->>'item_control_id')
          limit 1
        )
      ) as control_resuelto,
      coalesce(
        public.portal_texto_uuid(b.jh->>'comunidad_id'),
        (
          select c.comunidad_id
          from public.controles c
          where c.id = coalesce(
            public.portal_texto_uuid(b.jh->>'control_id'),
            public.portal_texto_uuid(b.jh->>'levantamiento_id')
          )
          limit 1
        ),
        (
          select c.comunidad_id
          from public.control_items ci
          join public.controles c
            on c.id = public.portal_texto_uuid(to_jsonb(ci)->>'control_id')
          where to_jsonb(ci)->>'id' = coalesce(b.jh->>'control_item_id', b.jh->>'item_control_id')
          limit 1
        )
      ) as comunidad_resuelta
    from base b
  ),
  enriquecida as (
    select
      c.*,
      public.portal_ultima_orden_json(c.jh->>'id') as jo
    from contexto c
  )
  select
    coalesce(e.jh->>'id', md5(e.jh::text)),
    e.control_resuelto,
    coalesce(
      nullif(e.jo->>'titulo', ''),
      nullif(e.jh->>'titulo', ''),
      nullif(e.jh->>'nombre', ''),
      nullif(e.jh->>'tipo', ''),
      'Incidencia'
    ),
    coalesce(
      nullif(e.jo->>'descripcion', ''),
      nullif(e.jo->>'detalle', ''),
      nullif(e.jh->>'descripcion', ''),
      nullif(e.jh->>'detalle', ''),
      nullif(e.jh->>'observacion', ''),
      nullif(e.jh->>'respuesta', '')
    ),
    coalesce(
      nullif(e.jo->>'estado', ''),
      nullif(e.jh->>'estado', ''),
      case
        -- hallazgos no tiene una columna de estado propia: resuelto_en (real
        -- en este esquema) es la señal directa. resuelto/cerrado quedan como
        -- respaldo por si alguna variante del esquema los usa.
        when e.jh->>'resuelto_en' is not null
          or lower(coalesce(e.jh->>'resuelto', e.jh->>'cerrado', 'false')) in ('true','t','1','si','sí')
          then 'resuelta'
        else 'pendiente'
      end
    ),
    coalesce(
      nullif(e.jo->>'prioridad', ''),
      nullif(e.jh->>'prioridad', ''),
      nullif(e.jh->>'criticidad', ''),
      nullif(e.jh->>'severidad', '')
    ),
    coalesce(
      nullif(e.jh->>'creado_en', ''),
      nullif(e.jh->>'created_at', ''),
      nullif(e.jh->>'fecha', '')
    ),
    coalesce(
      nullif(e.jo->>'programado_para', ''),
      nullif(e.jo->>'fecha_programada', ''),
      nullif(e.jo->>'agendado_para', ''),
      nullif(e.jo->>'vence_el', ''),
      nullif(e.jh->>'programado_para', ''),
      nullif(e.jh->>'fecha_programada', '')
    ),
    coalesce(
      nullif(e.jo->>'resuelto_en', ''),
      nullif(e.jo->>'cerrada_en', ''),
      nullif(e.jo->>'cerrado_en', ''),
      nullif(e.jo->>'completado_en', ''),
      nullif(e.jh->>'resuelto_en', ''),
      nullif(e.jh->>'cerrado_en', ''),
      nullif(e.jh->>'updated_at', '')
    )
  from enriquecida e
  where e.comunidad_resuelta = p_comunidad_id
    and (
      e.control_resuelto is null
      or exists (
        select 1
        from public.controles c
        where c.id = e.control_resuelto
          and c.comunidad_id = p_comunidad_id
          and public.vista_cliente_puede_ver_plantilla(c.comunidad_id, c.plantilla_id,p_usuario_cliente)
      )
    )
  order by coalesce(
    nullif(e.jo->>'resuelto_en', ''),
    nullif(e.jo->>'programado_para', ''),
    nullif(e.jh->>'creado_en', ''),
    nullif(e.jh->>'created_at', '')
  ) desc nulls last;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.vista_cliente_levantamientos(p_comunidad_id uuid, p_usuario_cliente uuid)
 RETURNS TABLE(id uuid, comunidad_id uuid, plantilla_id uuid, plantilla_nombre text, estado text, periodo text, programado_para timestamp with time zone, creado_en timestamp with time zone, checkin_en timestamp with time zone, enviado_en timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.vista_cliente_puede_ver_comunidad(p_comunidad_id,p_usuario_cliente) then
    raise exception 'No tienes acceso a esta comunidad.';
  end if;

  return query
  select
    c.id,
    c.comunidad_id,
    c.plantilla_id,
    p.nombre,
    c.estado::text,
    c.periodo,
    c.programado_para,
    c.creado_en,
    c.checkin_en,
    c.enviado_en
  from public.controles c
  join public.plantillas_control p on p.id = c.plantilla_id
  where c.comunidad_id = p_comunidad_id
    and c.estado::text <> 'anulado'
    and public.vista_cliente_puede_ver_plantilla(c.comunidad_id, c.plantilla_id,p_usuario_cliente)
  order by coalesce(c.programado_para, c.creado_en) desc;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.vista_cliente_mantenciones(p_comunidad_id uuid, p_usuario_cliente uuid)
 RETURNS TABLE(actividad_id uuid, activo_nombre text, activo_categoria text, trabajo text, frecuencia_unidad text, frecuencia_valor integer, proxima_exigible date, proveedor text, agendamiento_id uuid, programado_para timestamp with time zone, vencimiento_original date, estado_agendamiento text, ultima_ejecucion timestamp with time zone, ejecutor text, observaciones text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.vista_cliente_puede_ver_comunidad(p_comunidad_id,p_usuario_cliente) then
    raise exception 'No tienes acceso a esta comunidad.';
  end if;

  return query
  select
    a.id,
    ac.nombre,
    ac.categoria,
    a.trabajo,
    a.frecuencia_unidad,
    a.frecuencia_valor,
    a.proxima_exigible,
    a.proveedor,
    ag.id,
    ag.programado_para,
    ag.vencimiento_original,
    ag.estado::text,
    ex.realizado_en,
    ex.ejecutor_texto,
    ex.observaciones
  from public.mantenimiento_actividades a
  join public.activos_comunidad ac on ac.id = a.activo_id
  left join lateral (
    select x.*
    from public.mantenimiento_agendamientos x
    where x.actividad_id = a.id
      and x.estado in ('agendada','en_curso')
    order by x.programado_para asc
    limit 1
  ) ag on true
  left join lateral (
    select e.realizado_en, e.ejecutor_texto, e.observaciones
    from public.ejecuciones_mantenimiento e
    where e.actividad_id = a.id
    order by e.realizado_en desc
    limit 1
  ) ex on true
  where a.comunidad_id = p_comunidad_id
    and a.activa
  order by coalesce(a.proxima_exigible, ag.programado_para::date) nulls last, ac.nombre, a.trabajo;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.vista_cliente_requerimientos(p_comunidad_id uuid, p_usuario_cliente uuid)
 RETURNS TABLE(id uuid, nombre text, plantilla_id uuid, plantilla_nombre text, proxima_exigible date, tiene_agendamiento boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.vista_cliente_puede_ver_comunidad(p_comunidad_id,p_usuario_cliente) then
    raise exception 'No tienes acceso a esta comunidad.';
  end if;

  return query
  select
    r.id,
    r.nombre,
    r.plantilla_id,
    p.nombre,
    r.proxima_exigible,
    exists (
      select 1
      from public.controles c
      where c.comunidad_id = r.comunidad_id
        and c.plantilla_id = r.plantilla_id
        and c.estado::text not in ('enviado','anulado')
        and c.programado_para is not null
    ) as tiene_agendamiento
  from public.levantamiento_requerimientos r
  join public.plantillas_control p on p.id = r.plantilla_id
  where r.comunidad_id = p_comunidad_id
    and r.activa
    and public.vista_cliente_puede_ver_plantilla(r.comunidad_id, r.plantilla_id,p_usuario_cliente)
  order by r.proxima_exigible nulls last, r.nombre;
end;
$function$
;
REVOKE EXECUTE ON FUNCTION public.vista_cliente_documentos(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vista_cliente_documentos(uuid,uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.vista_cliente_incidencias(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vista_cliente_incidencias(uuid,uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.vista_cliente_levantamientos(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vista_cliente_levantamientos(uuid,uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.vista_cliente_mantenciones(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vista_cliente_mantenciones(uuid,uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.vista_cliente_requerimientos(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vista_cliente_requerimientos(uuid,uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.vista_cliente_cuentas(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vista_cliente_cuentas(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.vista_cliente_puede_ver_comunidad(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vista_cliente_puede_ver_comunidad(uuid,uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.vista_cliente_puede_ver_plantilla(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vista_cliente_puede_ver_plantilla(uuid,uuid,uuid) TO authenticated;

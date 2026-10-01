-- Plantillas creadas desde el Excel de la app, todas en una sola transacción.
--
-- La app lee el archivo, revisa fila por fila y muestra la vista previa; esto
-- recibe lo ya interpretado y lo inserta de una vez. Si algo falla a mitad de
-- camino no queda una plantilla a medias, ni la mitad de las plantillas de un
-- archivo creadas y la otra mitad no: se corrige y se vuelve a importar.
--
-- security invoker: las inserciones pasan por las mismas políticas que el
-- editor (plantillas_creacion y plantilla_items_escritura). La revisión de
-- rol de acá está para devolver un mensaje claro, no es la que protege.
--
-- p_plantillas: [{ "nombre": "...", "items": [{ "grupo", "orden_grupo",
--   "orden", "texto", "ayuda", "tipo_ingreso", "config", "requiere_foto",
--   "obligatorio", "es_critico" }] }]
-- Devuelve los id de las plantillas creadas, en el mismo orden.

create or replace function public.importar_plantillas(p_plantillas jsonb)
returns uuid[]
language plpgsql
security invoker
set search_path to 'public'
as $$
declare
  v_plantilla jsonb;
  v_nombre text;
  v_id uuid;
  v_ids uuid[] := '{}';
  v_puntos integer := 0;
begin
  if not (es_admin() or mi_rol() = 'jefatura') then
    raise exception 'No tienes permiso para crear plantillas.' using errcode = '42501';
  end if;

  if jsonb_typeof(p_plantillas) is distinct from 'array' or jsonb_array_length(p_plantillas) = 0 then
    raise exception 'No hay plantillas para importar.' using errcode = '22023';
  end if;

  for v_plantilla in select value from jsonb_array_elements(p_plantillas) loop
    v_nombre := nullif(trim(v_plantilla->>'nombre'), '');
    if v_nombre is null then
      raise exception 'Hay una plantilla sin nombre.' using errcode = '23514';
    end if;

    if jsonb_typeof(v_plantilla->'items') is distinct from 'array'
       or jsonb_array_length(v_plantilla->'items') = 0 then
      raise exception 'La plantilla "%" no tiene puntos.', v_nombre using errcode = '23514';
    end if;

    if exists (
      select 1 from jsonb_array_elements(v_plantilla->'items') as i
      where nullif(trim(i->>'grupo'), '') is null or nullif(trim(i->>'texto'), '') is null
    ) then
      raise exception 'La plantilla "%" tiene puntos sin categoría o sin pregunta.', v_nombre
        using errcode = '23514';
    end if;

    -- El mismo tope que revisa la app: un archivo no crea más de 2000 puntos.
    v_puntos := v_puntos + jsonb_array_length(v_plantilla->'items');
    if v_puntos > 2000 then
      raise exception 'Se pueden importar hasta 2000 puntos de una vez.' using errcode = '54000';
    end if;

    insert into plantillas_control (nombre, creado_por)
    values (v_nombre, auth.uid())
    returning id into v_id;

    insert into plantilla_items (plantilla_id, grupo, orden_grupo, orden, texto, ayuda,
                                 tipo_ingreso, config, requiere_foto, obligatorio, es_critico)
    select v_id,
           trim(i->>'grupo'),
           coalesce((i->>'orden_grupo')::integer, 0),
           coalesce((i->>'orden')::integer, 0),
           trim(i->>'texto'),
           nullif(trim(i->>'ayuda'), ''),
           coalesce((i->>'tipo_ingreso')::tipo_ingreso, 'estado'),
           case when jsonb_typeof(i->'config') = 'object' then i->'config' else '{}'::jsonb end,
           coalesce((i->>'requiere_foto')::boolean, false),
           coalesce((i->>'obligatorio')::boolean, true),
           coalesce((i->>'es_critico')::boolean, false)
    from jsonb_array_elements(v_plantilla->'items') as i;

    v_ids := v_ids || v_id;
  end loop;

  return v_ids;
end;
$$;

revoke all on function public.importar_plantillas(jsonb) from public, anon;
grant execute on function public.importar_plantillas(jsonb) to authenticated;

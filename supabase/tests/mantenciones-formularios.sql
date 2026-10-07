begin;
do $$
declare admin_id uuid;old_role public.rol_usuario;old_active boolean;community uuid;other_community uuid;asset uuid;activity uuid;template_one uuid;template_two uuid;empty_template uuid;private_template uuid;diagnostic uuid;visit uuid;control_one uuid;control_two uuid;v_role text;n integer;before_limit date;
begin
 select id,rol,activo into admin_id,old_role,old_active from public.perfiles where activo and rol::text='superadmin' limit 1;
 if admin_id is null then raise exception 'An active superadmin is needed for this test';end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
 insert into public.comunidades(nombre) values('TEST form rollback') returning id into community;
 insert into public.comunidades(nombre) values('TEST other rollback') returning id into other_community;
 insert into public.perfil_comunidades(perfil_id,comunidad_id) values(admin_id,community) on conflict do nothing;
 insert into public.activos_comunidad(comunidad_id,nombre,categoria) values(community,'TEST Portón','Acceso y seguridad') returning id into asset;
 insert into public.plantillas_control(nombre,secuencial) values('TEST Maintenance form',true) returning id into template_one;
 insert into public.plantilla_items(plantilla_id,grupo,texto,orden,orden_grupo,ayuda,requiere_foto,obligatorio) values(template_one,'Portón','TEST revisión original',1,1,'TEST ayuda',true,true),(template_one,'Seguridad','TEST segundo punto',2,2,null,false,false);
 insert into public.plantillas_control(nombre) values('TEST Other form') returning id into template_two;
 insert into public.plantilla_items(plantilla_id,grupo,texto) values(template_two,'General','TEST nueva pregunta');
 insert into public.plantillas_control(nombre) values('TEST Empty form') returning id into empty_template;
 insert into public.plantillas_control(nombre,comunidad_id) values('TEST Restricted form',other_community) returning id into private_template;
 insert into public.plantilla_items(plantilla_id,grupo,texto) values(private_template,'General','TEST private');
 select id into diagnostic from public.plantillas_control where codigo='diagnostico_comercial' limit 1;
 insert into public.mantenimiento_actividades(comunidad_id,activo_id,trabajo,frecuencia_unidad,frecuencia_valor,fecha_inicio,limite_tipo,plantilla_id,responsable_id)
 values(community,asset,'TEST mantención','meses',1,current_date,'fin_periodo',template_one,admin_id) returning id,proxima_exigible into activity,before_limit;
 execute 'set local role authenticated';
 control_one:=public.mantenimiento_abrir_formulario(activity);
 if public.mantenimiento_abrir_formulario(activity)<>control_one then raise exception 'Repeated click created a duplicate form';end if;
 if not exists(select 1 from public.controles where id=control_one and comunidad_id=community and responsable_id=admin_id and plantilla_id=template_one and secuencial and not es_diagnostico) then raise exception 'Form context incorrect';end if;
 if (select count(*) from public.control_items where control_id=control_one)<>2 then raise exception 'Questions not copied';end if;
 if not exists(select 1 from public.control_items where control_id=control_one and texto='TEST revisión original' and ayuda='TEST ayuda' and requiere_foto and obligatorio and orden=0) then raise exception 'Question properties not copied';end if;
 update public.plantilla_items set texto='TEST changed template' where plantilla_id=template_one;
 if exists(select 1 from public.control_items where control_id=control_one and texto='TEST changed template') then raise exception 'Existing answers changed with template';end if;
 update public.mantenimiento_actividades set plantilla_id=template_two where id=activity;
 if public.mantenimiento_abrir_formulario(activity)<>control_one then raise exception 'Changing the plan replaced an existing visit form';end if;
 begin update public.mantenimiento_actividades set plantilla_id=empty_template where id=activity;raise exception 'Empty template accepted';exception when raise_exception then if sqlerrm<>'El formulario elegido todavía no tiene preguntas activas.' then raise;end if;end;
 begin update public.mantenimiento_actividades set plantilla_id=private_template where id=activity;raise exception 'Another community template accepted';exception when raise_exception then if sqlerrm<>'Elige un formulario activo disponible para esta comunidad.' then raise;end if;end;
 if diagnostic is not null then
  begin update public.mantenimiento_actividades set plantilla_id=diagnostic where id=activity;raise exception 'CRM diagnosis accepted';exception when raise_exception then if sqlerrm<>'Elige un formulario activo disponible para esta comunidad.' then raise;end if;end;
 end if;
 insert into public.mantenimiento_agendamientos(comunidad_id,actividad_id,programado_para,responsable_id) values(community,activity,now()+interval '1 day',admin_id) returning id into visit;
 control_two:=public.mantenimiento_abrir_formulario(activity,visit);
 if control_two=control_one or public.mantenimiento_abrir_formulario(activity,visit)<>control_two then raise exception 'Scheduled visit reuse failed';end if;
 if not exists(select 1 from public.controles where id=control_two and mantenimiento_agendamiento_id=visit and plantilla_id=template_two and programado_para is not null) then raise exception 'Schedule not associated';end if;
 update public.controles set estado='enviado' where id=control_two;
 if public.mantenimiento_abrir_formulario(activity,visit)<>control_two then raise exception 'Completed visit duplicated';end if;
 if (select proxima_exigible from public.mantenimiento_actividades where id=activity) is distinct from before_limit then raise exception 'Opening a form advanced maintenance frequency';end if;
 if exists(select 1 from public.ejecuciones_mantenimiento where actividad_id=activity) then raise exception 'Opening a form falsely completed maintenance';end if;
 execute 'reset role';
 foreach v_role in array array['cliente','terreno','admin','jefatura','superadmin'] loop
   update public.perfiles set rol=v_role::public.rol_usuario,activo=true where id=admin_id;
   execute 'set local role authenticated';
   if v_role in ('cliente','terreno') then
     begin perform public.mantenimiento_abrir_formulario(activity);raise exception 'Unauthorized role opened a form';exception when raise_exception then if sqlerrm<>'No tienes permiso para abrir formularios de mantención.' then raise;end if;end;
   else
     if public.mantenimiento_abrir_formulario(activity)<>control_one then raise exception 'Management role cannot open its form';end if;
   end if;
   execute 'reset role';
 end loop;
 update public.perfiles set rol='admin',activo=false where id=admin_id;
 execute 'set local role authenticated';
 begin perform public.mantenimiento_abrir_formulario(activity);raise exception 'Inactive admin accepted';exception when raise_exception then if sqlerrm<>'No tienes permiso para abrir formularios de mantención.' then raise;end if;end;
 execute 'reset role';
 update public.perfiles set rol=old_role,activo=old_active where id=admin_id;
 -- Deleting a plan without executions keeps snapshots and must not break FK cleanup.
 perform public.mantenimiento_eliminar_actividad(activity);
 if not exists(select 1 from public.controles where id=control_two and mantenimiento_actividad_id is null and mantenimiento_agendamiento_id is null) then raise exception 'Deleting a plan broke form history';end if;
 if (select count(*) from public.control_items where control_id=control_one)<>2 then raise exception 'Form history lost';end if;
end;$$;
rollback;

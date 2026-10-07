-- Production-safe verification: all fixtures, role changes and registrations roll back.
begin;
do $$
declare v_admin uuid;v_community uuid;v_res uuid;v_unit uuid;m uuid;c uuid;t uuid;ctx jsonb;p jsonb;b uuid;email_id uuid;app uuid;v_role text;v_original public.rol_usuario;v_old_active boolean;n integer;v_wa_post uuid;
begin
 select id,rol,activo into v_admin,v_original,v_old_active from public.perfiles where activo and rol::text='superadmin' limit 1;
 if v_admin is null then raise exception 'Test requires an active superadmin';end if;
 update public.whatsapp_config set habilitado=true,responsable_recepcion=v_admin,worker_token=null,worker_hasta=null where id;
 insert into public.comunidades(nombre) values('TEST WhatsApp rollback') returning id into v_community;
 insert into public.residentes(comunidad_id,nombre,telefono_principal) values(v_community,'TEST Residente','9 0000 0001') returning id into v_res;
 insert into public.unidades(comunidad_id,numero,residente_id) values(v_community,'TEST-405',v_res) returning id into v_unit;
 ctx:=public.whatsapp_contextos('56900000001')->0;
 if ctx->>'unidad_id'<>v_unit::text then raise exception 'Phone normalization/context recognition failed';end if;
 m:=public.whatsapp_ingresar('56900000001','TEST','TEST-meta-1','texto','confirmar',now(),'{}');
 if public.whatsapp_ingresar('56900000001','TEST','TEST-meta-1','texto','confirmar',now(),'{}') is not null then raise exception 'Duplicate webhook accepted';end if;
 select conversation_id into c from public.whatsapp_messages where id=m;
 t:=public.whatsapp_worker_claim();
 if public.whatsapp_worker_claim() is not null then raise exception 'Concurrent worker claimed';end if;
 p:=jsonb_build_object('step','registrada','motive','residente','state','derivada','action','bitacora','replies','[]'::jsonb,'data',jsonb_build_object('context',ctx,'categoria','electricidad','categoria_nombre','Iluminación','descripcion','TEST solicitud confirmada','lugar','TEST-405','confirmado',true));
 if not public.whatsapp_process_commit(t,m,0,p) then raise exception 'Registration did not commit';end if;
 select bitacora_id into b from public.whatsapp_conversations where id=c;
 if b is null or not exists(select 1 from public.bitacora_registros where id=b and registrado_por=v_admin and correlativo is not null) then raise exception 'Missing Bitácora/attribution/correlativo';end if;
 if public.whatsapp_process_commit(t,m,1,p) then raise exception 'Duplicate confirmation committed';end if;
 if (select count(*) from public.bitacora_registros where descripcion like '%'||c::text||'%')<>1 then raise exception 'Duplicate Bitácora';end if;
 -- All five role cases and inactive admins: tables and RPCs must enforce server permissions.
 foreach v_role in array array['cliente','terreno','jefatura','admin','superadmin'] loop
   update public.perfiles set rol=v_role::public.rol_usuario,activo=true where id=v_admin;
   perform set_config('request.jwt.claim.sub',v_admin::text,true);
   perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
   execute 'set local role authenticated';
   if public.whatsapp_es_admin()<>(v_role in ('admin','superadmin')) then raise exception 'Role check failed: %',v_role;end if;
   select count(*) into n from public.whatsapp_conversations where id=c;
   if (n>0)<>(v_role in ('admin','superadmin')) then raise exception 'RLS failed: %',v_role;end if;
   if v_role not in ('admin','superadmin') then
     begin perform public.whatsapp_accion(c,'tomar');raise exception 'Forbidden role took conversation';exception when raise_exception then if sqlerrm<>'Sin permiso' then raise;end if;end;
   end if;
   begin perform public.whatsapp_worker_claim();raise exception 'Service-only function accessible';exception when insufficient_privilege then null;end;
   execute 'reset role';
 end loop;
 update public.perfiles set rol='admin',activo=false where id=v_admin;
 execute 'set local role authenticated';
 if public.whatsapp_es_admin() then raise exception 'Inactive admin has access';end if;
 execute 'reset role';
 update public.perfiles set rol=v_original,activo=v_old_active where id=v_admin;
 execute 'set local role authenticated';
 perform public.whatsapp_accion(c,'tomar');
 if exists(select 1 from public.whatsapp_messages where conversation_id=c and es_bot and estado='pendiente') then raise exception 'Bot messages remained after takeover';end if;
 execute 'reset role';
 m:=public.whatsapp_ingresar('56900000001','TEST','TEST-meta-2','audio','',now(),'{}');
 perform public.whatsapp_process_commit(t,m,(select revision from public.whatsapp_conversations where id=c),jsonb_build_object('step','anything','state','esperando_usuario','data','{}','replies',jsonb_build_array(jsonb_build_object('text','SHOULD NOT SEND'))));
 if exists(select 1 from public.whatsapp_messages where conversation_id=c and contenido='SHOULD NOT SEND') then raise exception 'Bot replied in human state';end if;
 -- 24h applies to the human composer too.
 update public.whatsapp_messages set creado_en=now()-interval '25 hours' where conversation_id=c and direccion='entrante';
 execute 'set local role authenticated';
 begin perform public.whatsapp_accion(c,'responder','TEST reply');raise exception 'Expired human window accepted';exception when raise_exception then if sqlerrm<>'Fuera de la ventana de 24 horas' then raise;end if;end;
 perform public.whatsapp_accion(c,'cerrar');
 execute 'reset role';
 if (select estado from public.bitacora_registros where id=b)<>'abierta' then raise exception 'Conversation closure closed the Bitácora';end if;
 m:=public.whatsapp_ingresar('56900000001','TEST','TEST-meta-3','texto','Hola',now(),'{}');
 if (select conversation_id from public.whatsapp_messages where id=m)=c then raise exception 'Closed conversation reused';end if;
 -- Confirmed quote reuses existing Prospectos and reports WhatsApp origin.
 m:=public.whatsapp_ingresar('56900000002','TEST','TEST-quote-1','texto','confirmar',now(),'{}');select conversation_id into c from public.whatsapp_messages where id=m;
 p:=jsonb_build_object('step','registrada','motive','cotizacion','state','derivada','action','prospecto','replies','[]'::jsonb,'data',jsonb_build_object('nombre','TEST contact','comunidad','TEST condominium','comuna','Maipú','unidades',10,'servicio','administracion','servicio_nombre','Cambio de administración','confirmado',true));
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 if not public.whatsapp_process_commit(t,m,0,p) then raise exception 'Quote not registered';end if;
 if not exists(select 1 from public.prospectos where id=(select prospecto_id from public.whatsapp_conversations where id=c) and fuente='WhatsApp') then raise exception 'Quote missing origin';end if;
 m:=public.whatsapp_ingresar('56900000002','TEST','TEST-quote-2','texto','confirmar',now(),'{}');
 execute format('update public.whatsapp_conversations set estado=''bot'',paso_actual=''cot_confirmar'' where id=%L',c);
 if not public.whatsapp_process_commit(t,m,(select revision from public.whatsapp_conversations where id=c),p) then raise exception 'Quote second registration failed';end if;
 if (select count(*) from public.prospectos where telefono='+56900000002' and nombre_condominio='TEST condominium')<>1 then raise exception 'Duplicate prospect';end if;
 -- Email manual classification and duplicate applicant protection.
 insert into public.proveedor_correos(gmail_message_id,remitente_nombre,remitente_email,cuerpo_texto) values('TEST-email-1','TEST Applicant','test-whatsapp@example.invalid','TEST email') returning id into email_id;
 insert into public.whatsapp_conversations(contacto_id,motivo,estado,datos) select id,'postulacion','cerrada','{"nombre":"TEST Applicant","comuna":"Maipú","area":"Conserjería"}'::jsonb from public.whatsapp_contacts where wa_id='56900000001' returning id into v_wa_post;
 perform set_config('request.jwt.claim.sub',v_admin::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 app:=public.whatsapp_clasificar_correo(email_id,'postulante','TEST Applicant',null,v_wa_post);
 if not exists(select 1 from public.postulantes where id=app and estado='nuevo' and origen='whatsapp' and comuna='Maipú' and cargo_propuesto='Conserjería' and telefono='+56900000001') then raise exception 'Applicant not registered';end if;
 begin perform public.clasificar_correo_contacto(email_id,'postulante','TEST Applicant');raise exception 'Repeated classification accepted';exception when raise_exception then if sqlerrm<>'Correo ya clasificado' then raise;end if;end;
 execute 'reset role';
 insert into public.proveedor_correos(gmail_message_id,remitente_email) values('TEST-email-2','test-whatsapp@example.invalid') returning id into email_id;
 execute 'set local role authenticated';
 if public.clasificar_correo_contacto(email_id,'postulante','TEST Applicant')<>app then raise exception 'Duplicate applicant created';end if;
 execute 'reset role';
 if (select postulante_id from public.whatsapp_conversations where id=v_wa_post)<>app then raise exception 'Applicant WhatsApp link missing';end if;
 raise notice 'WhatsApp database assertions passed; fixtures roll back';
end;$$;
rollback;

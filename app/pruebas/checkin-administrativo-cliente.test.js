import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const leer=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const control=leer('src/paginas/terreno/Control.jsx');
const portal=leer('src/paginas/cliente/PortalCliente.jsx');
const css=leer('src/paginas/cliente/PortalCliente.css');
const sql=leer('../supabase/migrations/202611170002_checkin_administrativo_visible_cliente.sql');

test('El check-in administrativo se ofrece al superadmin también al cerrar una visita sin GPS',()=>{
 assert.match(control,/perfil\?\.rol === 'superadmin' && control\.estado !== 'anulado'/);
 assert.match(control,/Registrar check-in administrativo \(sin GPS\)/);
 assert.match(control,/supabase\.rpc\('autorizar_control_sin_checkin'/);
 assert.match(control,/p_motivo: razon/);
 assert.match(control,/setExcepcionCheckIn\(autorizacion\)/);
 assert.match(control,/Registro administrativo del/);
 assert.doesNotMatch(control,/Autorizar finalización sin check-in/);
 assert.match(sql,/public\.mi_rol\(\)::text IS DISTINCT FROM 'superadmin'/);
 assert.match(sql,/v_control\.estado::text='anulado'/);
 assert.doesNotMatch(sql,/v_control\.estado::text IN \('enviado','anulado'\)/);
 assert.match(sql,/v_control\.checkin_en IS NOT NULL/);
 assert.doesNotMatch(sql,/UPDATE public\.controles SET checkin_en|checkin_lat\s*=/i);
});

test('El registro administrativo solo se expone a cuentas con comunidad y plantilla autorizadas',()=>{
 assert.match(sql,/public\.cliente_puede_ver_comunidad\(p_comunidad_id\)/);
 assert.match(sql,/public\.vista_cliente_puede_ver_comunidad\(p_comunidad_id,p_usuario_cliente\)/);
 assert.match(sql,/public\.cliente_puede_ver_plantilla\(c\.comunidad_id,c\.plantilla_id\)/);
 assert.match(sql,/public\.vista_cliente_puede_ver_plantilla\(c\.comunidad_id,c\.plantilla_id,p_usuario_cliente\)/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.checkins_administrativos_visibles\(uuid,uuid\) FROM PUBLIC,anon/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.checkins_administrativos_visibles\(uuid,uuid\) TO authenticated/);
 assert.match(sql,/c\.estado::text<>'anulado'/);
});

test('Portal y simulador muestran motivo, fecha y responsable sin falsificar GPS',()=>{
 assert.match(portal,/supabase\.rpc\('checkins_administrativos_visibles'/);
 assert.match(portal,/p_usuario_cliente:clienteId\|\|null/);
 assert.match(portal,/checkin_administrativo:checkinsPorControl\.get\(l\.id\)\|\|null/);
 assert.match(portal,/Check-in administrativo \(sin GPS\)/);
 assert.match(portal,/l\.checkin_administrativo\.motivo/);
 assert.match(portal,/autorizado_por_nombre/);
 assert.match(portal,/Check-in con ubicación/);
 assert.match(portal,/No fue posible consultar los registros administrativos/);
 assert.match(portal,/regularizaciones\.length>0/);
 assert.match(css,/\.portal-checkin-administrativo/);
 assert.match(css,/\.portal-checkin-resumen/);
});

test('Corrección de ambigüedad en ON CONFLICT preserva seguridad y no simula GPS',()=>{
 const fix=leer('../supabase/migrations/202611170003_fix_checkin_administrativo_control_id_ambiguo.sql');
 assert.match(fix,/ON CONFLICT ON CONSTRAINT control_checkin_excepciones_pkey DO NOTHING;/);
 assert.doesNotMatch(fix,/^\s*ON CONFLICT\s*\(\s*control_id\s*\)/m);
 assert.match(fix,/public\.mi_rol\(\)::text IS DISTINCT FROM 'superadmin'/);
 assert.match(fix,/v_control\.checkin_en IS NOT NULL/);
 assert.match(fix,/REVOKE ALL ON FUNCTION public\.autorizar_control_sin_checkin\(uuid,text\) FROM PUBLIC,anon/);
 assert.doesNotMatch(fix,/UPDATE\s+public\.controles|SET\s+checkin_en|SET\s+checkin_lat/i);
});

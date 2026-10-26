import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = ruta => readFileSync(new URL('../'+ruta,import.meta.url),'utf8');
const notificaciones=leer('src/paginas/panel/Notificaciones.jsx');
const pipeline=leer('src/paginas/panel/Pipeline.jsx');
const mail=leer('../supabase/functions/correo-prospecto/index.ts');
const migration=leer('../supabase/migrations/0100_notificaciones_prospecto_enlazado.sql');
const historico=leer('../supabase/migrations/0101_prospecto_correos.sql');

test('Notificaciones comerciales gestionables y enlazadas a un prospecto',()=>{
  assert.match(notificaciones,/prospecto_id,leida,creado_en/);
  assert.match(notificaciones,/n\.tipo === 'lead_web'/);
  assert.match(notificaciones,/\/pipeline\?prospecto=/);
  assert.match(notificaciones,/Abrir prospecto en Pipeline/);
  assert.match(migration,/add column if not exists prospecto_id uuid/);
  assert.match(migration,/w\.recibido_en = n\.creado_en/);
  assert.match(migration,/having count\(distinct w\.prospecto_id\) = 1/);
  assert.match(migration,/mensaje,prospecto_id/);
});

test('Pipeline permite abrir la tarjeta y redactar correo autenticado',()=>{
  assert.match(pipeline,/parametros?|get\('prospecto'\)/);
  assert.match(pipeline,/Gestionar prospecto/);
  assert.match(pipeline,/onClick=\{onEditar\}/);
  assert.match(pipeline,/supabase\.functions\.invoke\('correo-prospecto'/);
  assert.match(pipeline,/id="pipeline-correo"/);
  assert.match(pipeline,/enviandoCorreo \? 'Enviando…' : 'Enviar correo'/);
});

test('Servidor restringe el envío a correo registrado y guarda auditoría',()=>{
  assert.match(mail,/dbUsuario\.auth\.getUser\(\)/);
  assert.match(mail,/\['superadmin','admin','jefatura'\]/);
  assert.match(mail,/\.eq\('id',prospectoId\)\.maybeSingle\(\)/);
  assert.match(mail,/const destinatario=normal\(prospecto\.email/);
  assert.match(mail,/\(count\|\|0\)>=30/);
  assert.match(mail,/from\('prospecto_correos'\)/);
  assert.match(mail,/SMTP_PASS/);
  assert.match(historico,/enable row level security/);
  assert.match(historico,/revoke all on public\.prospecto_correos/);
});

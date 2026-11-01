import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepararCopias} from '../src/lib/copiasCorreo.js';

const leer=r=>readFileSync(new URL('../../'+r,import.meta.url),'utf8');
const crm=leer('supabase/functions/correo-prospecto/index.ts');
const prov=leer('supabase/functions/enviar-comunicacion-proveedores/index.ts');
const motor=leer('supabase/functions/_compartido/motor-correo.ts');
const pipeline=leer('app/src/paginas/panel/Pipeline.jsx');
const proveedores=leer('app/src/paginas/panel/Proveedores.jsx');

test('No se envían copias obligatorias a Osmar o Francisco',()=>{
  assert.doesNotMatch(crm,/osmarmeza\.adm7@gmail\.com|franciscomorgadotobar@gmail\.com/);
  assert.doesNotMatch(crm,/\[Copia CRM\]/);
  assert.doesNotMatch(crm,/if\(CCO\.length\)/);
  assert.match(crm,/cc:copias\.cc,bcc:copias\.cco/);
  assert.match(crm,/validarCopiasCorreo\(body,destinatario\)/);
});

test('CRM y Proveedores exponen CC/CCO vacíos por defecto',()=>{
  assert.match(pipeline,/const \[ccCorreo,setCcCorreo\]=useState\(''\)/);
  assert.match(pipeline,/const \[ccoCorreo,setCcoCorreo\]=useState\(''\)/);
  assert.match(pipeline,/cc:copias\.cc,cco:copias\.cco/);
  assert.match(proveedores,/const \[cc,setCc\]=useState\(''\)/);
  assert.match(proveedores,/const \[cco,setCco\]=useState\(''\)/);
  assert.match(prov,/validarCopiasCorreo\(body,/);
  assert.match(prov,/bcc:copias\.cco\.filter/);
});

test('Se validan direcciones separadas y no se crea copia predeterminada',()=>{
  assert.deepEqual(prepararCopias('',''),{cc:[],cco:[],errores:[]});
  assert.deepEqual(prepararCopias('A@correo.cl; b@correo.cl','oculta@correo.cl').cc,
    ['a@correo.cl','b@correo.cl']);
  assert.equal(prepararCopias('correo roto','').errores.length,1);
  assert.equal(prepararCopias('','foo@').errores.length,1);
});

test('El motor crea un único mensaje SMTP con MIME UTF-8 y adjuntos',()=>{
  assert.match(motor,/nodemailer\.createTransport/);
  assert.match(motor,/cliente\.sendMail\(/);
  assert.match(motor,/subject:normalizarGuiones\(mensaje\.asunto\)/);
  assert.match(motor,/text:normalizarGuiones\(mensaje\.texto\)/);
  assert.match(motor,/html:normalizarGuiones\(mensaje\.html\)/);
  assert.match(motor,/cc:mensaje\.cc/);
  assert.match(motor,/bcc:mensaje\.bcc/);
  assert.doesNotMatch(motor,/denomailer/);
});

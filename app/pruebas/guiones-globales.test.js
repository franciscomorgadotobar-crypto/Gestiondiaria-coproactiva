import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {normalizarGuiones} from '../src/lib/guionesGlobales.js';

const raiz=resolve(fileURLToPath(new URL('../src/',import.meta.url)));
function archivos(r){
 return readdirSync(r,{withFileTypes:true}).flatMap(item=>{
  const archivo=join(r,item.name);
  return item.isDirectory()?archivos(archivo):/\.(jsx?|css|json)$/.test(item.name)?[archivo]:[];
 });
}
const leer=r=>readFileSync(new URL(r,import.meta.url),'utf8');
const largo=String.fromCodePoint(8212);
const medio=String.fromCodePoint(8211);

test('El guion normal se aplica a rayas y semirrayas, sin tocar otros caracteres',()=>{
 assert.equal(normalizarGuiones('Solicitud recibida '+largo+' Don juan'),'Solicitud recibida - Don juan');
 assert.equal(normalizarGuiones('A '+medio+' B'),'A - B');
 assert.equal(normalizarGuiones('a-b'), 'a-b');
 assert.equal(normalizarGuiones(null),null);
});

test('Ningún texto fuente de app/src conserva caracteres de raya larga',()=>{
 const pendientes=archivos(raiz).filter(path=>/[\u2013\u2014]/.test(readFileSync(path,'utf8')));
 assert.deepEqual(pendientes.map(p=>p.slice(raiz.length+1)),[]);
});

test('La política visual cubre textos cargados desde BD y excluye campos editables',()=>{
 const main=leer('../src/main.jsx');
 const normalizador=leer('../src/lib/guionesGlobales.js');
 assert.match(main,/instalarGuionesGlobales\(document\.body\)/);
 assert.match(normalizador,/MutationObserver/);
 assert.match(normalizador,/input,textarea,select,option/);
 assert.match(normalizador,/contenteditable/);
});

test('Los asuntos y mensajes salientes aplican la misma regla en servidor',()=>{
 const motor=leer('../../supabase/functions/_compartido/motor-correo.ts');
 const html=leer('../../supabase/functions/_compartido/correo-formulario-web.ts');
 const correo=leer('../../supabase/functions/_compartido/correo.ts');
 assert.match(motor,/subject:normalizarGuiones\(mensaje\.asunto\)/);
 assert.match(motor,/text:normalizarGuiones\(mensaje\.texto\)/);
 assert.match(motor,/html:normalizarGuiones\(mensaje\.html\)/);
 assert.match(html,/Gracias por contactarnos - /);
 assert.match(correo,/asunto=normalizarGuiones\(asunto\)/);
});

test('Las plantillas almacenadas se migran sin modificar correos históricos',()=>{
 const sql=leer('../../supabase/migrations/202611010001_normalizar_guiones_plantillas_correo.sql');
 assert.match(sql,/update public\.plantillas_correo_crm/);
 assert.match(sql,/translate\(asunto, chr\(8212\)/);
 assert.doesNotMatch(sql,/prospecto_correos|delete from|truncate/i);
});

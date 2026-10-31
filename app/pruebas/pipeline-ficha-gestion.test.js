import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const codigo=readFileSync(new URL('../src/paginas/panel/Pipeline.jsx',import.meta.url),'utf8');

test('La ficha, no el editor, es el destino de cada lead',()=>{
 assert.match(codigo,/onGestionar=\{\(\) => abrirGestion\(p\)\}/);
 assert.match(codigo,/set\('prospecto',p\.id\)/);
 assert.match(codigo,/function TarjetaProspecto\(\{p,equipo,onGestionar,/);
 assert.match(codigo,/aria-label=\{'Gestionar prospecto '/);
 const tarjeta=codigo.split('function TarjetaProspecto(')[1].split('function TarjetaDiagnostico(')[0];
 assert.doesNotMatch(tarjeta,/abrirEdicion|Iniciar diagnóstico|<textarea/);
 assert.match(tarjeta,/onClick=\{onGestionar\}/);
 // La tarjeta permite cambiar la etapa móvil sin convertir el clic en edición.
 assert.match(tarjeta,/onChange=\{e=>onCambiarEtapa\(e.target.value\)\}/);
});
test('Ficha ofrece acciones, etapa y diagnóstico sin salir del contexto',()=>{
 assert.match(codigo,/Gestionar prospecto/);
 assert.match(codigo,/Editar datos/);
 assert.match(codigo,/Enviar correo/);
 assert.match(codigo,/WhatsApp/);
 assert.match(codigo,/Llamar/);
 assert.match(codigo,/Iniciar diagnóstico/);
 assert.match(codigo,/Etapa comercial/);
 assert.match(codigo,/\/nuevo\?prospecto=/);
});
test('Atrás conserva embudo → ficha → subvista y las notificaciones abren gestión',()=>{
 assert.match(codigo,/accionSeleccionada/);
 assert.match(codigo,/function volverPipeline\(\)/);
 assert.match(codigo,/function volverFicha\(\)/);
 assert.match(codigo,/function cerrarGestion\(\)/);
 assert.match(codigo,/navegar\(-1\)/);
 assert.match(codigo,/La notificación abre primero la ficha de gestión, nunca la edición/);
 assert.match(codigo,/onClick=\{volverFicha\}>Cancelar/);
});

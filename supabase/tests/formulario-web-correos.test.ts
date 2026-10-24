// deno test --no-lock supabase/tests/formulario-web-correos.test.ts
function assert(c: unknown, m = 'falló la aserción'): asserts c { if (!c) throw new Error(m); }
function assertEquals(a: unknown, b: unknown) { if (a !== b) throw new Error(`esperado ${String(b)}, obtenido ${String(a)}`); }

const c = await import('../functions/_compartido/correo-formulario-web.ts');

const base = {
  nombre: 'María José Pérez', condominio: 'Edificio Las Rosas', email: 'maria@ejemplo.cl',
  telefono: '+56912345678', servicio: 'Administración de comunidades',
  mensaje: 'Dirección: Av. Siempre Viva 123\nUnidades: 80', origen: 'web_coproactiva_cl',
  prospectoId: '685a12ea-3b8c-4f58-98a6-5f46c835ba43'
};

Deno.test('confirmación: mismo asunto y texto que el correo anterior', () => {
  const r = c.confirmacionContacto(base);
  assertEquals(r.asunto, 'Gracias por contactarnos — Edificio Las Rosas');
  assert(r.html.includes('Recibimos tu solicitud'));
  assert(r.html.includes('Te contactamos en las próximas horas'));
  assert(r.html.includes('María José Pérez'));
  assert(!r.html.includes('Siempre Viva'), 'la confirmación no repite el mensaje');
  assert(r.texto.includes('Edificio Las Rosas'));
});

Deno.test('aviso interno: datos, ID y enlace a Pipeline', () => {
  const r = c.avisoNuevoProspecto(base);
  assertEquals(r.asunto, 'Nuevo prospecto web: Edificio Las Rosas');
  assert(r.html.includes('PROS_685A12EA3B8C'));
  assert(r.html.includes('+56912345678'));
  assert(r.html.includes('Dirección: Av. Siempre Viva 123<br>Unidades: 80'));
  assert(r.html.includes('href="https://app.coproactiva.cl/pipeline?etapa=nuevo&amp;origen=correo"'));
  assert(r.texto.includes(c.URL_PIPELINE));
  assert(r.texto.includes('maria@ejemplo.cl'));
});

Deno.test('HTML y asunto no aceptan inyección', () => {
  const malo = { ...base, nombre: '<script>alert(1)</script>', condominio: 'Torre\r\nBcc: otro@x.cl', mensaje: '<img src=x onerror=1>' };
  const conf = c.confirmacionContacto(malo);
  const aviso = c.avisoNuevoProspecto(malo);
  assert(!conf.html.includes('<script>') && conf.html.includes('&lt;script&gt;'));
  assert(!aviso.html.includes('<img src=x'));
  assert(!/[\r\n]/.test(conf.asunto) && !/[\r\n]/.test(aviso.asunto));
});

Deno.test('textos largos se acotan en la confirmación', () => {
  const r = c.confirmacionContacto({ ...base, condominio: 'x'.repeat(500), nombre: 'y'.repeat(500) });
  assert(r.asunto.length <= 160);
  assert(!r.html.includes('x'.repeat(121)) && !r.html.includes('y'.repeat(81)));
});

Deno.test('solo direcciones simples reciben confirmación', () => {
  assert(c.correoEnviable('persona.apellido+web@dominio.cl'));
  assert(!c.correoEnviable('a,b@dominio.cl'));
  assert(!c.correoEnviable('a@b@dominio.cl'));
  assert(!c.correoEnviable('nombre <a@dominio.cl>'));
  assert(!c.correoEnviable('a@dominio'));
});

Deno.test('teléfono e ID visibles', () => {
  assertEquals(c.telefonoVisible('912345678'), '+56912345678');
  assertEquals(c.telefonoVisible('+56 9 1234 5678'), '+56912345678');
  assertEquals(c.codigoProspecto(''), '');
});

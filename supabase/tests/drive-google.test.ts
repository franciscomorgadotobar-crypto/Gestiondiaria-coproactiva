// deno test --no-lock --allow-env supabase/tests/drive-google.test.ts
// Aserciones mínimas sin dependencias externas.
function assert(c: unknown, m = 'falló la aserción'): asserts c { if (!c) throw new Error(m); }
function assertEquals(a: unknown, b: unknown) { if (a !== b) throw new Error(`esperado ${String(b)}, obtenido ${String(a)}`); }
function assertThrows(fn: () => unknown) { try { fn(); } catch { return; } throw new Error('se esperaba un error'); }
async function assertRejects(fn: () => Promise<unknown>) { try { await fn(); } catch { return; } throw new Error('se esperaba un rechazo'); }

Deno.env.set('GOOGLE_OAUTH_CLIENT_SECRET', 'secreto-de-prueba-solo-para-tests-' + crypto.randomUUID());
const g = await import('../functions/_compartido/google-drive.ts');

Deno.test('cifrado AES-GCM: ida y vuelta, IV distinto y detección de manipulación', async () => {
  const a = await g.cifrar('refresh-token-de-prueba');
  const b = await g.cifrar('refresh-token-de-prueba');
  assert(a.startsWith('v1.'));
  assert(a !== b, 'cada cifrado usa un IV aleatorio');
  assertEquals(await g.descifrar(a), 'refresh-token-de-prueba');
  const roto = a.slice(0, -3) + (a.endsWith('A') ? 'B' : 'A') + a.slice(-2);
  await assertRejects(() => g.descifrar(roto));
  await assertRejects(() => g.descifrar('texto-plano'));
});

Deno.test('PKCE S256 coincide con el vector de RFC 7636', async () => {
  assertEquals(await g.sha256B64url('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
});

const bytes = (...xs: number[]) => new Uint8Array([...xs, ...new Array(32).fill(0x20)]);

Deno.test('validación de archivos: extensión, firma y tamaño', () => {
  assertEquals(g.validarArchivo('informe.pdf', new TextEncoder().encode('%PDF-1.7 contenido')).mime, 'application/pdf');
  assertEquals(g.validarArchivo('foto.JPG', bytes(0xff, 0xd8, 0xff, 0xe0)).mime, 'image/jpeg');
  assertEquals(g.validarArchivo('planilla.xlsx', bytes(0x50, 0x4b, 0x03, 0x04)).ext, 'xlsx');
  assertThrows(() => g.validarArchivo('script.exe', bytes(0x4d, 0x5a)));
  assertThrows(() => g.validarArchivo('falso.pdf', bytes(0xff, 0xd8, 0xff)));
  assertThrows(() => g.validarArchivo('pagina.html', new TextEncoder().encode('<html></html>')));
  assertThrows(() => g.validarArchivo('vacio.pdf', new Uint8Array()));
  assertThrows(() => g.validarArchivo('grande.pdf', new Uint8Array(g.MAX_BYTES + 1)));
  assertThrows(() => g.validarArchivo('texto.txt', bytes(0x41, 0x00, 0x42)));
});

Deno.test('nombres seguros sin rutas ni caracteres de control', () => {
  assertEquals(g.nombreSeguro('../../etc/passwd'), '.. .. etc passwd');
  assertEquals(g.nombreSeguro('a\u0000b:c?.pdf'), 'a b c .pdf');
  assertEquals(g.nombreSeguro('   ', 'respaldo'), 'respaldo');
  assert(g.nombreSeguro('x'.repeat(400)).length <= 180);
});

Deno.test('CORS solo para orígenes de la app', () => {
  const ok = g.cors(new Request('https://x', { headers: { origin: 'https://app.coproactiva.cl' } }));
  const malo = g.cors(new Request('https://x', { headers: { origin: 'https://evil.example' } }));
  assertEquals(ok['Access-Control-Allow-Origin'], 'https://app.coproactiva.cl');
  assertEquals(malo['Access-Control-Allow-Origin'], undefined);
});

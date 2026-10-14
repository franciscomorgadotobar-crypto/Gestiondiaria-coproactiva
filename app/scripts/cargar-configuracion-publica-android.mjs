/**
 * Usa EXACTAMENTE la configuración pública Supabase de la compilación web.
 * Este script evita duplicar la URL/anon-key en otro workflow.
 * La anon-key es pública, NO es la service_role key.
 * Nunca imprime los valores en logs; en futuras mejoras migrar a variables
 * GitHub Actions de repositorio para evitar parsear el workflow web.
 */
import { readFile, appendFile } from 'node:fs/promises';
import path from 'node:path';

const workflow = await readFile(
  path.resolve('../.github/workflows/publicar-app.yml'),'utf8');
const destino = process.env.GITHUB_ENV;
if (!destino) throw Error('Este script se utiliza únicamente en GitHub Actions.');
for (const nombre of ['VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY']) {
  const m = workflow.match(new RegExp('^\\s*' + nombre + ':\\s*(\\S+)\\s*$', 'm'));
  if (!m) throw Error('Falta '+ nombre +' en el flujo de despliegue web.');
  await appendFile(destino, nombre + '=' + m[1] + '\n');
}
console.log('Configuración pública Supabase reutilizada del build web.');

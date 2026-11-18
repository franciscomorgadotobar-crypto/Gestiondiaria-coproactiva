import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const leer = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const panel = leer('src/componentes/PanelEscritorio.jsx');
const portal = leer('src/paginas/cliente/PortalCliente.jsx');
const materias = leer('src/paginas/cliente/EstadoMaterias.jsx');

test('Las secciones del cliente usan la barra inferior compartida, sin chips duplicados', () => {
  assert.match(panel, /const opcionesBarra = esCliente \? accesos/);
  assert.match(panel, /const mostrarBarraMovil = esCliente \|\|/);
  assert.match(panel, /'cliente-resumen', 'cliente-compromisos', 'cliente-documentos', 'cliente-conocimientos'/);
  assert.match(panel, /menuMasOperacion\.length > 0/);
  assert.doesNotMatch(portal, /<nav className="pestanas portal-pestanas-movil portal-pestanas-vista-previa"/);
  assert.match(panel, /vistaCliente = null/);
});

test('Los respaldos se obtienen por materia y respetan la visibilidad del cliente', () => {
  assert.match(materias, /\.from\('estado_materia_documentos'\)\.select\('materia_id,documento_id'\)/);
  assert.match(materias, /supabase\.rpc\('drive_listar_documentos'/);
  assert.match(materias, /!soloLecturaCliente\|\|d\.visible_cliente===true/);
  assert.match(materias, /!d\.eliminado_en/);
  assert.match(materias, /<DocumentosMateria \{\.\.\.documentoProps\}/);
  assert.match(materias, /descargarDeDrive\(comunidadId,doc\)/);
  assert.match(materias, /verEnDrive\(comunidadId,doc\)/);
});

test('Solo administración vincula o desvincula; no borra ni duplica archivos de Drive', () => {
  assert.match(materias, /if\(!administrador\)throw new Error\('Esta vista es de solo lectura\.'\)/);
  assert.match(materias, /\.from\('estado_materia_documentos'\)\s*\.insert\(/);
  assert.match(materias, /\.from\('estado_materia_documentos'\)\.delete\(\)/);
  assert.doesNotMatch(materias, /subirADrive|eliminarDeDrive/);
});

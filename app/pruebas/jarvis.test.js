import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  textoPlazo, fechaCorta, filtrar, contar, agruparAgenda, brechasPorComunidad,
  proximaFechaCiclo, textoFrecuencia, vistaValida, nombreAmbito
} from '../src/lib/jarvis.js';
import { destinoVolverPorJerarquia } from '../src/lib/jerarquia.js';

const leer = ruta => readFileSync(new URL('../' + ruta, import.meta.url), 'utf8');
const agenda = [
  { clave:'a', ambito:'operacion', urgencia:'vencido', dias:-5, comunidad_id:'c1', comunidad:'Plaza Nos' },
  { clave:'b', ambito:'comercial', urgencia:'hoy', dias:0, comunidad_id:null, comunidad:null },
  { clave:'c', ambito:'legal', urgencia:'semana', dias:4, comunidad_id:'c1', comunidad:'Plaza Nos' },
  { clave:'d', ambito:'legal', urgencia:'proximo', dias:20, comunidad_id:'c2', comunidad:'Santa Clara' },
  { clave:'e', ambito:'legal', urgencia:'brecha', dias:null, comunidad_id:'c2', comunidad:'Santa Clara' },
  { clave:'f', ambito:'operacion', urgencia:'brecha', dias:null, comunidad_id:'c1', comunidad:'Plaza Nos' }
];

test('Plazos se leen en lenguaje directo', () => {
  assert.equal(textoPlazo(-5), 'Atraso de 5 días');
  assert.equal(textoPlazo(-1), 'Atraso de 1 día');
  assert.equal(textoPlazo(0), 'Hoy');
  assert.equal(textoPlazo(1), 'Mañana');
  assert.equal(textoPlazo(12), 'En 12 días');
  assert.equal(textoPlazo(null), 'Sin fecha');
  assert.equal(fechaCorta('2026-11-15'), '15-11-2026');
  assert.equal(fechaCorta(null), '');
});

test('Filtros por ámbito y comunidad, conteos y grupos', () => {
  assert.equal(filtrar(agenda, { ambito:'legal' }).length, 3);
  assert.equal(filtrar(agenda, { comunidadId:'c1' }).length, 3);
  assert.equal(filtrar(agenda, { ambito:'legal', comunidadId:'c1' }).length, 1);
  assert.deepEqual(contar(agenda), { vencido:1, hoy:1, semana:1, proximo:1, brecha:2 });
  const grupos = agruparAgenda(agenda);
  assert.deepEqual(grupos.map(g => g.id), ['vencido', 'hoy', 'semana', 'proximo']);
  assert.ok(grupos.every(g => g.items.every(i => i.urgencia !== 'brecha')),
    'Las brechas no se mezclan con lo que tiene fecha');
  assert.deepEqual(agruparAgenda([]), []);
});

test('Brechas agrupadas por comunidad', () => {
  const grupos = brechasPorComunidad(agenda);
  assert.deepEqual(grupos.map(g => g.nombre), ['Plaza Nos', 'Santa Clara']);
  assert.equal(grupos[0].items.length, 1);
  assert.equal(brechasPorComunidad([{ urgencia:'brecha' }])[0].nombre, 'Gestión general');
});

test('Próxima fecha del ciclo: registrada, calculada o pendiente', () => {
  const anual = { frecuencia_meses: 12 }, mensual = { frecuencia_meses: 1 }, manual = { frecuencia_meses: null };
  assert.equal(proximaFechaCiclo(anual, { ultima_fecha:'2026-03-10' }), '2027-03-10');
  assert.equal(proximaFechaCiclo(mensual, { ultima_fecha:'2026-01-31' }), '2026-02-28',
    'Fin de mes se ajusta igual que en la base de datos');
  assert.equal(proximaFechaCiclo(mensual, { ultima_fecha:'2026-12-15' }), '2027-01-15');
  assert.equal(proximaFechaCiclo(anual, { ultima_fecha:'2026-03-10', proxima_fecha:'2026-12-01' }), '2026-12-01',
    'La fecha registrada a mano manda');
  assert.equal(proximaFechaCiclo(manual, { ultima_fecha:'2026-03-10' }), null);
  assert.equal(proximaFechaCiclo(anual, undefined), null);
  assert.equal(textoFrecuencia(1), 'Mensual');
  assert.equal(textoFrecuencia(12), 'Anual');
  assert.equal(textoFrecuencia(null), 'Según vencimiento');
});

test('Vistas y ámbitos desconocidos no rompen la pantalla', () => {
  assert.equal(vistaValida('ciclo'), 'ciclo');
  assert.equal(vistaValida('otra'), 'agenda');
  assert.equal(vistaValida(null), 'agenda');
  assert.equal(nombreAmbito('proveedores'), 'Proveedores y personal');
  assert.equal(nombreAmbito('x'), 'Gestión');
});

test('Jarvis queda conectado a rutas, permisos, navegación y notificaciones', () => {
  const app = leer('src/App.jsx');
  assert.match(app, /path="\/jarvis" element=\{<Interna><SoloComercial>/,
    'Ruta interna restringida a dirección y jefatura');
  assert.equal(destinoVolverPorJerarquia('/jarvis'), '/');
  assert.match(leer('src/componentes/IconoNavegacion.jsx'), /startsWith\('\/jarvis'\)\) return 'jarvis'/);
  assert.match(leer('src/componentes/Campana.jsx'), /jarvis_resumen'\)return '\/jarvis'/);
  assert.match(leer('src/paginas/panel/Notificaciones.jsx'), /to="\/jarvis"/);
});

test('Pantalla cumple la estructura del contrato de diseño', () => {
  const jsx = leer('src/paginas/panel/Jarvis.jsx');
  const css = leer('src/paginas/panel/Jarvis.css');
  assert.match(jsx, /className="pantalla modulo-unificado jarvis"/);
  assert.match(jsx, /className="encabezado modulo-cabecera"/);
  assert.match(jsx, /className="cuerpo modulo-contenido jarvis-cuerpo"/);
  assert.match(jsx, /supabase\.rpc\('jarvis_agenda'/);
  assert.doesNotMatch(css, /margin(-left|-right)?:\s*-\d/, 'Sin márgenes negativos compensatorios');
  assert.doesNotMatch(css, /overflow-x:\s*(hidden|clip)/, 'No se esconde el desborde');
  assert.match(css, /@media \(max-width: 899px\)[\s\S]*jarvis-indicadores \{ grid-template-columns: repeat\(2/,
    'Indicadores a dos columnas en móvil');
});

test('Motor: agenda con permisos del usuario y aviso diario solo por cron', () => {
  const sql = leer('../supabase/migrations/202611150001_jarvis_motor.sql');
  assert.match(sql, /create or replace function public\.jarvis_agenda[\s\S]*?security invoker/);
  assert.match(sql, /revoke all on function public\.jarvis_agenda\(integer\) from public, anon/);
  assert.match(sql, /revoke all on function public\.jarvis_generar_avisos\(\) from public, anon, authenticated/);
  for (const tabla of ['jarvis_ciclo_reglas', 'jarvis_ciclo_comunidad', 'jarvis_analisis'])
    assert.match(sql, new RegExp('alter table public\\.' + tabla + ' enable row level security'));
  assert.doesNotMatch(sql, /drop table|truncate|delete from/i, 'Migración aditiva');
});

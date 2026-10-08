import { criteriosDe } from './criterios';

/* Plantilla del informe de levantamiento.
 *
 * Una sola plantilla para los dos destinos. En el teléfono se abre en una
 * ventana y se imprime a PDF con el diálogo del sistema —funciona sin señal—;
 * en el servidor se renderiza el mismo HTML con un navegador headless cuando se
 * quiere el archivo definitivo. Si hubiera dos maquetas, el informe saldría
 * distinto según dónde se generó, que es exactamente lo que no puede pasar con
 * un documento que se le entrega al comité.
 *
 * El informe se arma según lo que se preguntó: una escala se lee como "7 de
 * 10", un checklist como la lista de lo que estaba, un punto fotográfico solo
 * como sus fotos. El resumen también: conformes, observaciones y críticos
 * aparecen solo si el levantamiento tiene puntos de ese tipo; en uno que es
 * solo fotográfico, "0 conformes" no informa nada.
 *
 * Las fotos llegan con su URL ya resuelta: en el teléfono son object URLs de
 * los blobs guardados localmente, en el servidor URLs firmadas del bucket. La
 * plantilla no sabe ni le importa de dónde vienen.
 */

const ESTADOS = {
  cumple:      { etiqueta: 'Conforme',    clase: 'e-cumple' },
  observacion: { etiqueta: 'Observación', clase: 'e-obs' },
  critico:     { etiqueta: 'Crítico',     clase: 'e-critico' },
  sin_evaluar: { etiqueta: 'Sin evaluar', clase: 'e-nulo' }
};

const ESTADO_CONTROL = {
  pendiente: 'Pendiente', en_curso: 'En curso', pausado: 'En pausa', enviado: 'Enviado', anulado: 'Anulado'
};

function escapar(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Texto dentro de un content: "…" de CSS (pie de página).
function cadenaCss(texto) {
  return String(texto ?? '').replace(/[\\"]/g, '\\$&').replace(/[\r\n]+/g, ' ');
}

/* La zona va fija a Chile continental. El informe se puede generar en el
 * teléfono de quien hizo el levantamiento o en un servidor que corre en UTC, y
 * la hora del check-in tiene que ser la misma en los dos: es el dato que prueba
 * a qué hora estuvo esa persona en el lugar. */
const ZONA = 'America/Santiago';

function fecha(iso, conHora = false) {
  if (!iso) return '—';
  const d = new Date(iso);
  const opciones = conHora
    ? { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: ZONA }
    : { day: '2-digit', month: 'long', year: 'numeric', timeZone: ZONA };
  return d.toLocaleDateString('es-CL', opciones);
}

// Cierra una oración sin duplicar el punto de "a. m." / "p. m.".
function oracion(texto) {
  return texto.endsWith('.') ? texto : texto + '.';
}

function hora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', timeZone: ZONA });
}

const esEstado = item => !item.tipo_ingreso || item.tipo_ingreso === 'estado';

/* Si el punto quedó respondido, según lo que pedía. Un punto fotográfico se
 * responde con fotos; uno de estado, marcando algo distinto de "sin evaluar". */
function respondido(item) {
  const r = item.respuesta;
  switch (item.tipo_ingreso) {
    case 'foto':      return (item.fotos?.length ?? 0) > 0;
    case 'texto':     return Boolean(r?.texto?.trim());
    case 'numero':    return r?.numero != null;
    case 'escala':    return r?.valor != null;
    case 'seleccion': return Boolean(r?.opcion);
    case 'opciones': {
      const criterios = criteriosDe(item.config);
      if (criterios.length && !r?.opcion) {
        return criterios.every(c => Boolean(r?.criterios?.[c.id]?.opcion));
      }
      return Boolean(r?.opcion);
    }
    case 'checklist': return r != null;
    case 'firma':     return Boolean(r?.firmada);
    default:          return Boolean(item.estado) && item.estado !== 'sin_evaluar';
  }
}

/* Las fotos van en grilla. Tres columnas es el punto donde una foto de
 * teléfono sigue leyéndose en papel; una foto sola va a media página para
 * que no quede diminuta. La foto se muestra completa (no recortada):
 * una foto vertical de un tablero recortada a 4:3 pierde justo lo que se fue
 * a registrar. */
function grillaFotos(fotos) {
  const validas = (fotos ?? []).filter(f => f?.url);
  if (!validas.length) return '';
  const columnas = validas.length === 1 ? 2 : 3;
  return `
    <div class="fotos" style="--columnas:${columnas}">
      ${validas.map((f, i) => `
        <figure>
          <div class="marco">
            <img src="${escapar(f.url)}" alt="${escapar(f.descripcion || 'Fotografía del levantamiento')}"
                 onerror="this.closest('figure').classList.add('falla')">
            <span class="numero">${i + 1}</span>
            <span class="no-disponible">Fotografía no disponible</span>
          </div>
          ${f.descripcion ? `<figcaption>${escapar(f.descripcion)}</figcaption>` : ''}
        </figure>`).join('')}
    </div>`;
}

/* Cada tipo de punto se lee distinto en papel. Mostrarlos todos como un
 * estado de tres valores perdería justamente lo que se fue a medir. */
function valorRespondido(item) {
  const r = item.respuesta;
  const sinRespuesta = texto => `<p class="sin-respuesta">${texto}</p>`;

  switch (item.tipo_ingreso) {
    case 'texto':
      return r?.texto?.trim()
        ? `<blockquote class="texto">${escapar(r.texto)}</blockquote>`
        : sinRespuesta('Sin respuesta');

    case 'numero':
      return r?.numero == null ? sinRespuesta('Sin lectura')
        : `<p class="lectura">${escapar(Number(r.numero).toLocaleString('es-CL', { maximumFractionDigits: 3 }))}${
            item.config?.unidad ? ` <span>${escapar(item.config.unidad)}</span>` : ''}</p>`;

    case 'escala': {
      if (r?.valor == null) return sinRespuesta('Sin evaluar');
      const min = item.config?.min ?? 1;
      const max = item.config?.max ?? 10;
      const pasos = Array.from({ length: max - min + 1 }, (_, i) => min + i);
      return `
        <div class="escala">
          <p class="lectura">${escapar(r.valor)} <span>de ${max}</span></p>
          <div class="escala-barra">${pasos.map(n =>
            `<span class="${n <= r.valor ? 'lleno' : ''}"></span>`).join('')}</div>
          ${(item.config?.etiqueta_min || item.config?.etiqueta_max) ? `
            <div class="escala-extremos"><span>${escapar(item.config.etiqueta_min ?? '')}</span><span>${escapar(item.config.etiqueta_max ?? '')}</span></div>` : ''}
        </div>`;
    }

    case 'seleccion':
    case 'opciones':
      if (item.tipo_ingreso === 'opciones' && criteriosDe(item.config).length && !r?.opcion) return '';
      return r?.opcion
        ? `<p class="opcion">${escapar(r.opcion)}</p>`
        : sinRespuesta('Sin respuesta');

    case 'checklist': {
      const marcadas = r?.opciones ?? [];
      const todas = item.config?.opciones ?? marcadas;
      if (!todas.length) return sinRespuesta('Sin respuesta');
      // Se listan todas, no solo las marcadas: lo que faltó es tan informativo
      // como lo que estaba.
      return `
        <p class="conteo">${marcadas.length} de ${todas.length} presentes</p>
        <ul class="marcadas">${todas.map(op =>
          `<li class="${marcadas.includes(op) ? 'si' : 'no'}">${escapar(op)}</li>`
        ).join('')}</ul>`;
    }

    case 'firma':
      return r?.firmada
        ? `<p class="opcion">Firmado por ${escapar(r.firmante_nombre || 'sin nombre')}${
            r.firmante_rut ? ` · ${escapar(r.firmante_rut)}` : ''}</p>`
        : sinRespuesta('Sin firma');

    case 'foto':
      return (item.fotos?.length ?? 0) ? '' : sinRespuesta('Sin fotografías');

    default:
      return '';
  }
}

function descripcionPunto(item) {
  const lineas = String(item.descripcion ?? '')
    .split(/\r?\n/)
    .map(x => x.trim())
    .filter(Boolean);

  if (!lineas.length) return '';

  return `
    <div class="descripcion-punto">
      <p class="descripcion-etiqueta">Descripción del punto</p>
      <ul>
        ${lineas.map(linea => `<li>${escapar(linea)}</li>`).join('')}
      </ul>
    </div>`;
}

function bloqueCriterios(item) {
  const criterios = criteriosDe(item.config);
  if (!criterios.length || item.respuesta?.opcion) return '';
  return `<div class="resultados-criterios">${criterios.map((criterio, indice) => {
    const respuesta = item.respuesta?.criterios?.[criterio.id] ?? {};
    const fotos = (item.fotos ?? []).filter(f => String(f.criterio_id ?? '') === criterio.id);
    const opcion = respuesta.opcion ?? 'Sin evaluar';
    const clase = opcion === 'Cumple' ? 'e-cumple'
      : opcion === 'No cumple' ? 'e-critico'
      : opcion === 'Cumple con observaciones' ? 'e-obs' : 'e-nulo';
    return `<section class="resultado-criterio">
      <div class="resultado-criterio-cab"><strong>${indice + 1}. ${escapar(criterio.texto)}</strong><span class="estado ${clase}">${escapar(opcion)}</span></div>
      ${respuesta.comentario ? `<p class="nota"><strong>Comentario:</strong> ${escapar(respuesta.comentario)}</p>` : ''}
      ${grillaFotos(fotos)}
    </section>`;
  }).join('')}</div>`;
}

function bloqueItem(item, numero) {
  // Solo los puntos de tipo estado llevan el sello de conforme/observación:
  // en una lectura de medidor ese sello no significa nada.
  const estado = ESTADOS[item.estado] ?? ESTADOS.sin_evaluar;
  const cantidadFotos = item.fotos?.filter(f => f?.url).length ?? 0;
  // Un punto con una fila de fotos o menos no se parte entre páginas; uno con
  // muchas sí puede, entre filas, para no dejar media página en blanco.
  const compacto = cantidadFotos <= 3;

  return `
    <article class="item${compacto ? ' compacto' : ''}${cantidadFotos ? ' con-fotos' : ''}${esEstado(item) ? ` borde-${item.estado ?? 'sin_evaluar'}` : ''}">
      <div class="item-cab">
        <header>
          <span class="num">${numero}</span>
          <h3>${escapar(item.texto)}</h3>
          ${esEstado(item) ? `<span class="estado ${estado.clase}">${estado.etiqueta}</span>` : ''}
          ${item.tipo_ingreso === 'foto' && cantidadFotos
            ? `<span class="cuenta-fotos">${cantidadFotos} foto${cantidadFotos === 1 ? '' : 's'}</span>` : ''}
        </header>
        ${descripcionPunto(item)}
        ${bloqueCriterios(item)}
        ${valorRespondido(item)}
        ${item.nota ? `<p class="nota"><strong>${
          item.tipo_ingreso === 'opciones' ? 'Comentario'
          : !esEstado(item) ? 'Nota' : item.estado === 'critico' ? 'Hallazgo' : 'Observación'}:</strong> ${escapar(item.nota)}</p>` : ''}
      </div>
      ${criteriosDe(item.config).length && !item.respuesta?.opcion
        ? grillaFotos((item.fotos ?? []).filter(f => !f.criterio_id))
        : grillaFotos(item.fotos)}
    </article>`;
}

function bloqueCategoria(categoria, i) {
  const respondidos = categoria.items.filter(respondido).length;
  return `
    <section class="categoria">
      <h2><span>${escapar(categoria.nombre)}</span><span class="avance">${respondidos} de ${categoria.items.length} respondidos</span></h2>
      ${categoria.descripcion ? `<p class="descripcion-categoria">${escapar(categoria.descripcion)}</p>` : ''}
      ${categoria.items.map((item, j) => bloqueItem(item, `${i + 1}.${j + 1}`)).join('')}
    </section>`;
}

/* Lo que requiere atención va arriba: el comité lee la primera página y
 * decide si sigue. Críticos primero, después observaciones. */
function bloqueAtencion(categorias) {
  const filas = [];
  categorias.forEach((c, i) => c.items.forEach((item, j) => {
    if (esEstado(item) && (item.estado === 'critico' || item.estado === 'observacion')) {
      filas.push({ item, categoria: c.nombre, numero: `${i + 1}.${j + 1}` });
    }
  }));
  if (!filas.length) return '';
  filas.sort((a, b) => (a.item.estado === 'critico' ? 0 : 1) - (b.item.estado === 'critico' ? 0 : 1));
  return `
    <section class="atencion">
      <h2 class="titulo-seccion">Requiere atención</h2>
      ${filas.map(({ item, categoria, numero }) => {
        const e = ESTADOS[item.estado];
        return `
          <div class="atencion-fila ${e.clase}">
            <span class="estado ${e.clase}">${e.etiqueta}</span>
            <div>
              <p class="atencion-punto"><span class="num">${numero}</span> ${escapar(item.texto)} <span class="apagado">· ${escapar(categoria)}</span></p>
              ${item.nota ? `<p class="atencion-nota">${escapar(item.nota)}</p>` : ''}
            </div>
          </div>`;
      }).join('')}
    </section>`;
}

/**
 * @param {object} datos
 * @param {object} datos.comunidad  nombre, direccion, comuna
 * @param {object} datos.control    periodo, estado, plantilla_nombre, checkin_en, checkin_precision, enviado_en, responsable
 * @param {Array}  datos.categorias [{ nombre, items: [{ texto, descripcion, estado, nota, tipo_ingreso, config, respuesta, fotos }] }]
 * @param {string} [datos.logo]     data URI o URL del logotipo
 */
export function informeHtml(datos) {
  const { comunidad, control, categorias, logo } = datos;

  const todos = categorias.flatMap(c => c.items);
  const conEstado = todos.filter(esEstado);
  const cuenta = e => conEstado.filter(i => i.estado === e).length;
  const totalFotos = todos.reduce((n, i) => n + (i.fotos?.filter(f => f?.url).length ?? 0), 0);
  const respondidos = todos.filter(respondido).length;
  const direccion = [comunidad.direccion, comunidad.comuna].filter(Boolean).join(', ');

  // El resumen muestra lo que este levantamiento midió, nada más.
  const cifras = [
    { n: respondidos === todos.length ? todos.length : `${respondidos}/${todos.length}`,
      r: respondidos === todos.length ? 'Puntos revisados' : 'Puntos respondidos' },
    ...(conEstado.length ? [
      { n: cuenta('cumple'), r: 'Conformes', clase: 'ok' },
      { n: cuenta('observacion'), r: 'Observaciones', clase: 'obs' },
      { n: cuenta('critico'), r: 'Críticos', clase: 'critico' }
    ] : []),
    { n: totalFotos, r: totalFotos === 1 ? 'Fotografía' : 'Fotografías' }
  ];

  const pie = `CoproActiva · ${[control.plantilla_nombre, comunidad.nombre].filter(Boolean).join(' · ')}`;

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Levantamiento — ${escapar(comunidad.nombre)}</title>
<style>
  @font-face { font-family: 'Montserrat'; src: url('fonts/Montserrat-VariableFont_wght.ttf') format('truetype'); font-weight: 100 900; }
  @font-face { font-family: 'Source Sans Pro'; src: url('fonts/SourceSansPro-Regular.otf') format('opentype'); font-weight: 400; }
  @font-face { font-family: 'Source Sans Pro'; src: url('fonts/SourceSansPro-Bold.otf') format('opentype'); font-weight: 700; }

  /* A4. El pie con la paginación lo pone el navegador desde @page, así no hay
     que calcular saltos a mano. */
  @page {
    size: A4;
    margin: 14mm 14mm 16mm;
    @bottom-left {
      content: "${cadenaCss(pie)}";
      font: 400 7pt 'Source Sans Pro', sans-serif; color: #8b939b;
    }
    @bottom-right {
      content: "Página " counter(page) " de " counter(pages);
      font: 400 7pt 'Source Sans Pro', sans-serif; color: #8b939b;
    }
  }

  :root {
    --naranja: #d5863b; --pizarra: #4a5a68; --tinta: #2b3138; --papel: #f7f4f0; --niebla: #e9e6e2;
    --borde: #ddd7cf; --tenue: #8b939b;
    --ok-texto: #4e6b4a; --ok-fondo: #eef1e9; --ok-borde: #d8e0cf;
    --alerta-texto: #8a5f22; --alerta-fondo: #fdf3e6; --alerta-borde: #f0dcbd;
    --critico-texto: #93392b; --critico-fondo: #fbeeeb; --critico-borde: #edd2cb;
  }

  /* Sin esto el navegador omite los fondos al imprimir y la portada, los
     sellos y las cifras salen en blanco. */
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font: 400 9.5pt/1.5 'Source Sans Pro', -apple-system, system-ui, sans-serif;
    color: var(--tinta);
    background: #fff;
  }
  h1, h2, h3 { font-family: 'Montserrat', -apple-system, system-ui, sans-serif; margin: 0; }
  p { margin: 0; }
  .apagado { color: var(--tenue); }

  /* ------------------------------------------------------------- Portada */
  .portada {
    position: relative; background: var(--tinta); color: #fff;
    padding: 9mm 9mm 8mm; border-radius: 2mm; overflow: hidden; margin-bottom: 7mm;
  }
  .portada::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1.2mm; background: var(--naranja); }
  .portada .marca { height: 20px; filter: brightness(0) invert(1); display: block; margin-bottom: 7mm; }
  .portada .tipo {
    font: 600 7pt 'Montserrat', sans-serif; letter-spacing: .18em; text-transform: uppercase;
    color: var(--naranja); margin-bottom: 2mm;
  }
  .portada h1 { font-size: 20pt; font-weight: 700; line-height: 1.15; }
  .portada .direccion { color: #c9ced2; font-size: 10pt; margin-top: 1.5mm; }
  .ficha {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 4mm;
    margin: 7mm 0 0; padding-top: 5mm; border-top: 0.3mm solid rgba(255,255,255,.15);
  }
  .ficha dt {
    font: 600 6.5pt 'Montserrat', sans-serif; letter-spacing: .12em; text-transform: uppercase;
    color: #9ba3aa; margin-bottom: 1mm;
  }
  .ficha dd { margin: 0; font-size: 9pt; font-weight: 700; color: #fff; }
  .ficha dd small { display: block; font-weight: 400; color: #c9ced2; font-size: 8pt; }

  /* -------------------------------------------------------------- Resumen */
  .resumen { display: grid; grid-template-columns: repeat(var(--cifras), 1fr); gap: 3mm; margin-bottom: 7mm; }
  .resumen div {
    padding: 3.5mm 4mm; background: var(--papel); border-radius: 1.5mm;
    border-top: 0.8mm solid var(--borde);
  }
  .resumen .n { font: 700 16pt/1 'Montserrat', sans-serif; }
  .resumen .r {
    font: 600 6.5pt 'Montserrat', sans-serif; letter-spacing: .12em; text-transform: uppercase;
    color: var(--pizarra); margin-top: 1.5mm;
  }
  .resumen .ok      { border-top-color: var(--ok-borde); }
  .resumen .obs     { border-top-color: var(--naranja); }
  .resumen .critico { border-top-color: var(--critico-texto); }
  .resumen .critico .n { color: var(--critico-texto); }

  .titulo-seccion {
    font-size: 7.5pt; font-weight: 700; letter-spacing: .14em; text-transform: uppercase;
    color: var(--naranja); padding-bottom: 1.5mm; margin-bottom: 3mm;
    border-bottom: 0.5mm solid var(--naranja);
  }

  /* ---------------------------------------------------- Requiere atención */
  .atencion { margin-bottom: 7mm; break-inside: avoid; }
  .atencion-fila {
    display: flex; gap: 3mm; align-items: flex-start; padding: 2.5mm 3mm; margin-bottom: 1.5mm;
    border-radius: 1.5mm; border-left: 1.2mm solid;
  }
  .atencion-fila.e-critico { background: var(--critico-fondo); border-left-color: var(--critico-texto); }
  .atencion-fila.e-obs     { background: var(--alerta-fondo); border-left-color: var(--naranja); }
  .atencion-fila.e-critico, .atencion-fila.e-obs { color: var(--tinta); }
  .atencion-fila .estado { flex: none; }
  .atencion-punto { font-weight: 700; font-size: 9pt; }
  .atencion-nota { font-size: 8.5pt; color: var(--pizarra); margin-top: 0.5mm; }

  /* ------------------------------------------------------------ Contenido */
  .categoria { margin-bottom: 7mm; }
  .categoria > h2 {
    display: flex; justify-content: space-between; align-items: baseline;
    font-size: 8pt; font-weight: 700; letter-spacing: .14em; text-transform: uppercase;
    color: var(--naranja); padding-bottom: 1.5mm; margin-bottom: 3mm;
    border-bottom: 0.5mm solid var(--naranja);
    break-after: avoid; page-break-after: avoid;
  }
  .categoria > h2 .avance { font-size: 7pt; letter-spacing: .08em; color: var(--tenue); }

  .item {
    padding: 3.5mm 4mm; margin-bottom: 3mm;
    border: 0.3mm solid var(--niebla); border-radius: 1.5mm;
  }
  .item.borde-critico     { border-left: 1.2mm solid var(--critico-texto); }
  .item.borde-observacion { border-left: 1.2mm solid var(--naranja); }
  .item.borde-cumple      { border-left: 1.2mm solid var(--ok-borde); }
  /* La pregunta y su respuesta no se separan de la primera fila de fotos, y
     un punto corto no se parte: la foto tiene que quedar junto a lo que
     describe o deja de ser evidencia de nada. */
  .item.compacto { break-inside: avoid; page-break-inside: avoid; }
  .item-cab { break-inside: avoid; }
  .item.con-fotos .item-cab { break-after: avoid; page-break-after: avoid; }
  .item header { display: flex; align-items: baseline; gap: 2.5mm; }
  .item h3 { font-size: 10pt; font-weight: 600; flex: 1; line-height: 1.35; }
  .num {
    font: 700 7pt 'Montserrat', sans-serif; color: var(--tenue); letter-spacing: .04em;
    min-width: 6mm; flex: none;
  }
  .item header + * { margin-top: 2mm; }

  .descripcion-categoria { padding: 2.6mm 3mm; background: #f7f4f0; color: var(--pizarra); font-size: 9pt; line-height: 1.5; margin: 0 0 3mm; border-radius: 1mm; }
  .resultados-criterios { display: grid; gap: 2mm; margin-top: 2.5mm; }
  .resultado-criterio { padding: 2.2mm 2.5mm; border: .25mm solid var(--borde); border-radius: 1mm; break-inside: avoid; }
  .resultado-criterio-cab { display: flex; justify-content: space-between; align-items: flex-start; gap: 2mm; font-size: 8.5pt; line-height: 1.5; }
  .resultado-criterio-cab strong { font-weight: 600; }
  .resultado-criterio .fotos { margin-top: 2mm; }
  .descripcion-punto {
    margin-top: 2.2mm; padding: 2.3mm 3mm;
    background: #fbfaf8; border: 0.3mm solid var(--niebla); border-radius: 1mm;
    break-inside: avoid; page-break-inside: avoid;
  }
  .descripcion-etiqueta {
    font: 600 6.2pt 'Montserrat', sans-serif;
    letter-spacing: .11em; text-transform: uppercase;
    color: var(--tenue); margin-bottom: 1.3mm;
  }
  .descripcion-punto ul {
    margin: 0; padding: 0; list-style: none;
    display: grid; gap: 1mm;
  }
  .descripcion-punto li {
    position: relative; padding-left: 4.2mm;
    font-size: 8.7pt; line-height: 1.45; color: var(--pizarra);
  }
  .descripcion-punto li::before {
    content: '•'; position: absolute; left: 1mm; top: 0;
    color: var(--naranja); font-weight: 700;
  }

  .estado {
    font: 600 6.5pt 'Montserrat', sans-serif; letter-spacing: .1em; text-transform: uppercase;
    padding: 1mm 2mm; white-space: nowrap; border-radius: 0.8mm; border: 0.3mm solid;
  }
  .e-cumple  { background: var(--ok-fondo);      color: var(--ok-texto);      border-color: var(--ok-borde); }
  .e-obs     { background: var(--alerta-fondo);  color: var(--alerta-texto);  border-color: var(--alerta-borde); }
  .e-critico { background: var(--critico-fondo); color: var(--critico-texto); border-color: var(--critico-borde); }
  .e-nulo    { background: var(--niebla);        color: var(--pizarra);       border-color: var(--borde); }
  .cuenta-fotos { font: 600 6.5pt 'Montserrat', sans-serif; letter-spacing: .1em; text-transform: uppercase; color: var(--tenue); white-space: nowrap; }

  .nota {
    margin-top: 2mm; padding: 2mm 3mm; background: var(--papel); border-radius: 1mm;
    font-size: 9pt; color: var(--tinta);
  }
  .sin-respuesta { font-size: 8.5pt; color: var(--tenue); font-style: italic; }
  .lectura { font: 700 15pt/1.1 'Montserrat', sans-serif; }
  .lectura span { font: 400 9pt 'Source Sans Pro', sans-serif; color: var(--pizarra); }
  .opcion {
    display: inline-block; padding: 1.2mm 3mm; border-radius: 1mm;
    background: var(--papel); border: 0.3mm solid var(--borde); font-weight: 700; font-size: 9pt;
  }
  .texto {
    margin: 0; padding: 2mm 3mm; border-left: 0.8mm solid var(--borde);
    font-size: 9.5pt; white-space: pre-wrap;
  }
  .escala-barra { display: flex; gap: 0.8mm; margin-top: 1.5mm; max-width: 80mm; }
  .escala-barra span { flex: 1; height: 2.2mm; border-radius: 0.5mm; background: var(--niebla); }
  .escala-barra span.lleno { background: var(--naranja); }
  .escala-extremos { display: flex; justify-content: space-between; max-width: 80mm; font-size: 7pt; color: var(--tenue); margin-top: 0.8mm; }

  .conteo { font-size: 8pt; color: var(--pizarra); margin-bottom: 1mm; }
  .marcadas { margin: 0; padding: 0; list-style: none; columns: 2; column-gap: 6mm; font-size: 9pt; }
  .marcadas li { padding-left: 5mm; position: relative; line-height: 1.6; break-inside: avoid; }
  .marcadas li::before { position: absolute; left: 0; font-weight: 700; }
  .marcadas .si::before { content: '✓'; color: var(--ok-texto); }
  .marcadas .no { color: var(--tenue); }
  .marcadas .no::before { content: '—'; color: var(--borde); }

  /* --------------------------------------------------------------- Fotos */
  .fotos {
    display: grid; grid-template-columns: repeat(var(--columnas, 3), 1fr);
    gap: 2.5mm; margin-top: 3mm;
  }
  .fotos figure { margin: 0; break-inside: avoid; page-break-inside: avoid; }
  .fotos .marco {
    position: relative; aspect-ratio: 4 / 3; background: var(--papel);
    border: 0.3mm solid var(--niebla); border-radius: 1mm; overflow: hidden;
  }
  .fotos img { width: 100%; height: 100%; object-fit: contain; display: block; }
  .fotos .numero {
    position: absolute; top: 1.5mm; left: 1.5mm;
    min-width: 4.5mm; height: 4.5mm; padding: 0 1mm; border-radius: 0.8mm;
    background: rgba(43, 49, 56, .85); color: #fff;
    font: 700 6.5pt 'Montserrat', sans-serif;
    display: inline-flex; align-items: center; justify-content: center;
  }
  .fotos .no-disponible {
    display: none; position: absolute; inset: 0; align-items: center; justify-content: center;
    font-size: 8pt; color: var(--tenue);
  }
  .fotos .falla img { display: none; }
  .fotos .falla .no-disponible { display: flex; }
  .fotos figcaption { font-size: 8pt; line-height: 1.35; color: var(--pizarra); margin-top: 1mm; }

  /* Las firmas van al pie, no en la grilla: son la constancia de quién recibió
     el levantamiento, no evidencia de lo levantado. */
  .firmas { display: flex; gap: 10mm; margin-top: 8mm; break-inside: avoid; }
  .firmas figure { margin: 0; flex: 1; max-width: 70mm; }
  .firmas img { width: 100%; height: 22mm; object-fit: contain; border-bottom: 0.3mm solid var(--tinta); }
  .firmas figcaption { margin-top: 2mm; font-size: 8.5pt; }
  .firmas .rol {
    display: block; font: 600 6.5pt 'Montserrat', sans-serif; letter-spacing: .12em;
    text-transform: uppercase; color: var(--pizarra); margin-top: 1mm;
  }

  /* Las interrupciones se declaran. Un informe que oculta que la revisión tomó
     tres visitas en dos semanas está afirmando algo que no ocurrió. */
  .pausas {
    margin-top: 6mm; padding: 3.5mm 4mm; background: var(--papel); border-radius: 1.5mm;
    border-left: 1.2mm solid var(--borde); break-inside: avoid;
  }
  .pausas .titulo {
    margin: 0 0 2mm; font: 600 7pt 'Montserrat', sans-serif; letter-spacing: .12em;
    text-transform: uppercase; color: var(--pizarra);
  }
  .pausas ul { margin: 0; padding-left: 4mm; font-size: 9pt; }
  .pausas li { margin-bottom: 1mm; }
  .pausas .reanuda { display: block; color: var(--pizarra); font-size: 8pt; }

  .cierre {
    margin-top: 8mm; padding-top: 3mm; border-top: 0.3mm solid var(--niebla);
    font-size: 8pt; color: var(--pizarra); break-inside: avoid;
  }

  @media screen {
    body { background: #eceae7; padding: 20px; }
    .hoja { background: #fff; max-width: 210mm; margin: 0 auto; padding: 14mm; box-shadow: 0 0 0 1px var(--niebla); }
  }
  @media print { .hoja { padding: 0; } }
</style>
</head>
<body>
<div class="hoja">

  <header class="portada">
    ${logo ? `<img class="marca" src="${escapar(logo)}" alt="CoproActiva">` : ''}
    <p class="tipo">Informe de levantamiento${control.plantilla_nombre ? ` · ${escapar(control.plantilla_nombre)}` : ''}</p>
    <h1>${escapar(comunidad.nombre)}</h1>
    ${direccion ? `<p class="direccion">${escapar(direccion)}</p>` : ''}
    <dl class="ficha">
      <div><dt>Fecha</dt><dd>${fecha(control.checkin_en ?? control.enviado_en ?? control.creado_en)}</dd></div>
      <div><dt>Responsable</dt><dd>${escapar(control.responsable ?? '—')}</dd></div>
      <div><dt>Periodo</dt><dd>${escapar(control.periodo ?? '—')}</dd></div>
      <div><dt>Check-in</dt><dd>${control.checkin_en ? `${hora(control.checkin_en)}${
        control.checkin_precision != null ? `<small>Precisión ${Math.round(control.checkin_precision)} m</small>` : ''}` : 'Sin registro'}</dd></div>
    </dl>
  </header>

  <div class="resumen" style="--cifras:${cifras.length}">
    ${cifras.map(c => `<div class="${c.clase ?? ''}"><p class="n">${c.n}</p><p class="r">${c.r}</p></div>`).join('')}
  </div>

  ${bloqueAtencion(categorias)}

  ${categorias.map(bloqueCategoria).join('')}

  ${(datos.firmas ?? []).length ? `
  <div class="firmas">
    ${datos.firmas.map(f => `
      <figure>
        <img src="${escapar(f.url)}" alt="Firma">
        <figcaption>
          ${escapar(f.nombre || 'Sin nombre')}
          ${f.rut ? `<br>${escapar(f.rut)}` : ''}
          <span class="rol">Recibe conforme</span>
        </figcaption>
      </figure>`).join('')}
  </div>` : ''}

  ${(datos.pausas ?? []).length ? `
  <div class="pausas">
    <p class="titulo">El levantamiento se interrumpió ${datos.pausas.length} ${
      datos.pausas.length === 1 ? 'vez' : 'veces'}</p>
    <ul>
      ${datos.pausas.map(p => `
        <li>
          ${fecha(p.pausado_en, true)}${p.motivo ? ` — ${escapar(p.motivo)}` : ''}
          ${p.reanudado_en ? `<span class="reanuda">Reanudado el ${fecha(p.reanudado_en, true)}</span>` : ''}
        </li>`).join('')}
    </ul>
  </div>` : ''}

  <p class="cierre">
    ${control.checkin_en
      ? oracion(`Check-in registrado el ${fecha(control.checkin_en, true)}${
          control.checkin_precision != null
            ? `, con precisión de ${Math.round(control.checkin_precision)} metros`
            : ''}`)
      : 'Sin check-in geolocalizado.'}
    ${control.estado && ESTADO_CONTROL[control.estado] ? `Estado del levantamiento: ${ESTADO_CONTROL[control.estado].toLowerCase()}.` : ''}
    ${oracion(`Documento generado por CoproActiva el ${fecha(new Date().toISOString(), true)}`)}
  </p>

</div>
</body>
</html>`;
}

/* Abre el informe en una ventana nueva y lanza el diálogo de impresión, donde
 * el sistema ofrece "Guardar como PDF". Funciona sin señal porque las imágenes
 * salen de los blobs locales. */
export function imprimirInforme(html, ventanaExistente = null) {
  const ventana = ventanaExistente ?? window.open('', '_blank');
  if (!ventana) return false;   // el navegador bloqueó la ventana emergente

  // La ventana nueva no tiene dirección propia: sin <base>, las rutas del
  // logotipo y de las tipografías no se resolvían y el logo salía roto.
  const base = `<base href="${window.location.origin}${import.meta.env.BASE_URL}">`;
  ventana.document.open();
  ventana.document.write(html.replace('<head>', `<head>${base}`));
  ventana.document.close();

  // Se espera a que carguen todas las imágenes (y las tipografías) antes de
  // imprimir: imprimir antes deja huecos en blanco donde deberían ir las fotos.
  // Con un tope, para que una foto que no carga no deje el informe colgado.
  const esperarImagenes = () => Promise.all([...ventana.document.images].map(img =>
    img.complete ? null : new Promise(listo => {
      img.addEventListener('load', listo, { once: true });
      img.addEventListener('error', listo, { once: true });
    })
  ));
  const tope = new Promise(listo => setTimeout(listo, 15000));
  const fuentes = ventana.document.fonts?.ready ?? Promise.resolve();
  Promise.race([Promise.all([esperarImagenes(), fuentes]), tope]).then(() => {
    setTimeout(() => { ventana.focus(); ventana.print(); }, 300);
  });
  return true;
}

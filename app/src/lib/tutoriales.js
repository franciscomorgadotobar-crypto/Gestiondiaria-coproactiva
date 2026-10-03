export const TUTORIALES = {
  primeros_pasos: {
    id: 'primeros_pasos',
    nombre: 'Primeros pasos',
    descripcion: 'Conoce el inicio, el avance del trabajo y dónde volver a encontrar la ayuda.',
    version: 1,
    duracion: 3,
    roles: ['terreno', 'jefatura', 'admin', 'superadmin'],
    ruta: '/inicio',
    pasos: [
      {
        selector: '[data-tutorial="inicio-saludo"]',
        titulo: 'Este es tu inicio',
        texto: 'Aquí partes cada jornada. Arriba ves tu nombre y la fecha para confirmar que estás en la sesión correcta.'
      },
      {
        selector: '[data-tutorial="inicio-resumen"]',
        titulo: 'Resumen del trabajo',
        texto: 'Estos indicadores muestran pendientes, levantamientos en curso, finalizados y hallazgos críticos de forma rápida.'
      },
      {
        selector: '[data-tutorial="inicio-por-hacer"]',
        titulo: 'Tu trabajo pendiente',
        texto: 'Los levantamientos por realizar aparecen aquí agrupados por persona. Toca uno para comenzar o continuar.'
      },
      {
        selector: '[data-tutorial="ayuda-menu"]',
        titulo: 'Puedes volver cuando quieras',
        texto: 'Desde Ayuda y tutoriales puedes repetir una capacitación o continuarla más adelante.'
      }
    ]
  },

  ejecutar_levantamiento: {
    id: 'ejecutar_levantamiento',
    nombre: 'Ejecutar un levantamiento',
    descripcion: 'Practica el recorrido completo sin guardar respuestas, fotos ni cambios en una comunidad real.',
    version: 1,
    duracion: 6,
    roles: ['terreno', 'jefatura', 'admin', 'superadmin'],
    ruta: '/ayuda/practica-levantamiento',
    pasos: [
      {
        selector: '[data-tutorial="practica-intro"]',
        titulo: 'Modo práctica',
        texto: 'Nada de lo que hagas aquí modifica un levantamiento real. Usaremos una visita ficticia para aprender el recorrido.'
      },
      {
        selector: '[data-tutorial="practica-categoria"]',
        titulo: '1. Abre una categoría',
        texto: 'Cada levantamiento se organiza por categorías. Toca “Accesos y seguridad” para ver sus preguntas.',
        accion: 'click'
      },
      {
        selector: '[data-tutorial="practica-pregunta"]',
        titulo: '2. Elige una pregunta',
        texto: 'Primero ves el índice numerado. El estado de cada pregunta te permite saber qué está pendiente o finalizado.',
        accion: 'click'
      },
      {
        selector: '[data-tutorial="practica-respuesta"]',
        titulo: '3. Registra la respuesta',
        texto: 'En una pregunta real pueden aparecer distintas alternativas. Para practicar, toca “Cumple”.',
        accion: 'click'
      },
      {
        selector: '[data-tutorial="practica-evidencia"]',
        titulo: '4. Evidencia',
        texto: 'Cuando la plantilla lo exige, aquí puedes tomar una foto o elegirla desde la galería. En la práctica no se abre la cámara.'
      },
      {
        selector: '[data-tutorial="practica-navegacion"]',
        titulo: '5. Avanza sin perderte',
        texto: 'Puedes volver a la lista, ir a la pregunta anterior o continuar. El contador indica cuántas están completadas.'
      },
      {
        selector: '[data-tutorial="practica-finalizar"]',
        titulo: '6. Finaliza cuando esté completo',
        texto: 'Cuando no queden requisitos pendientes, el botón cambia a “Finalizar levantamiento”. Finalizar cierra el trabajo; no se envía a ninguna persona.'
      }
    ]
  }
};

export function tutorialesParaRol(rol) {
  return Object.values(TUTORIALES)
    .filter(t => t.roles.includes(rol))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

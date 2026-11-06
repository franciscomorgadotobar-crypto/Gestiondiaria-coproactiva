# Coproactiva | Motor de Avances (v1)

## Concepto

Un único motor de recorrido, seguimiento y visualización para los checklists
de **Levantamientos** y los de **Compromisos y avances** en **Comunidades**.
No se copian pantallas: ambas consumen reglas de secuencia, porcentaje y
colores desde `app/src/lib/motorAvances.js` y la barra desde
`app/src/componentes/MotorAvances.jsx`.

## Jerarquía

- Levantamiento: categorías ordenadas → preguntas en el orden de la plantilla →
  evidencia/estado de respuesta → avance de la categoría y avance global.
- Compromisos: comunidad → compromisos ordenados → subtareas numeradas por
  `orden` → check y avance parcial de cada subtarea → avance del compromiso.
  La vista global de comunidad mantiene su resumen.
- El primer elemento pendiente se distingue visualmente como **Siguiente**.

## Reglas

1. **Orden:** campo `orden` ascendente y orden de origen estable para empates.
2. **Avance:** 0–100 %, promedio aritmético por elementos. Levantamientos
   contabiliza un punto en 100 % solo si está realmente respondido, incluyendo
   evidencias obligatorias. En compromisos cada subtarea cerrada vale 100 %
   y una subtarea abierta vale como máximo 99 %.
3. **Checklist completado:** un levantamiento sigue su regla de envío y
   fotografías. Un compromiso completo exige todas sus subtareas cerradas
   por check (el trigger existente actualiza porcentaje y etapa).
4. **Recorrido:** la opción `secuencial` de Levantamientos bloquea etapas y
   preguntas posteriores hasta completar las anteriores. En Compromisos se
   respeta el orden, pero los compromisos históricos NO se bloquean: permitir
   edición y ejecución paralela protege su operativa.
5. **Colores desde tokens existentes:** pendiente neutro, en curso ámbar,
   completado verde, en espera gris azulado, crítico rojo. El color nunca es
   el único identificador de estado; cada fila conserva su etiqueta/check.
6. **Evidencias:** fotos de levantamiento y adjuntos Drive de subtareas son
   sus respectivas fuentes de datos. No guardar archivos en Supabase ni
   marcar completado automáticamente por el solo hecho de adjuntar.
7. **Compatibilidad:** sin migraciones destructivas, sin alterar IDs,
   tablas, trigger de compromisos ni seguridad por rol.
8. **Cliente:** la barra y estados usan exactamente el mismo motor visual;
   el acceso a adjuntos depende de permisos y visibilidad del portal.

## Extensibilidad

Otros flujos de Coproactiva podrán adoptar el mismo motor mediante adaptadores
`completado`, `avance`, `grupo`, `critico` y `secuencial`, sin duplicar
cálculos o CSS. Si se decide exigir secuencia estricta también en compromisos,
deberá incorporarse primero un parámetro persistente por compromiso con
validación de permisos y bloqueo transaccional en servidor.

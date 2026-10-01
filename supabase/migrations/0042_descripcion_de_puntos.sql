-- Descripción de cada punto en el levantamiento.
--
-- La plantilla siempre tuvo `ayuda` (qué revisar, por qué importa), pero no
-- llegaba al levantamiento: quien estaba en terreno veía la pregunta sin esa
-- explicación. Ahora se copia junto con el texto al programar, igual que el
-- resto del punto: si la plantilla cambia después, el levantamiento sigue
-- diciendo lo que decía al programarse.

alter table control_items add column if not exists ayuda text;

-- Los levantamientos que siguen abiertos la reciben desde su plantilla. Los
-- enviados (o anulados) quedan tal como se enviaron.
update control_items ci
   set ayuda = pi.ayuda
  from plantilla_items pi, controles c
 where pi.id = ci.plantilla_item_id
   and c.id = ci.control_id
   and c.estado in ('pendiente', 'en_curso', 'pausado')
   and ci.ayuda is null
   and nullif(trim(pi.ayuda), '') is not null;

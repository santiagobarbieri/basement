# Endo — estado actual, 27 Oct 2026

## Interfaz
Editor con la identidad del hub. Cabecera compacta con Home, nombre editable del Artboard, estado de guardado, Save, Folder y Export. Tema claro/oscuro compartido con Basement; cambiarlo no modifica los píxeles del Artboard ni el fondo transparente del PNG.

Barra rápida de 48 px a la izquierda: pincel (B), borrador (E), selección/movimiento (V), selección rectangular (M), mano (H), área de exportación (F), repetición y colores. El lienzo ocupa el centro; arriba muestra contexto, historial y copiar/pegar/duplicar, y abajo el zoom. El inspector derecho reúne Brush, Color, Repeat, Filters y Areas en pestañas accesibles por teclado, conservando el desplazamiento de cada grupo. Layers permanece visible debajo del inspector. La vista previa compacta está en Brush; Surface & lighting es desplegable.

El inspector distingue ajustes para el próximo trazo, selección y superficie global. Los atajos de herramientas no interceptan campos de texto ni diálogos; Espacio permite desplazar temporalmente después de usar la barra rápida.

## Lienzo y navegación
Lienzo amplio con coordenadas negativas y positivas. Mano, Espacio + arrastre o botón central para desplazar; rueda/touchpad desplazan; pinza/Ctrl + rueda y botones controlan zoom. Render inmediato en viewport y refinamiento acotado en worker.

Ambas vistas usan el fondo del tema actual. Cambiar de tema invalida los bitmaps anteriores; al empezar y terminar un trazo no se alterna entre papel oscuro y gris claro. Ese fondo es solo de presentación y no se incluye en PNG ni en los datos del Artboard.

## Repetición localizada
Repeat permite dibujar un área con R, moverla desde su interior y redimensionarla desde las esquinas. También se puede usar la vista actual o la selección, o ajustar X/Y/Width/Height. Mandala, Mirror, Grid y Mosaic usan el centro, ejes y celdas de esa región y quedan recortados a ella. Un trazo debe comenzar dentro de la región. Los trazos terminados conservan su región aunque cambie la de los siguientes; los anteriores sin región mantienen su geometría original.

## Selección, copia y borrado
V selecciona por clic y mueve los trazos por arrastre; un arrastre en espacio vacío selecciona un grupo. M fuerza selección rectangular; Shift agrega o quita. ⌘A/Ctrl+A selecciona todos los trazos visibles y desbloqueados; Escape limpia. Flechas desplazan 1 unidad, Shift + flecha 10. ⌘C/⌘V copian y pegan dentro del Artboard, ⌘J duplica; los mismos atajos funcionan con Ctrl. La barra también expone estas acciones. Delete elimina el grupo.

E borra parcialmente la capa activa, dejando intactas las inferiores. Cada gesto de borrado permanece editable en el documento y Undo lo restaura. Draw y Eraser limpian la selección; dibujar no selecciona automáticamente el último trazo. Ancho, propiedades, colores y presets afectan a los próximos trazos hasta seleccionar contenido explícitamente. Los ajustes globales siguen compartidos y los valores numéricos distintos muestran —. Undo/Redo y ⌘Z/Ctrl+Z, con Shift para rehacer, controlan el historial.

## Capas y filtros
Layers muestra las capas de arriba hacia abajo, con nombre, cantidad de trazos/filtros, visibilidad, bloqueo y opacidad. Se puede crear, duplicar, eliminar y ordenar con las flechas; doble clic en el nombre lo renombra. Selection to layer mueve los trazos elegidos a una capa nueva. No se dibuja sobre una capa oculta o bloqueada. La composición por orden y opacidad es real y coincide en el lienzo, el refinado y el PNG.

Filters aplica Threshold, Dither, Grayscale e Invert a la capa activa. La pila conserva los originales, permite ajustar parámetros y desactivar o quitar cada filtro, y mantiene el alfa. El patrón Dither está anclado a las coordenadas del documento para que no cambie al desplazar o ampliar la vista. Las capas ocultas o con opacidad cero liberan sus rasters de trabajo.

## Colores
Base color es el control principal; Light y Shadow explican los tonos de las caras iluminadas y oscuras del material. HEX, RGB y el selector visual editan el rol visible. Link light and shadow deriva ambos tonos al cambiar la base en una sola operación de historial; se puede desactivar para ajustar cada uno por separado. La preferencia del enlace se recuerda localmente. Los presets tienen nombre y muestra del material. Un HEX inválido muestra ayuda y no modifica el dibujo.

## Marcos y PNG
Export areas: Dibujar marco activa arrastre de un rectángulo; Desde selección crea un marco alrededor del grupo. Nombre editable, botón para centrarlo y controles X/Y/W/H para mover y cambiar tamaño. Quitar marco no borra trazos. Cambios con historial.
PNG area elige todo el contenido, selección o marco por nombre. Dimensiones visibles antes de exportar; exportaciones superiores a 16 MP u 8192px por lado se bloquean antes de reservar imagen. PNG transparente a 2 píxeles por unidad lógica; los marcos no se pintan en la imagen. Archivos por marco: Proyecto — Marco.png.

## Persistencia
El guardado automático en la carpeta elegida y .ment conservan el proyecto completo, capas, orden, bloqueos, opacidad, filtros, borrados, regiones de repetición, marcos y vista de la última edición. Los .ment anteriores se abren como una capa sin modificar sus trazos ni identificadores. Selección y objetivo de exportación no recortan el archivo editable. El fondo del tema sigue siendo de presentación.

## Verificación
Pruebas automatizadas del motor, formatos, navegación y áreas de exportación. QA navegador: dibujo lejano, selección múltiple, edición de dos trazos sin alterar un tercero, marco desde selección y por arrastre, nombre/dimensiones de PNG, undo, guardado .ment completo y reapertura de marcos.

`node tests/endo-ui-browser.mjs` comprueba además dibujo con tres materiales, selección/edición e historial, navegación entre pestañas por ratón/teclado, áreas desde la barra rápida, atajos y paneo temporal, guardado real en OPFS temporal, diálogo de carpeta y foco, descarga de .ment y PNG transparente, temas sin alterar los píxeles, disposición a 1512×982 y 1280×720 y regreso seguro al hub.

`node tests/endo-editing-browser.mjs` parte de un .ment anterior real en una carpeta OPFS aislada: comprueba capas, píxeles del borrador, selección/movimiento y copia, regiones locales, filtros visibles, colores y su historial, guardado y reapertura. `endo-document.test.mjs` y `endo-layers.test.mjs` cubren el formato, validación, composición, clipping, transparencia y equivalencia de los renders.

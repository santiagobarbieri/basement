# Endo — estado actual, 27 Oct 2026

## Espacio de trabajo

Un Artboard contiene frames independientes sobre una página de navegación. Se dibuja dentro de un frame; la página no es una superficie exportable. Cada frame tiene nombre, posición, tamaño, fondo opcional y su propia pila de capas. Sus dimensiones son de 64 a 2048 px por lado, con un máximo de 32 frames por Artboard. El tamaño no depende de la ventana ni cambia al redimensionar el navegador.

F activa la creación de frames por arrastre. También permite mover el frame activo desde su interior o redimensionarlo desde las esquinas. Frames ofrece nombre, X/Y, Width/Height, fondo transparente o color, duplicado, eliminación y foco. El selector junto a Layers cambia de frame rápidamente. Mover un frame transporta sus trazos y regiones; redimensionarlo recorta el contenido, sin escalar los gestos. No se borra el contenido que queda fuera del encuadre.

## Herramientas y selección

Barra izquierda: pincel B, borrador E, selección/movimiento V, selección rectangular M, mano H y frames F. R abre Repeat. Espacio permite desplazar temporalmente; rueda/touchpad desplazan, pinza/Ctrl + rueda y botones controlan zoom. Fit encuadra el frame activo dejando margen de página alrededor.

Cada trazo nuevo tiene su propia capa, de modo que se puedan insertar ajustes entre los trazos. Los grupos de trazos de archivos anteriores conservan sus capas originales. Selección por clic o rectángulo, Shift agrega o quita; Ctrl/⌘A selecciona contenido editable del frame activo y Escape limpia. Arrastrar la selección mueve su contenido; flechas desplazan 1 unidad y Shift + flecha 10. Copiar/pegar y duplicar están en la barra y en Ctrl/⌘C, V y J. Delete elimina la selección; Undo/Redo conserva los gestos editables.

El borrador es parcial y solo afecta a la capa de dibujo activa. Draw y Eraser limpian la selección; dibujar no selecciona automáticamente el último trazo. Cambiar color o material afecta a próximos trazos hasta seleccionar contenido explícitamente. Los ajustes globales de superficie siguen compartidos.

## Repetición

Mandala, Mirror, Grid y Mosaic toman el centro y los bordes del frame activo. Ya no existe una segunda área de repetición independiente que haya que dibujar o mover. El render recorta pintura y borrado a los límites del frame, además de conservar la geometría de repetición de los trazos terminados.

## Capas de ajuste

Layers muestra únicamente las capas del frame activo y permite ordenar por arrastre o flechas, ocultar, bloquear, renombrar, duplicar y cambiar opacidad. Las capas de dibujo y de ajuste aparecen en la misma pila. Una capa de ajuste modifica la composición que tiene debajo dentro de ese frame; moverla cambia qué trazos reciben el efecto y no afecta a otros frames.

Threshold, Dither, Grayscale e Invert son capas de ajuste independientes. Añadir un efecto o pulsar su miniatura abre un panel flotante con parámetros en vivo, Preview y eliminación. Se puede mover el panel; Escape o un clic exterior lo cierra sin bloquear el lienzo. Los filtros conservan los gestos originales y la transparencia. Los filtros antiguos se migran a capas de ajuste recortadas a su capa de origen para conservar su apariencia; reordenarlas libera ese recorte y adopta el comportamiento normal de la pila.

## Colores

Base color es el control principal; Light y Shadow explican los tonos de las caras iluminadas y oscuras. HEX, RGB y el selector visual editan el rol visible. Link light and shadow deriva ambos tonos al cambiar la base en una sola operación de historial; se puede desactivar y la preferencia se recuerda localmente. Los presets tienen nombre y muestra. Un HEX inválido muestra ayuda sin modificar el dibujo.

## Calidad y exportación

El frame activo usa una resolución de edición de hasta el 65 % de la resolución de pantalla, con un presupuesto total de 1,2 millones de píxeles repartido entre sus capas de dibujo. Los demás conservan miniaturas aplanadas de hasta 96 px por lado; cambiar la vista no reconstruye sus gestos mientras no cambie su contenido. No se refina la página entera.

El PNG incluye únicamente el frame elegido, con sus dimensiones exactas a 2× y su fondo opcional. Se reconstruye desde los gestos originales con el mismo orden de capas, filtros y recorte, independientemente de las miniaturas de edición. El máximo de salida es 4096 × 4096 px. `.ment` guarda el Artboard editable completo con todos sus frames.

## Persistencia y compatibilidad

El guardado principal sigue siendo la carpeta elegida y el autoguardado a los cinco segundos; IndexedDB conserva permiso y recuperación. El formato Endo nuevo es `.ment` v2; se mantiene la importación de v1 y el resto de los Studios continúa en v1. La migración conserva identificadores, gestos, borrados y filtros. Las áreas de exportación anteriores se conservan como frames/metadatos migrados. Si el contenido anterior supera el máximo de un frame, sus gestos permanecen completos en el archivo aunque el encuadre sea limitado.

Las actualizaciones siguen aplicándose únicamente desde el hub, sin forzar recargas ni borrar bibliotecas.

## Verificación

`tests/endo-document.test.mjs` cubre migración v1/v2, referencias, límites, operaciones de frames y exportación aislada. `tests/endo-layers.test.mjs` y `tests/endo-frames-render.test.mjs` verifican composición, ajustes por orden, clipping, borrado, calidad, presupuesto de memoria, cachés y PNG transparente/con fondo.

Las pruebas Chrome usan perfiles y carpetas OPFS temporales: `endo-ui-browser.mjs` para herramientas, temas, layout, guardado y exportación; `endo-editing-browser.mjs` para selección, borrado, colores e historial; `endo-frames-browser.mjs` para múltiples frames, efectos flotantes, orden de ajustes, calidad activa/inactiva, límites, PNG 2× y reapertura. `pwa-browser.mjs` y `folder-workspace.test.mjs` comprueban el hub, actualizaciones y almacenamiento de los siete Studios sin acceder a la biblioteca real.

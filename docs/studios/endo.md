# Endo — estado local, 29 Oct 2026

## Interfaz

Settings desapareció. El canvas ocupa la ventana y a la derecha quedan Preview y Layers; Layers utiliza el espacio anterior de Settings. Arriba, junto a los menús, están el selector de pincel, el acceso a su galería y el color de pintura. Paint color también está junto al zoom.

Color edita el color de pintura, permite HSB/RGB/HEX y compara el color anterior con el nuevo. OK confirma una sola operación de Undo; Cancel, Escape y la X revierten la sesión. Una previsualización sin confirmar no se guarda en disco. El primer clic en el canvas cancela Color sin dibujar.

Brush abre desde arriba, con clic secundario en el canvas o doble clic en Brush/Eraser. Presenta ocho presets de pinceles normales: redondo, suave, fino, grueso, cuadrado, biselado, marcador y aerógrafo. Tamaño, dureza, opacidad, ángulo y dinámica modifican el gesto; no aplican materiales. Repeat tiene su propia ventana en R. Se conserva una única instancia de cada control.

Preview y Layers son paneles fijos: no tienen cierre ni colapsado. New Layer, Blending Options y Artboards utilizan temporalmente toda esa columna; vuelven al cerrar el editor lateral o crear el elemento. El editor lateral permanece abierto al pintar y cambiar de herramienta. Tab conserva la navegación de foco. Se ignoran las preferencias antiguas de colapsado. Fit descuenta los paneles visibles. Los avisos de guardado/error quedan junto al nombre del Project y Home permanece disponible si no se pudo abrir un archivo.

## Artboards

Un Project (.ment) contiene hasta 32 artboards independientes, de 64–2048 px por lado, con fondo y capas propios. La página de navegación no se exporta.

F activa la herramienta y reemplaza temporalmente Preview y Layers con presets de pantalla, cuadrados y papel. Elegir un preset crea un artboard y lo encuadra. También se puede dibujar su tamaño. El panel conserva nombre, posición, tamaño, fondo, duplicado y eliminación.

V selecciona el artboard desde el título, borde o área vacía. Ocho tiradores cambian tamaño; Shift mantiene proporción, Alt redimensiona desde el centro y las flechas desplazan 1 px (Shift: 10). Mover transporta contenido y regiones de repetición. Redimensionar conserva los gestos, recortando o ampliando el encuadre sin escalarlos. Un arrastre equivale a un Undo; Escape cancela.

## Pintura y capas

Se pinta color plano en la capa de dibujo activa, con puntas normales independientes de los materiales. No se crea una capa por gesto ni se cambia su nombre a Stroke N. El usuario crea o selecciona otra capa para cambiar de destino. Cada trazo sigue siendo individualmente editable.

Pintar con un ajuste activo crea una única capa de dibujo encima; los siguientes gestos la reutilizan. Esa creación y el primer gesto se deshacen juntos. Capas ocultas o bloqueadas no reciben pintura. El borrador afecta solo a la capa de dibujo activa.

Shift selecciona un rango y Cmd/Ctrl agrega o quita capas. Delete, duplicado, opacidad y reordenado trabajan con la selección. El orden relativo y el artboard se conservan; las capas bloqueadas quedan protegidas. Al borrar todas las capas de dibujo queda un destino vacío. Eliminar una capa elimina sus ajustes antiguos recortados, manteniendo la semántica anterior.

V selecciona trazos por clic, M por rectángulo y Shift combina selecciones. Arrastrar, copiar/pegar y duplicar conservan geometría editable e identificadores. Pincel y color afectan al próximo trazo hasta seleccionar contenido explícitamente. Los gestos de archivos antiguos conservan su aspecto; los nuevos usan el pincel normal.

## Materiales y acciones de capa

El botón de tres puntos, con clic izquierdo, abre Blending Options, Rasterize Layer, Merge Selected, Duplicate, Rename y Delete. El clic secundario abre el mismo menú. Cada capa tiene una miniatura real, actualizada cuando termina el gesto; los ajustes muestran el contenido acumulado y un distintivo de filtro.

Blending Options configura Chrome, Relief, Magnetic sand, Crayon, Cement y Powder sobre la capa, con intensidad, luz, relieve, textura y colores propios. Normal retira el efecto sin cambiar los gestos. El efecto respeta transparencia, orden de capas y filtros. No se guarda como un material de cada nuevo trazo.

Rasterizar convierte el aspecto de la capa en píxeles portables a 2× y conserva su identificador. Se puede seguir pintando y borrando sobre la base raster. Merge Selected combina capas contiguas visibles y desbloqueadas del mismo artboard, incluyendo sus ajustes seleccionados, sin alterar las demás capas. Ambas acciones conservan Undo y el formato .ment v2. Los píxeles usan codificación RGBA sin pérdida, con compresión por repeticiones cuando conviene, y viajan dentro del .ment.

## Filtros

El botón ◐ de Layers abre el catálogo por grupos. Cada efecto es una capa reordenable que modifica el contenido inferior del mismo artboard. Su miniatura o doble clic abre sus propiedades independientes; no hay configuración global en Settings.

Catálogo: Brightness, Contrast, Exposure, Saturation, Grayscale, Invert, Posterize, Threshold, Dither, Color Dither, Pigment Grain, Paper Texture, Crosshatch e Ink Wash. Los ajustes tonales usan porcentajes con centro neutro. Cada ventana conserva Preview, reset y eliminación.

Los filtros conservan alfa y gestos originales. Sus patrones usan coordenadas locales y semillas deterministas para mantener apariencia al desplazar la vista y al exportar. El catálogo define defaults, validación y controles. Los cuatro efectos anteriores conservan su apariencia.

## Calidad y exportación

High es el valor inicial: Retina hasta DPR 2 y presupuesto total de 6 millones de píxeles para las capas de dibujo activas. Standard usa hasta DPR 1,5 y 3 M píxeles. Draft usa DPR 1, densidad de 55 % y 1,2 M píxeles. Muchas capas limitan la resolución real; varios trazos dentro de una capa no dividen ese presupuesto. Los artboards inactivos mantienen miniaturas de 96 px.

El botón junto al zoom permite cambiar calidad. Es una preferencia local, no modifica el Project ni genera Undo. Las coordenadas conservan precisión entre pantalla, canvas Retina y documento.

PNG reconstruye el artboard elegido a 2× desde los gestos originales, con fondo opcional, capas, ajustes y recorte. Es independiente de la calidad de edición. El máximo sigue siendo 4096 × 4096. .ment v2 guarda el Project completo.

## Persistencia y alcance

Continúan File System Access como guardado principal, autoguardado a los cinco segundos, IndexedDB de recuperación, archivos portables e IDs estables. Un error de escritura bloquea edición y ofrece reintento o copia de emergencia. Las actualizaciones se aplican desde el hub.

Todo permanece local, sin commits, push ni publicación. 787b10f es el punto de retorno. El hub inicia Endo con el pincel normal. No se alteran los demás Studios.

## Endo 4.0 y Tremor

[Análisis inicial](endo-4-tremor-analysis.md): Motion por capa e independiente del material, reloj fuera del historial y de cachés estáticas, reutilización de Antenna/Signal, diferencias de Ghost/Settle, formato futuro, exportación y pruebas. La fusión no está implementada y Tremor no se modificó.

## Verificación

Unidades de motores, documento, filtros, capas múltiples, calidad, clipping, simetría, historial, exportación, artboards y almacenamiento. Chrome usa perfiles y OPFS temporales para UI, popups, capas, Retina, filtros, guardado/reapertura y recuperación de errores. Capturas en /private/tmp/basement-endo-*.png. No se usa la biblioteca real.

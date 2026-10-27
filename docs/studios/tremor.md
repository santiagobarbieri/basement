# Tremor — 14 Oct 2026

Studio de un único pincel vivo, separado de Endo. Modos de animación Antena, Señal y Fantasma; ancho/opacidad independientes de Amount, Speed, Roughness, Settle y Noise. Puntos originales intactos.

Lienzo amplio en coordenadas positivas y negativas, render del viewport con culling. Mano, Espacio + arrastre o botón central para pan; rueda/touchpad desplazan; pinza/Ctrl + rueda y botones controlan zoom. El jitter permanece activo durante dibujo y navegación. Preview fijo.

Selección múltiple Shift + clic; ⌘A/Ctrl+A en selección; Escape limpia. Edición y borrado del grupo con undo/redo. Tools: Mandala/Mirror. Fondo transparente o de color.

Export areas: marco dibujado o desde selección; nombre, X/Y/W/H editables, botón para centrar y quitar. GIF area elige todo, selección o marco. Medidas visibles antes de exportar. Loop de dos segundos: 25 cuadros × 80 ms, generado en worker. Salida ajustada al área, máximo 640px por lado y 320.000 píxeles por cuadro. Paleta GIF de 216 colores, transparencia binaria; los marcos no se pintan en la animación. Si el contenido está demasiado separado, se pide elegir un área más pequeña. Archivo Proyecto — Marco.gif.

.ment y guardado en la carpeta elegida conservan obra completa, marcos y vista de la última edición. La biblioteca del hub y la importación permiten retomar. El asentamiento se captura en el estado actual del GIF para que el loop repita su temblor sin envejecimiento adicional. Archivos anteriores sin marcos y con nombres antiguos de pincel se adaptan al cargar.

QA: dibujo lejano, edición grupal, marcos, dimensiones GIF, transparencia/fondo, nombres, historial y reapertura; diez pruebas automatizadas del conjunto de studios.

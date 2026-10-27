# Endo — estado actual, 27 Oct 2026

## Interfaz
Editor con la identidad del hub. Cabecera compacta con Home, nombre editable del Artboard, estado de guardado, Save, Folder y Export. Tema claro/oscuro compartido con Basement; cambiarlo no modifica los píxeles del Artboard ni el fondo transparente del PNG.

Barra rápida de 48 px a la izquierda: pincel (B), selección (V), mano (H), área de exportación (F), repetición y colores. El lienzo ocupa el centro; arriba muestra contexto de la herramienta e historial y abajo el zoom. El inspector derecho reúne Brush, Color, Repeat y Areas en pestañas accesibles por teclado, conservando el desplazamiento de cada grupo. La vista previa permanece fija en Brush; Surface & lighting es desplegable. La estructura admite controles adicionales sin repartir ajustes por todo el editor.

El inspector distingue ajustes para el próximo trazo, selección y superficie global. Los atajos de herramientas no interceptan campos de texto ni diálogos; Espacio permite desplazar temporalmente después de usar la barra rápida.

## Lienzo y navegación
Lienzo amplio con coordenadas negativas y positivas. Mano, Espacio + arrastre o botón central para desplazar; rueda/touchpad desplazan; pinza/Ctrl + rueda y botones controlan zoom. Render inmediato en viewport y refinamiento acotado en worker.

Ambas vistas usan el fondo del tema actual. Cambiar de tema invalida los bitmaps anteriores; al empezar y terminar un trazo no se alterna entre papel oscuro y gris claro. Ese fondo es solo de presentación y no se incluye en PNG ni en los datos del Artboard.

## Selección múltiple
Modo selección: clic reemplaza la selección; Shift + clic agrega o quita. ⌘A/Ctrl+A selecciona todos los trazos; Escape limpia. Ancho, propiedades de pincel, colores y presets se aplican al grupo; ajustes globales siguen compartidos. Valores numéricos diferentes muestran —. Delete borra el grupo; Undo/Redo y ⌘Z/Ctrl+Z, con Shift para rehacer, controlan el historial.

## Marcos y PNG
Export areas: Dibujar marco activa arrastre de un rectángulo; Desde selección crea un marco alrededor del grupo. Nombre editable, botón para centrarlo y controles X/Y/W/H para mover y cambiar tamaño. Quitar marco no borra trazos. Cambios con historial.
PNG area elige todo el contenido, selección o marco por nombre. Dimensiones visibles antes de exportar; exportaciones superiores a 16 MP u 8192px por lado se bloquean antes de reservar imagen. PNG transparente a 2 píxeles por unidad lógica; los marcos no se pintan en la imagen. Archivos por marco: Proyecto — Marco.png.

## Persistencia
El guardado automático en la carpeta elegida y .ment conservan el proyecto completo, marcos, nombres y vista de la última edición. Abrir desde la biblioteca del hub o importar .ment restaura los datos. Selección y objetivo de exportación no recortan el archivo editable. Sin cambio de fondo en Endo.

## Verificación
Pruebas automatizadas del motor, formatos, navegación y áreas de exportación. QA navegador: dibujo lejano, selección múltiple, edición de dos trazos sin alterar un tercero, marco desde selección y por arrastre, nombre/dimensiones de PNG, undo, guardado .ment completo y reapertura de marcos.

`node tests/endo-ui-browser.mjs` comprueba además dibujo con tres materiales, selección/edición e historial, navegación entre pestañas por ratón/teclado, áreas desde la barra rápida, atajos y paneo temporal, guardado real en OPFS temporal, diálogo de carpeta y foco, descarga de .ment y PNG transparente, temas sin alterar los píxeles, disposición a 1512×982 y 1280×720 y regreso seguro al hub.

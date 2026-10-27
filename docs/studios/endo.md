# Endo — estado actual, 14 Oct 2026

## Lienzo y navegación
Lienzo amplio con coordenadas negativas y positivas. Mano, Espacio + arrastre o botón central para desplazar; rueda/touchpad desplazan; pinza/Ctrl + rueda y botones controlan zoom. Render inmediato en viewport y refinamiento acotado en worker.

## Selección múltiple
Modo selección: clic reemplaza la selección; Shift + clic agrega o quita. ⌘A/Ctrl+A selecciona todos los trazos; Escape limpia. Ancho, propiedades de pincel, colores y presets se aplican al grupo; ajustes globales siguen compartidos. Valores numéricos diferentes muestran —. Delete borra el grupo, Return/Restore deshacen o rehacen.

## Marcos y PNG
Export areas: Dibujar marco activa arrastre de un rectángulo; Desde selección crea un marco alrededor del grupo. Nombre editable, botón para centrarlo y controles X/Y/W/H para mover y cambiar tamaño. Quitar marco no borra trazos. Cambios con historial.
PNG area elige todo el contenido, selección o marco por nombre. Dimensiones visibles antes de exportar; exportaciones superiores a 16 MP u 8192px por lado se bloquean antes de reservar imagen. PNG transparente a 2 píxeles por unidad lógica; los marcos no se pintan en la imagen. Archivos por marco: Proyecto — Marco.png.

## Persistencia
El guardado automático en la carpeta elegida y .ment conservan el proyecto completo, marcos, nombres y vista de la última edición. Abrir desde la biblioteca del hub o importar .ment restaura los datos. Selección y objetivo de exportación no recortan el archivo editable. Sin cambio de fondo en Endo.

## Verificación
Nueve pruebas automatizadas del motor, formatos, navegación y áreas de exportación. QA navegador: dibujo lejano, selección múltiple, edición de dos trazos sin alterar un tercero, marco desde selección y por arrastre, nombre/dimensiones de PNG, undo, guardado .ment completo y reapertura de marcos.

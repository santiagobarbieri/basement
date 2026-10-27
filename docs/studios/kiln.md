# Kiln — mosaico, primera iteración de 2.0

Un único efecto: imagen → grilla → azulejo según luminosidad. Se reemplazó la interfaz de Characters/Tiles/Cells por Mosaic. ASCII queda para un studio futuro de animación; vitrales y otros materiales no están implementados en esta etapa.

Set inicial de ocho piezas procedurales: Ivory, Petals, Rosette, Corner, Arabesque, Lattice, Medallion y Cobalt. El catálogo se ordena por luminosidad medida y asigna una pieza al tono de cada celda. Se puede activar/desactivar cada pieza manteniendo al menos una. Colores Glaze/Accent/Ceramic y cuatro presets. No se usan imágenes de terceros para los motivos.

Controles: tamaño de grilla, brillo/contraste (selector tonal), color de cerámica/imagen/esmalte, blur de imagen, juntas, textura, acabado Glaze, rotación y fondo. Cuadros de azulejos cuadrados y alfa de fuente conservada por celda. Render y exportación en worker. Preview fijo, cards y scroll lateral al estilo de los otros studios.

Guardado automático en la carpeta elegida, biblioteca del hub, import/export .ment y PNG. Fuentes grandes adaptadas a 16 MP. Los Artboards conservan imagen y ajustes editables.

Verificado con imagen 720×960: mosaico, contraste, undo, catálogo de ocho piezas, .ment v2 de material y PNG original. Esta es una base para seguir perfeccionando el mosaico con Santi, no un catálogo final de materiales.

### Movimiento y exportación HD
Movement activa una onda de contraste que cambia los azulejos sin desplazar la grilla. Brightness y Contrast tienen sliders independientes. El movimiento se guarda como opción editable, sin acumular cambios en undo.
El PNG es estático, con los ajustes tonales base: 6000 px de lado mayor, sujeto a un límite de 32 MP y 8192 px por lado. Los motivos se renderizan a la resolución de salida.

### Kiln — descarga GIF
Export → Descargar GIF: movimiento tonal en loop de 4 s, 40 cuadros a 10 fps, hasta 1000 px de lado mayor. Con Movement Off exporta un cuadro estático. Procesamiento en worker con progreso y nombre del proyecto; PNG HD sigue disponible. Verificado con ImageDecoder: 40 cuadros, variación de píxeles, archivo válido 720×960.

### GIF HD y mosaico continuo
GIF redibujado hasta 2400 px de lado mayor, limitado a 4 MP; paleta adaptativa de 255 colores más transparencia, compresión LZW, codificación cuadro por cuadro. QA Chrome decodifica 40 cuadros a 1732×2309; ejemplo pasó de 31 MB a 9 MB con mayor resolución. Juntas eliminadas y control Joints retirado; también se aplica a proyectos anteriores y exportaciones. Amount/Speed siguen controlando el movimiento y el GIF.

### Kiln — materiales
Surface: Ceramic Tiles, Glass Tiles, Wood Plates, Metal Plates, Woven Plates (lana), Stone Tiles. Cinco nuevos materiales procedurales con 8 tonos; paleta inicial y nombres de controles específicos. Respeta alpha, movimiento, Amount/Speed/Seed, undo y persistencia tiles.material. Material aplicado en preview y exportaciones mediante el mismo renderer. QA Chrome: cinco superficies renderizadas sin errores, inspección visual comparativa.

## Cierre de versión
**Kiln 2.0 cerrado por Santiago el 14 de octubre de 2026.** La versión activa es la referencia técnica; las pruebas de mosaicos y geometría están en tests/.

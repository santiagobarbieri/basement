# Foundry: crear una tipografía personal

La pantalla principal prioriza dibujar, probar y descargar. No requiere conocer términos técnicos.

1. Dibujá letras o usá «Empezar con un alfabeto». «Partir de una fuente» permite cargar una base de Google Fonts.
2. Abrí el selector de trazo y compará las diez miniaturas. Elegí el estilo y su grosor; redondez o separación aparecen según corresponda. Cada letra sigue siendo editable.
3. «Completar acentos» crea los que faltan a partir de tus vocales, N y U; conserva los existentes.
4. «Ajustar tipografía» calcula alturas, avances y kerning a partir de perfiles horizontales. Conserva los dibujos y se puede deshacer. Repetilo después de cambiar el diseño.
5. Probá palabras y frases en Live Type. Exportá TTF u OTF para instalar, WOFF2 para web, o .ment para seguir editando.

## Interfaz avanzada pendiente
El acceso muestra un candado y Coming soon. El modelo conserva compatibilidad con grilla, espaciado, excepciones por letra, métricas, kerning, componentes, reglas y validación. Los componentes guardan los módulos propios de una letra; sus usos se actualizan al sobrescribir el componente con el mismo nombre. Convertir vínculos en módulos permite editarlos independientemente.

## Alcance de la automatización
Es una aproximación óptica determinista, no una evaluación estética. Calcula separaciones entre perfiles de letras que coinciden en altura, con límites que evitan avances negativos. Las alturas se estiman de las mayúsculas cuando existen. Los dibujos expresivos pueden necesitar retoques en algunos pares.

## Exportación y validación
Las fuentes contienen Unicode, métricas, avances y kerning GPOS + kern. Los contornos superpuestos se unen antes de exportar. Se relee el archivo y se verifica que el navegador lo acepte. La validación de diseño informa letras vacías, exceso de límites y pares problemáticos; no reemplaza una revisión visual.

Motores locales: [opentype.js](https://github.com/opentypejs/opentype.js), [fonteditor-core](https://github.com/kekee000/fonteditor-core), [polygon-clipping](https://github.com/mfogel/polygon-clipping). Versiones y licencias en dist/foundry/vendor.

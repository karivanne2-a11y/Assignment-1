# _cerebro — bóveda Obsidian

Bóveda de notas que **describe** el proyecto sin mover sus archivos. Ábrela en Obsidian con "Open folder as vault" → `_cerebro/`.

## Estructura
- `00-Mapa.md` — índice general; punto de entrada. Enlaza todas las notas.
- `temas/` — una nota por tema / notebook / subcarpeta del proyecto.
- `Proyecto.md` — estructura del repo, integrantes, cómo ejecutar, pendientes.
- `.obsidian/` — configuración mínima (grafo con etiquetas visibles).

## Convenciones
- Toda nota lleva frontmatter con `tags: [tesis2026, …]`; la etiqueta `tesis2026` une todo el grafo.
- Primera línea de cada nota: `↑ [[00-Mapa]]` + enlace relativo al archivo original (`../../archivo`).
- Enlaces internos con `[[Nombre]]`; sección `## Conexiones` para relacionar temas entre sí.
- Nunca mover ni copiar los originales: solo enlazarlos.

## Reusar en otro proyecto
1. Copia `_cerebro/` (con `CLAUDE.md` y `.obsidian/`) a la raíz del proyecto.
2. Cambia la etiqueta `tesis2026` por la del nuevo proyecto.
3. Crea una nota en `temas/` por cada subcarpeta o tema, y regístrala en `00-Mapa.md`.

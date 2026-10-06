# CLAUDE.md

Contexto rápido para Claude: leer esto antes que los notebooks para ahorrar tokens.

## Proyecto
Tarea 1 de Fundamentos de Python (Diplomado PUCP). Solo notebooks Jupyter, sin código fuente ni tests.

| Archivo | Tema |
|---|---|
| `lists.ipynb` | `append()`, `sort()`, `max()`, `min()`, `len()` |
| `tuples.ipynb` | indexación, `max/min/len`, inmutabilidad |
| `dictionaries.ipynb` | `keys()`, `get()`, agregar, `pop()` |
| `numpy.ipynb` | `arange`, `zeros`, `ones`, matrices, `.shape` |

## Reglas para ahorrar tokens
- No abrir `dictionaries (1).ipynb`: es copia idéntica de `dictionaries.ipynb`.
- `download` es un fragmento de `.gitignore` subido por error; ignorarlo.
- Leer solo el notebook que pida la tarea, no todos.
- Para inspeccionar un notebook, preferir solo las celdas de código:
  `jupyter nbconvert --to markdown --stdout <archivo>.ipynb` o
  `python -c "import json,sys;[print(''.join(c['source'])) for c in json.load(open(sys.argv[1]))['cells']]" <archivo>.ipynb`
- Respuestas breves; en español.

## Ejecutar
```bash
pip install numpy jupyter
jupyter notebook
```

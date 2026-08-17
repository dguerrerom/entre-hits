# ADR 0001: Fuentes de conteos por publicación

- Estado: aceptada
- Fecha: 2026-08-17

## Contexto

Los conteos semanales y anuales se almacenaban en archivos históricos consolidados. La edición semanal más reciente permanecía además en un archivo separado hasta una consolidación manual futura.

Ese modelo mezclaba dos convenciones para el mismo tipo de dato, obligaba a reescribir archivos crecientes y dejaba implícito cuándo mover una publicación al histórico. Mantener una edición en ambos lugares también podía producir duplicados.

## Decisión

Cada publicación editorial tiene un único archivo canónico:

- Una edición semanal vive en `content/weekly/YYYY/YYYY-MM-DD-NN.csv`.
- El archivo semanal contiene exactamente 10 posiciones nacionales y 10 internacionales.
- Un cierre anual vive en `content/annual/YYYY.csv`.
- El archivo anual contiene exactamente 20 posiciones nacionales y 20 internacionales.
- Las dos categorías anuales se publican juntas y forman una unidad atómica.
- Las plantillas viven en `content/templates/` y no son fuentes ingeridas.
- No se mantienen archivos `history.csv` editables.
- Los JSON de `src/data/` son derivados reproducibles, no fuentes editoriales.

El generador valida que la ruta y el contenido coincidan, que cada archivo represente una sola publicación y que no existan fechas, ediciones, rangos o canciones duplicados donde no correspondan.

## Inserciones futuras

Una publicación nueva se crea a partir de la plantilla correspondiente y se añade como archivo nuevo. No requiere modificar publicaciones anteriores ni consolidar datos.

El nombre de un archivo semanal codifica año, fecha y número. El nombre de un cierre anual codifica su año. Esos valores deben coincidir con todas las filas del archivo.

## Correcciones

Una publicación integrada en `main` es inmutable por defecto. Si una fuente verificada demuestra un error, la corrección modifica el archivo canónico afectado mediante un commit o pull request explícito y la etiqueta `historical-correction`. La validación rechaza modificaciones y eliminaciones de publicaciones existentes sin esa etiqueta.

Al corregir una edición semanal antigua se deben revisar los campos derivados de ediciones posteriores, especialmente movimiento y semanas. Git conserva el estado previo; no se crea una copia paralela ni se reintroduce un histórico consolidado.

## Consecuencias

- Los cambios son pequeños y están aislados por publicación.
- Git muestra con claridad altas y correcciones.
- Desaparece el proceso manual de consolidación.
- Se reducen conflictos y riesgos de duplicación.
- El número de archivos aumenta aproximadamente una vez por semana, una escala adecuada para este repositorio.
- El lector debe recorrer directorios anuales y aplicar un contrato estricto a nombres y contenido.

## Alternativas descartadas

### Consolidar siempre en `history.csv`

Reescribe un archivo creciente, dificulta la revisión y exige eliminar manualmente el archivo independiente para evitar duplicados.

### Congelar `history.csv` y añadir solo archivos nuevos

Evita reescrituras inmediatas, pero conserva permanentemente dos modelos de almacenamiento y una excepción histórica innecesaria.

### Separar el cierre anual por categoría

Permitiría publicaciones parciales que no coinciden con la navegación ni con la decisión editorial de publicar Nacional e Internacional juntas.

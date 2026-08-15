# Entre Hits

Archivo y publicación digital de **Entre Hits**, la lista de éxitos del programa **Entre Mezclas** de **Radio Holguín La Nueva**.

**Sitio:** [entrehits.github.io](https://entrehits.github.io/)

## Organización

| Ámbito | Responsabilidad |
| --- | --- |
| Radio Holguín La Nueva | Titular del contenido editorial y la identidad de Entre Hits |
| Entre Mezclas | Programa de radio que presenta la lista |
| Entre Hits | Selección, organización y publicación de los rankings |
| Este repositorio | Archivo de datos, validación, sitio estático y despliegue |

La publicación se genera con Astro y se despliega en GitHub Pages desde `main`.

## Archivo

- Ediciones semanales Top 10, nacionales e internacionales.
- Cierres anuales Top 20 para ambas categorías.
- Catálogo de canciones con identificadores estables.
- Historial de posiciones, movimiento, semanas, reingresos y cierres anuales.
- Créditos editoriales, autoría y fuentes verificadas cuando están disponibles.

## Datos

`content/` contiene las fuentes editoriales:

| Ruta | Contenido |
| --- | --- |
| `content/songs/catalog.csv` | Catálogo canónico de canciones, títulos, artistas y versiones |
| `content/songs/metadata.csv` | Autoría y enlaces verificados |
| `content/weekly/history.csv` | Histórico semanal consolidado |
| `content/weekly/*.csv` | Nuevas ediciones semanales |
| `content/annual/history.csv` | Cierres anuales consolidados |
| `content/annual/*.csv` | Nuevos cierres anuales |

`scripts/build-chart-data.mjs` valida estas fuentes y genera los JSON de `src/data/`. Los archivos generados no se editan manualmente.

## Reglas editoriales

- Cada canción tiene un `id` público e inmutable.
- Los rankings referencian canciones únicamente mediante `songId`.
- `sourceTitle` conserva el título de la fuente; `displayTitle` contiene la presentación editorial.
- `primaryArtists`, `featuredArtists`, `remixers` y `authors` mantienen roles separados.
- Las listas dentro de los CSV usan `;` como separador.
- Los títulos en español usan sentence case; las estilizaciones verificadas se conservan.
- Los invitados se presentan con `con`; `&` solo se mantiene dentro de nombres oficiales.
- No se incorporan créditos, enlaces o grafías sin una fuente verificable.

## Mantenimiento

1. Registrar canciones nuevas en `content/songs/catalog.csv`.
2. Añadir autoría o enlaces en `content/songs/metadata.csv` cuando estén verificados.
3. Crear la edición desde `content/weekly/_template.csv` o `content/annual/_template.csv`.
4. Ejecutar `npm run check` y `npm run build`.
5. Integrar el cambio en `main`; GitHub Actions publica el sitio automáticamente.

La edición semanal requiere 10 posiciones nacionales y 10 internacionales, fecha de domingo en formato `YYYY-MM-DD` y referencias válidas a `songId`. Semanas y movimiento se calculan durante la generación.

## Desarrollo

Requiere Node.js 24.

```bash
npm install
npm run dev
npm run check
npm run build
```

## Licencias

El código usa licencia MIT. Los rankings, datos editoriales, textos, marca y recursos visuales no están incluidos en esa licencia y permanecen con todos los derechos reservados por Radio Holguín La Nueva. Consulta `CONTENT-LICENSE.md`.

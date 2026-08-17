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
| `content/weekly/YYYY/YYYY-MM-DD-NN.csv` | Una edición semanal completa por archivo |
| `content/annual/YYYY.csv` | Un cierre anual completo por archivo |
| `content/templates/weekly.csv` | Plantilla de 20 posiciones para una edición semanal |
| `content/templates/annual.csv` | Plantilla de 40 posiciones para un cierre anual |

`scripts/build-chart-data.mjs` valida estas fuentes y genera los JSON de `src/data/`. Los archivos generados no se editan manualmente.

No existe un CSV histórico consolidado: Git conserva el historial y cada publicación es su propia fuente canónica. La decisión y sus consecuencias se documentan en [`docs/decisions/0001-chart-source-layout.md`](docs/decisions/0001-chart-source-layout.md).

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
3. Crear la publicación desde la plantilla correspondiente en `content/templates/`.
4. Ejecutar `npm run check` y `npm run build`.
5. Integrar el cambio en `main`; GitHub Actions publica el sitio automáticamente.

### Nueva edición semanal

1. Copiar `content/templates/weekly.csv` a `content/weekly/YYYY/YYYY-MM-DD-NN.csv`.
2. Sustituir fecha, número y los 20 identificadores de canción.
3. Mantener 10 posiciones nacionales y 10 internacionales, ambas ordenadas del 1 al 10.
4. Comprobar que la fecha sea domingo y que cada `songId` exista en el catálogo.

El año del directorio, la fecha y el número del nombre deben coincidir con el contenido. Semanas y movimiento se calculan durante la generación.

### Nuevo cierre anual

1. Esperar a que Nacional e Internacional estén terminados.
2. Copiar `content/templates/annual.csv` a `content/annual/YYYY.csv`.
3. Sustituir el año y los 40 identificadores de canción.
4. Mantener 20 posiciones nacionales y 20 internacionales, ambas ordenadas del 1 al 20.

Las dos categorías forman una publicación atómica: un cierre anual parcial no es válido.

### Correcciones

Las publicaciones integradas en `main` se consideran inmutables por defecto. Una corrección histórica debe modificar únicamente el archivo afectado, usar un commit explícito, añadir la etiqueta `historical-correction` al pull request y revisar cualquier cambio derivado en movimiento o semanas posteriores. La validación rechaza cambios o eliminaciones de publicaciones existentes sin esa etiqueta. Nunca se crea una segunda copia corregida ni un agregado histórico manual.

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

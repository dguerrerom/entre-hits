# Entre Hits

Sitio estático de la lista de éxitos del programa **Entre Mezclas** de Radio Holguín La Nueva. Publica charts semanales Top 10 y cierres anuales Top 20, en variantes nacional e internacional.

## Funcionalidades

- Réplica web responsive del formato editorial original.
- Archivo de 95 ediciones semanales desde 2024 hasta el conteo #31 de 2026.
- Top 20 anuales de 2024 y 2025.
- Calendario con las semanas realmente disponibles.
- Selección automática del último domingo publicado según `America/Havana`.
- Indicadores de movimiento, nueva entrada y reingreso.
- Historial por canción con mejor puesto, apariciones, recorridos y cierres anuales.
- Descarga PNG en `1080x1350` para semanales y `1080x1920` para anuales.
- Enlace externo a la señal en vivo de CMKE, sin reproductor integrado.
- Generación completamente estática para GitHub Pages.

## Desarrollo

Requiere Node.js 24.

```bash
npm install
npm run dev
```

Validación y build:

```bash
npm run check
npm run build
```

La salida se genera en `dist/`. La URL configurada es:

```text
https://entrehits.github.io/
```

## Nueva Edición Semanal

Cada domingo se añade un solo CSV de 20 filas en `content/weekly/`. Se puede partir de `content/weekly/_template.csv`.

```csv
date,number,category,rank,songId
2026-08-23,32,national,1,cancion-nacional-id
2026-08-23,32,international,1,cancion-internacional-id
```

Reglas:

- Deben existir 10 filas `national` y 10 `international`.
- Las posiciones deben cubrir del 1 al 10 sin duplicados.
- La fecha debe ser domingo y usar `YYYY-MM-DD`.
- Cada `songId` debe existir en `content/songs/catalog.csv`.
- El nombre del archivo no determina los datos, pero se recomienda `YYYY-MM-DD-NN.csv`.
- Semanas, movimiento, `N` y `R` se calculan automáticamente.

Después se ejecuta:

```bash
npm run data
```

## Cierre Anual

Los cierres se cargan manualmente en `content/annual/`, con 20 posiciones por categoría. El archivo de ejemplo es `content/annual/_template.csv`.

```csv
year,category,rank,songId
2026,national,1,cancion-nacional-id
2026,international,1,cancion-internacional-id
```

## Catálogo De Canciones

`content/songs/catalog.csv` es la fuente canónica de títulos y créditos. Los rankings solo referencian su columna `id`; un ID publicado no debe cambiar aunque se corrija la presentación editorial.

Las columnas principales son:

- `sourceTitle`: título tal como aparece en la fuente consultada.
- `baseTitle`: título sin descriptor de versión.
- `displayTitle`: título que presenta el sitio, con sentence case en español y descriptores como `remezcla` o `versión`.
- `language`: `es`, `en`, `pt` o `multilingual`.
- `primaryArtists`, `featuredArtists` y `remixers`: roles separados; cada lista usa `;` entre nombres.
- `versionType`: `remix` o `version` cuando corresponda.
- `versionName`: nombre específico, por ejemplo `salsa`, `cumbia` o el remezclador.
- `versionStatus`: `independent` para una remezcla independiente verificada.
- `sourceName` y `sourceUrl`: procedencia verificable de una versión.

Ejemplo:

```csv
id,sourceTitle,baseTitle,displayTitle,language,primaryArtists,featuredArtists,remixers,versionType,versionName,versionStatus,sourceName,sourceUrl
fortnightcyrilremix-227943921e,"Taylor Swift - Fortnight (Feat. Post Malone) (CYRIL REMIX)",Fortnight,"Fortnight (remezcla de CYRIL)",en,"Taylor Swift","Post Malone",CYRIL,remix,CYRIL,independent,SoundCloud,https://soundcloud.com/...
```

La interfaz une listas con la puntuación y las conjunciones de `es-CU`. Los artistas invitados se introducen con `con`. `&` solo forma parte de un nombre cuando pertenece a su grafía oficial.

## Autores Y Enlaces

Los datos opcionales se incorporan en `content/songs/metadata.csv`:

```csv
songId,authors,youtube,spotify
cancion-id,"Autor 1;Autor 2",https://youtube.com/...,https://open.spotify.com/...
```

Los autores también se separan con `;`. Cada fila debe aportar al menos autores o un enlace verificado, pero no necesita contener los tres. La interfaz oculta los campos vacíos. Canciones distintas que comparten título se mantienen como registros independientes mediante sus IDs.

## Datos Históricos

`scripts/build-chart-data.mjs` valida las fuentes CSV de `content/` y genera:

- `src/data/weekly-editions.json`
- `src/data/annual-charts.json`
- `src/data/songs.json`

El histórico consolidado se conserva en `content/weekly/history.csv` y `content/annual/history.csv`. El catálogo editorial se mantiene en `content/songs/catalog.csv`; los créditos de autoría y enlaces verificados, en `content/songs/metadata.csv`.

## Publicación

El workflow `.github/workflows/deploy.yml` valida, construye y publica `dist/` mediante GitHub Pages en cada cambio a `main`.

En GitHub debe seleccionarse **Settings → Pages → Source → GitHub Actions**.

## Licencias

El código fuente está disponible bajo MIT. La licencia MIT no incluye rankings, datos editoriales, textos, identidad visual ni logotipos. Consulta `CONTENT-LICENSE.md` y `licenses/FiraSans-OFL.txt`.

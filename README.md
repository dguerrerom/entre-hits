# Entre Hits

Sitio estático de la lista de éxitos del programa **Entre Mezclas** de Radio Holguín La Nueva. Publica charts semanales Top 10 y cierres anuales Top 20, en variantes nacional e internacional.

## Funcionalidades

- Réplica web responsive del formato editorial original.
- Archivo de 94 ediciones semanales desde 2024 hasta el conteo #30 de 2026.
- Top 20 anuales de 2024 y 2025.
- Calendario con las semanas realmente disponibles.
- Selección automática del último domingo publicado según `America/Havana`.
- Indicadores de movimiento, nueva entrada y reingreso.
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
https://dguerrerom.github.io/entre-hits/
```

## Nueva Edición Semanal

Cada domingo se añade un solo CSV de 20 filas en `content/weekly/`. Se puede partir de `content/weekly/_template.csv`.

```csv
date,number,category,rank,artists,title
2026-08-16,31,national,1,"Artista","Canción"
2026-08-16,31,international,1,"Artista","Canción"
```

Reglas:

- Deben existir 10 filas `national` y 10 `international`.
- Las posiciones deben cubrir del 1 al 10 sin duplicados.
- La fecha debe ser domingo y usar `YYYY-MM-DD`.
- El nombre del archivo no determina los datos, pero se recomienda `YYYY-MM-DD-NN.csv`.
- Semanas, movimiento, `N` y `R` se calculan automáticamente.

Después se ejecuta:

```bash
npm run data
```

## Cierre Anual

Los cierres se cargan manualmente en `content/annual/`, con 20 posiciones por categoría. El archivo de ejemplo es `content/annual/_template.csv`.

```csv
year,category,rank,artists,title
2026,national,1,"Artista","Canción"
2026,international,1,"Artista","Canción"
```

## Autores Y Enlaces

Los datos opcionales se incorporan en `content/songs/metadata.csv`:

```csv
title,artists,authors,youtube,spotify
"Canción","Artista","Autor 1 & Autor 2","https://youtube.com/...","https://open.spotify.com/..."
```

Si no existen autores o enlaces verificados, la interfaz oculta esos campos.

## Datos Históricos

`scripts/build-chart-data.mjs` valida las fuentes CSV de `content/` y genera:

- `src/data/weekly-editions.json`
- `src/data/annual-charts.json`
- `src/data/songs.json`

El histórico consolidado se conserva en `content/weekly/history.csv` y `content/annual/history.csv`. Los créditos y enlaces verificados se mantienen en `content/songs/metadata.csv`.

## Publicación

El workflow `.github/workflows/deploy.yml` valida, construye y publica `dist/` mediante GitHub Pages en cada cambio a `main`.

En GitHub debe seleccionarse **Settings → Pages → Source → GitHub Actions**.

## Licencias

El código fuente está disponible bajo MIT. La licencia MIT no incluye rankings, datos editoriales, textos, identidad visual ni logotipos. Consulta `CONTENT-LICENSE.md` y `licenses/FiraSans-OFL.txt`.

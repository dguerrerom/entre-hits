import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://entrehits.github.io",
  trailingSlash: "always",
  build: {
    format: "directory",
  },
});

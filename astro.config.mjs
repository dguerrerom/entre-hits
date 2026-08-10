import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://dguerrerom.github.io",
  base: "/entre-hits",
  trailingSlash: "always",
  build: {
    format: "directory",
  },
});

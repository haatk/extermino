import { defineConfig } from 'vite';

// The site is served from a custom domain (see CNAME -> extermino.nl), so the
// app lives at the domain root. If you ever deploy to the default
// `https://<user>.github.io/extermino/` URL instead, change `base` to
// '/extermino/' to match the repo name.
export default defineConfig({
  base: '/',
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: true,
  },
});

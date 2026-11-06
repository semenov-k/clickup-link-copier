import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Relative asset paths, so the build works from any folder (e.g. GitHub Pages project URL).
  base: './',
  plugins: [tailwindcss()],
  // The demo reuses the extension's formatter from ../utils.
  server: { fs: { allow: ['..'] } },
});

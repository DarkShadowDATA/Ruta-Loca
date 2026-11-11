import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
// Todo el juego sale en un solo dist/index.html (igual que Noche de Leyendas).
export default defineConfig({
  plugins: [viteSingleFile()],
  build: { target: 'es2020', chunkSizeWarningLimit: 4000 },
});

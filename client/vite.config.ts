import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // PORT lets dev tools pick a free port; the API stays on API_PORT (3001).
    port: Number(process.env.PORT) || 5173,
    proxy: { '/api': `http://localhost:${process.env.API_PORT || 3001}` },
  },
});

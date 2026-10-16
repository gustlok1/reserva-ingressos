/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    // O navegador chama /api no mesmo endereço do frontend e o Vite repassa para o backend.
    // Mesma origem = o cookie de sessão funciona sem configurar CORS.
    proxy: {
      '/api': 'http://localhost:3333',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});

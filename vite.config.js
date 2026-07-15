import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    watch: {
      // Avoid EBUSY crashes when PDFs in this folder are open/locked on Windows
      ignored: ['**/sample statments/**', '**/sample statements/**'],
    },
  },
  preview: {
    host: true,
    port: 4173,
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      // Avoid EBUSY crashes when PDFs in this folder are open/locked on Windows
      ignored: ['**/sample statments/**', '**/sample statements/**'],
    },
  },
});

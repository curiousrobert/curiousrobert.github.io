import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // React is an integration
  integrations: [react()],
  vite: {
    // Tailwind v4 is a Vite plugin
    plugins: [tailwindcss()],
  },
});

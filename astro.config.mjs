import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Update this to your new professional domain
  site: 'https://curiousrobert.cc',
  base: '/',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});

// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// `site` is required for the sitemap integration and for absolute canonical /
// Open Graph URLs in Layout.astro. Update it here (one place) if the site ever
// moves to a custom domain.
// https://astro.build/config
export default defineConfig({
  site: 'https://radiant-ganache-56c528.netlify.app',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()]
  }
});

// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// `site` is required for the sitemap integration and for absolute canonical /
// Open Graph URLs in Layout.astro. Custom domain went live 2026-07-26; the
// netlify.app subdomain still resolves and is what Netlify serves internally,
// but every public URL should be the real one. The only other place the host
// is written down is public/robots.txt.
// https://astro.build/config
export default defineConfig({
  site: 'https://tommuncie.com',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()]
  }
});

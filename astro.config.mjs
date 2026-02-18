import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://kilserv.vercel.app/',
  output: 'static', // Back to static
  adapter: vercel({
    webAnalytics: { enabled: true },
  }),
});
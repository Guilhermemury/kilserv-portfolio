import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://kilserv.vercel.app/',
  adapter: vercel(),
  compressHTML: true
});
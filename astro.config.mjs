import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://kilserv.vercel.app/',
  output: 'hybrid', // <--- IMPORTANT
  adapter: vercel(),
  compressHTML: true
});
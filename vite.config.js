import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// Relative base so the app works both locally and when served from a
// GitHub Pages project subpath (e.g. https://user.github.io/seizure-tracker/).
export default defineConfig({
  base: './',
  plugins: [svelte()],
})

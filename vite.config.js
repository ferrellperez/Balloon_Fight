import { defineConfig } from 'vite';

// GitHub Pages serves project sites from a /<repo-name>/ subpath, not the domain root.
export default defineConfig({
  base: '/Balloon_Fight/',
});

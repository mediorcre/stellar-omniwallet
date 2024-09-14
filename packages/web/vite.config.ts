import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// Importing and using the buffer plugin
// import rollupNodePolyFill from 'rollup-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills(),
  ],
  // build: {
  //   rollupOptions: {
  //     plugins: [
  //       rollupNodePolyFill(), // Use this to include Buffer polyfill
  //     ],
  //   },
  // },
});
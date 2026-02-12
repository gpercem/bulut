import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [
    // Ensure real `react` imports inside src/react.tsx stay external and are
    // NOT aliased to preact/compat by the Preact preset.
    {
      name: 'preserve-react-externals',
      enforce: 'pre',
      resolveId(source, importer) {
        if (
          importer &&
          importer.replace(/\\/g, '/').endsWith('src/react.tsx') &&
          (source === 'react' || source === 'react-dom' || source.startsWith('react/'))
        ) {
          return { id: source, external: true };
        }
        return null;
      },
    },
    preact(),
  ],
  build: {
    lib: {
      entry: {
        index: 'src/react.tsx',
        embed: 'src/index.tsx',
      },
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        exports: 'named',
      },
    },
    minify: 'terser',
    sourcemap: true,
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
});

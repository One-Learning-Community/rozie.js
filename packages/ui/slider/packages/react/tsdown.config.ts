import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // The generated barrel re-exports both the named component (`Slider`) and
  // its `default`. Opt into rolldown 'named' export mode so the mix is
  // unambiguous (the default lands on `exports.default` for CJS consumers).
  outputOptions(options) {
    return { ...options, exports: 'named' };
  },
  external: ['react', 'react-dom', '@rozie/runtime-react', /\.css$/],
  // The generated component does a side-effect `import './Slider.css'`; mark
  // it external and copy the file into dist so the relative specifier resolves
  // at the consumer's bundler.
  copy: [{ from: 'src/Slider.css', to: 'dist', flatten: true }],
});

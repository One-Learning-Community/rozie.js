const esbuild = require('esbuild');
module.exports = function (source) {
  const callback = this.async();
  esbuild.transform(source, {
    loader: 'ts',
    target: 'es2022',
    format: 'esm',
    sourcefile: this.resourcePath,
  }).then(
    (out) => callback(null, out.code, out.map ? JSON.parse(out.map) : undefined),
    (err) => callback(err),
  );
};

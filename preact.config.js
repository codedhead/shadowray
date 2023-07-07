/* eslint-disable @typescript-eslint/no-empty-function */
import CopyWebpackPlugin from 'copy-webpack-plugin';
import path from "path";
import glslLoader from 'webpack-glsl-loader';

export default (config, env, helpers) => {
  if (env.isProd) {
    config.devtool = false;
  }
  config.plugins.push(
    new CopyWebpackPlugin({
      patterns: [{
        from: '*.wasm',
        context: path.resolve(__dirname, 'node_modules/webrtx/dist'),
      }, {
        from: '**/*',
        to: 'assets',
        context: path.resolve(__dirname, 'rt_assets'),
        globOptions: {
          ignore: [
            "**/*.glsl",
            // "**/*.vert",
            // "**/*.frag",
            // "**/*.comp",
            // "**/*.rgen",
            // "**/*.rint",
            // "**/*.rchit",
            // "**/*.rahit",
            // "**/*.rmiss",
          ]
        }
      }, {
        // only compile common.glsl
        from: '**/*',
        to: 'assets',
        context: path.resolve(__dirname, 'rt_assets'),
        filter: (resourcePath) => {
          // TODO: /common.glsl
          return resourcePath.endsWith('common.glsl');
        },
        transform: (content, absoluteFrom) => {
          return Promise.resolve(new Promise((resolve, reject) => {
            const finalCb = (err, result) => {
              if (err) {
                reject(err);
              } else {
                resolve(`#ifndef _SHADOWRAY_PLAYGROUND_COMMON_\n#define _SHADOWRAY_PLAYGROUND_COMMON_\n${result}\n#endif`);
              }
            };
            glslLoader.call({
                getOptions: () => ({
                  omitModuleExports: true
                }),
                ['async']: () => finalCb,
                cacheable(flag = true) {},
                context: path.dirname(absoluteFrom),
                addDependency(f) {},
                resolve(context, relativeFilename, cb) {
                  // just join paths, nothing special
                  cb(null, path.join(context, relativeFilename));
                },
              },
              content.toString());
          }));
        },
      }]
    }),
  );
}
import nodeResolve from "@rollup/plugin-node-resolve";
// import commonjs from '@rollup/plugin-commonjs';
import { terser } from "rollup-plugin-terser";
// import virtual from "@rollup/plugin-virtual";

export default () => {
  return [
    {
      input: "src/dungeondraw.js",
      output: {
        file: "modules/dungeondraw-bundle.min.js",
        format: "es",
        plugins: [ terser() ],
        preferConst: true,
      },
      plugins: [
        nodeResolve(),
      ],
    },
    // {
    //   input: "pack",
    //   output: [
    //     {
    //       file: "dist/jsts.js",
    //       format: "es",
    //       plugins: [],
    //       preferConst: true,
    //       //sourcemap: s_SOURCEMAP,
    //     },
    //   ],
    //   plugins: [
    //     virtual({
    //       pack: `import jsts from './node_modules/jsts/dist/jsts.js';`,
    //     }),
    //   ],
    // },    
    // {
    //   input: "pack",
    //   output: [
    //     {
    //       file: "dist/pixi-filter-alpha.js",
    //       format: "es",
    //       plugins: [],
    //       preferConst: true,
    //       //sourcemap: s_SOURCEMAP,
    //     },
    //   ],
    //   plugins: [
    //     virtual({
    //       pack: `import { AlphaFilter, BlurFilterPass } from './node_modules/@pixi/filter-alpha/dist/esm/filter-alpha.js';`,
    //     }),
    //   ],
    // },
    // {
    //   input: "pack",
    //   output: [
    //     {
    //       file: "dist/pixi-filter-blur.js",
    //       format: "es",
    //       plugins: [],
    //       preferConst: true,
    //       //sourcemap: s_SOURCEMAP,
    //     },
    //   ],
    //   plugins: [
    //     virtual({
    //       pack: `import { BlurFilter, BlurFilterPass } from './node_modules/@pixi/filter-blur/dist/esm/filter-blur.js';`,
    //     }),
    //   ],
    // },
  ];
};

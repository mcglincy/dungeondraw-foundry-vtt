import nodeResolve from "@rollup/plugin-node-resolve";
import { terser } from "rollup-plugin-terser";
import commonjs from "rollup-plugin-commonjs";

export default () => {
  return [
    {
      input: "src/dungeondraw.js",
      output: {
        file: "modules/dungeondraw-bundle.min.js",
        format: "es",
        plugins: [terser()],
        preferConst: true,
        sourcemap: true,
      },
      plugins: [nodeResolve(), commonjs()],
    },
  ];
};

import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import commonjs from "@rollup/plugin-commonjs";

export default () => {
  return [
    {
      input: "src/dungeondraw.js",
      output: {
        file: "modules/dungeondraw-bundle.min.js",
        format: "es",
        plugins: [
          terser({
            keep_classnames: true,
          }),
        ],
        sourcemap: true,
      },
      plugins: [nodeResolve(), commonjs()],
      // Ignore circular dependencies inside third-party packages (jsts has
      // several), so that any cycle introduced in src/ is not buried in noise.
      onwarn(warning, warn) {
        if (
          warning.code === "CIRCULAR_DEPENDENCY" &&
          warning.ids?.every((id) => id.includes("node_modules"))
        ) {
          return;
        }
        warn(warning);
      },
    },
  ];
};

import { readFileSync } from "node:fs";
import { defineConfig } from "tsup";

const { version } = JSON.parse(readFileSync("package.json", "utf8")) as {
  version: string;
};

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  target: "node18",
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  define: { __MYTPE_VERSION__: JSON.stringify(version) },
});

import { build } from "esbuild";

const shared = {
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  minify: false,
};

await Promise.all([
  build({
    ...shared,
    entryPoints: ["src/index.ts"],
    outfile: "dist/index.js",
    banner: { js: "#!/usr/bin/env node" },
  }),
  build({
    ...shared,
    entryPoints: ["src/http-server.ts"],
    outfile: "dist/http-server.js",
  }),
]);

console.log("Build ukończony: dist/index.js, dist/http-server.js");

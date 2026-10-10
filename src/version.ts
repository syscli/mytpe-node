// The package version, filled in from package.json at build time. Running from
// source without the build define reports a dev version instead.
declare const __MYTPE_VERSION__: string | undefined;

export const VERSION: string =
  typeof __MYTPE_VERSION__ === "string" ? __MYTPE_VERSION__ : "0.0.0-dev";

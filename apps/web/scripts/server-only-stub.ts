/**
 * No-op stand-in for the `server-only` package, used only by the CLI scripts in
 * this directory.
 *
 * `server-only` exists to stop server modules reaching the browser bundle. It
 * does that by throwing on import outside a React server render. A Node CLI
 * script has no browser output at all, so the guard is pure noise there, and it
 * blocks exactly the scripts that should run the server code closest to how the
 * app does.
 *
 * The stub is injected through a tsx alias in package.json rather than by
 * patching node_modules, so it is visible in the repo and disappears when the
 * app is built.
 */
export {};

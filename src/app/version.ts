/** The version of the webapp, embedded at its build (vite.config.js): its release tag, or how far past one. */
declare const __APP_VERSION__: string | undefined;

export const APP_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "";

/** Whether a version is exactly a release, neither past it nor dirty. */
export const isRelease = (version: string, release: string) => version !== "" && version.replace(/^v/, "") === release.replace(/^v/, "");

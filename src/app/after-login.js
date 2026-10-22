/**
 * The page a sign-in returns to: the one a protected route turned away for want of
 * a session, kept for the tab only. A link to a page of the webapp (the token page
 * of a node to enroll, say) so lands there once signed in, not on the objects.
 */
const KEY = "om3.afterLogin";

/** The pages of the sign-in itself: never one to return to. */
const AUTH_PATHS = ["/auth-choice", "/auth/login", "/auth-callback", "/silent-renew"];

/** Remembers `path` (with its query) as the page to return to after the sign-in. */
export function rememberReturn(path) {
    if (typeof path !== "string" || !path.startsWith("/") || AUTH_PATHS.some((p) => path.startsWith(p))) return;
    try {
        sessionStorage.setItem(KEY, path);
    } catch {
        // Not remembered: the sign-in ends on the objects, as before.
    }
}

/** The page to return to, forgotten once read; "/" when none. */
export function takeReturn() {
    try {
        const path = sessionStorage.getItem(KEY);
        sessionStorage.removeItem(KEY);
        return path && path.startsWith("/") ? path : "/";
    } catch {
        return "/";
    }
}

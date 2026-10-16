import {useState, useCallback} from "react";
import {NavLink} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {cn} from "../ui/cn";
import {ObjectIcon} from "../ui/components/ObjectIcon";
import useSidebarAlerts from "../hooks/useSidebarAlerts";

// Icons of the oc3 menu, glyph and tint (ObjectIcon): nodes, networks, pools as
// disks, objects as services, and the om3 kinds drawn from the same set.
// The cluster overview and the user page are reached from the top bar: the logo
// and the user button. Entries in alphabetical order.
// `labelKey` is the catalog key of the entry name, translated at render.
export const NAV_ROUTES = [
    {path: "/heartbeats", labelKey: "nav.routes.heartbeats", kind: "heartbeat"},
    {path: "/network", labelKey: "nav.routes.networks", kind: "network"},
    {path: "/nodes", labelKey: "nav.routes.nodes", kind: "node"},
    // Its tabs list the objects by namespace and by kind too.
    {path: "/objects", labelKey: "nav.routes.objects", kind: "service"},
    {path: "/pools", labelKey: "nav.routes.pools", kind: "pool"},
];

/** The tint of an alert badge: orange for warn, red for down, the oc3 state colours. */
const ALERT_TINT = {warn: "bg-state-warn", down: "bg-state-down"};

/**
 * The alert of an entry, when something calls for attention: a round badge over
 * the right end of its link, orange or red, what it is about in its tooltip and
 * for screen readers. None while all is well: the menu counts nothing.
 */
function AlertBadge({path, alert}) {
    return (
        <span
            role="img"
            aria-label={alert.text}
            title={alert.text}
            data-testid={`alert-${path.slice(1)}`}
            data-level={alert.level}
            className={cn(
                "pointer-events-auto absolute top-1/2 right-2 inline-flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full text-[0.6875rem] leading-none font-bold text-surface-raised",
                ALERT_TINT[alert.level],
            )}
        >
            <span aria-hidden="true">!</span>
        </span>
    );
}

const SIDEBAR_KEY = "om3.sidebar";

/** Folding the menu is a display comfort, specific to the browser: it does not go in the URL. */
function readSidebarOpen() {
    try {
        return localStorage.getItem(SIDEBAR_KEY) !== "closed";
    } catch {
        // Private browsing or storage refused: the menu opens, as by default.
        return true;
    }
}

/** Open state of the sidebar, remembered in local storage. */
export function useSidebarOpen() {
    const [open, setOpen] = useState(readSidebarOpen);
    const toggle = useCallback(() => {
        setOpen((previous) => {
            const next = !previous;
            try {
                localStorage.setItem(SIDEBAR_KEY, next ? "open" : "closed");
            } catch {
                // Preference not remembered: without consequence for the current session.
            }
            return next;
        });
    }, []);
    return [open, toggle];
}

const LINK = "flex items-center gap-2 rounded-(--radius-control) px-2 py-1 text-ink-muted hover:text-ink";

/**
 * Entries of the menu; the children of an entry are listed under it, indented
 * along a line that ties them to it.
 */
function NavList({routes, alerts, nested = false}) {
    const {t} = useTranslation();
    return (
        <ul className={cn(nested && "ml-4 border-l border-line pl-1")}>
            {routes.map(({path, labelKey, kind, children}) => (
                <li key={path}>
                    <div className="relative">
                        <NavLink
                            to={path}
                            // Mouseover details of the entries that have some.
                            title={alerts[path]?.details?.join("\n")}
                            className={({isActive}) => cn(LINK, isActive && "bg-accent-soft text-ink")}
                        >
                            {/* The icon keeps its tint in every state: it identifies the view,
                                the background and the label mark the selection. */}
                            <ObjectIcon kind={kind} className="h-4 w-4"/>
                            {t(labelKey)}
                        </NavLink>
                        {alerts[path]?.alert && <AlertBadge path={path} alert={alerts[path].alert}/>}
                    </div>
                    {children && <NavList routes={children} alerts={alerts} nested/>}
                </li>
            ))}
        </ul>
    );
}

/**
 * From the keyboard, as in oc3: "n" brings the focus to the menu (App), the arrows
 * move from one entry to the next, Home and End go to the ends, and Escape gives
 * the focus back to the page.
 */
function onMenuKeyDown(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "Escape") {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        return;
    }
    const stops = [...event.currentTarget.querySelectorAll("a")];
    const at = stops.findIndex((element) => element === document.activeElement);
    const next =
        event.key === "ArrowDown" ? stops[Math.min(at + 1, stops.length - 1)]
            : event.key === "ArrowUp" ? stops[Math.max(at - 1, 0)]
                : event.key === "Home" ? stops[0]
                    : event.key === "End" ? stops[stops.length - 1]
                        : undefined;
    if (next === undefined) return;
    event.preventDefault();
    next.focus();
}

/**
 * Side menu, after the oc3 one. Foldable from the button at the top left of the
 * header: folded, it keeps its place in the layout but not its width, and `inert`
 * takes it out of the keyboard path.
 */
export function Sidebar({open}) {
    const alerts = useSidebarAlerts();
    const {t} = useTranslation();
    return (
        <aside
            id="app-sidebar"
            inert={!open}
            className={cn(
                "shrink-0 overflow-x-hidden overflow-y-auto border-r border-line bg-surface-raised transition-[width] duration-200 ease-out",
                open ? "w-60" : "w-0 border-r-0"
            )}
        >
            <nav aria-label={t("nav.main")} aria-keyshortcuts="n" onKeyDown={onMenuKeyDown} className="w-60 p-2">
                <NavList routes={NAV_ROUTES} alerts={alerts}/>
            </nav>
        </aside>
    );
}

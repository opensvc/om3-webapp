import { useId } from "react";

/** Attributes of the panel bound to the active tab. */
export function tabPanelProps(idPrefix: string, key: string) {
  return {
    id: `${idPrefix}-panel-${key}`,
    role: "tabpanel" as const,
    "aria-labelledby": `${idPrefix}-tab-${key}`,
    tabIndex: 0,
  };
}

/** Stable id linking a tab bar and its panels. */
export function useTabsId(): string {
  return useId().replace(/:/g, "");
}

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { PanelSideContext } from "../ui/components/panel-side";
import { usePanelSidePref } from "./panel-side-pref";

/**
 * Gives the side panels the edge of the window they open against, chosen in this
 * browser, and the button that moves them to the other one, as in oc3.
 */
export function PanelSideProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const pref = usePanelSidePref();
  const side = pref.value;
  return (
    <PanelSideContext.Provider
      value={{
        side,
        switchSide: () => {
          pref.set(side === "left" ? "right" : "left");
        },
        switchLabel: side === "left" ? t("panelSide.toRight") : t("panelSide.toLeft"),
      }}
    >
      {children}
    </PanelSideContext.Provider>
  );
}

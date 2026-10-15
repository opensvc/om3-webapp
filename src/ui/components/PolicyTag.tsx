import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { FactName } from "../../app/statusboard";
import { InstanceIcon, RefreshIcon, ServerIcon } from "../icons";

/**
 * The icon of each policy, for its tag to tell which policy it states: "ha" or
 * "nodes order" alone do not say what they are about. Tinted by family, as oc3
 * paints the columns of its services: the service tint for what the object does,
 * the node tint for where it runs.
 *
 * - topology, how the instances run: the service instance;
 * - orchestrate, what the daemon does of the object on its own: the loop of its runs;
 * - placement, which node first: the server.
 *
 * The classes are written out in full: Tailwind does not see names built at runtime.
 */
const POLICY_ICON: Record<FactName, { Icon: (props: { className?: string }) => ReactNode; className: string }> = {
  topology: { Icon: InstanceIcon, className: "text-icon-service" },
  orchestrate: { Icon: RefreshIcon, className: "text-icon-service" },
  placement: { Icon: ServerIcon, className: "text-icon-node" },
};

/**
 * A policy of an object as a tag: its icon, its value. The policy is named in the
 * tooltip and for screen readers, the icon alone not being enough.
 */
export function PolicyTag({ name, value, children }: { name: FactName; value: string; children?: ReactNode }) {
  const { t } = useTranslation();
  const { Icon, className } = POLICY_ICON[name];
  const label = t(`ui.policies.${name}`);
  return (
    <span
      title={`${label}: ${value}`}
      data-policy={name}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-line bg-surface px-1.5 text-data text-ink-muted"
    >
      <span aria-hidden="true" className={`inline-flex shrink-0 ${className}`}>
        <Icon className="h-3 w-3" />
      </span>
      <span className="sr-only">{label}: </span>
      {value}
      {children}
    </span>
  );
}

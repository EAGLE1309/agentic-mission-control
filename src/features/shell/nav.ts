import {
  IconArrowsJoin,
  IconEdit,
  IconGauge,
  IconHistory,
  IconInbox,
  IconPencil,
  IconSettings,
  IconSitemap,
  IconTelescope,
  IconTemplate,
  IconTool,
  type Icon,
} from "@tabler/icons-react";
import type { AgentRole } from "@/shared/agents";

export type NavItem = { href: string; label: string; icon: Icon };

// Sidebar order (design §6.1). Usage and Settings are reached from the quota
// card and the user menu, and from the command palette.
export const PRIMARY_NAV: readonly NavItem[] = [
  { href: "/home", label: "New mission", icon: IconEdit },
  { href: "/inbox", label: "Inbox", icon: IconInbox },
  { href: "/missions", label: "Missions", icon: IconHistory },
];

export const SECONDARY_NAV: readonly NavItem[] = [
  { href: "/templates", label: "Templates", icon: IconTemplate },
  { href: "/tools", label: "Tools", icon: IconTool },
];

export const PAGES: readonly NavItem[] = [
  ...PRIMARY_NAV,
  ...SECONDARY_NAV,
  { href: "/agents", label: "Agents", icon: IconSitemap },
  { href: "/usage", label: "Usage", icon: IconGauge },
  { href: "/settings", label: "Settings", icon: IconSettings },
];

export const AGENT_NAV: readonly { role: AgentRole; label: string; icon: Icon }[] = [
  { role: "orchestrator", label: "Orchestrator", icon: IconSitemap },
  { role: "researcher", label: "Researcher", icon: IconTelescope },
  { role: "writer", label: "Writer", icon: IconPencil },
  { role: "assembler", label: "Assembler", icon: IconArrowsJoin },
];

/** `/missions` is active for `/missions/abc` too. `/home` is active only on itself. */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/home") return pathname === "/home";
  return pathname === href || pathname.startsWith(`${href}/`);
}

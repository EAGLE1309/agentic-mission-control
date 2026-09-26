import {
  IconArrowsJoin,
  IconFilePencil,
  IconFileText,
  IconPencil,
  IconRefresh,
  IconSitemap,
  IconTelescope,
  IconWorldDownload,
  IconWorldSearch,
  type Icon,
} from "@tabler/icons-react";
import type { ToolName } from "@/shared/events";
import type { NodeRole } from "@/shared/plan";
import type { ToolCallStatus } from "@/shared/reducer";
import type { StatusKind } from "./status";

// The icon map of design §4. Do not use a different icon for these meanings.

export const ROLE_ICON: Record<NodeRole, Icon> = {
  orchestrator: IconSitemap,
  researcher: IconTelescope,
  writer: IconPencil,
  assembler: IconArrowsJoin,
  report: IconFileText,
  revision: IconRefresh,
};

/** The UI word for each role (design §2): "Agent", never "node" or "worker". */
export const ROLE_LABEL: Record<NodeRole, string> = {
  orchestrator: "Orchestrator",
  researcher: "Researcher",
  writer: "Writer",
  assembler: "Assembler",
  report: "Report",
  revision: "Revision",
};

export const TOOL_ICON: Record<ToolName, Icon> = {
  web_search: IconWorldSearch,
  fetch_url: IconWorldDownload,
  write_section: IconFilePencil,
};

export function toolCallStatusKind(status: ToolCallStatus): StatusKind {
  switch (status) {
    case "running":
      return "running";
    case "ok":
      return "done";
    case "error":
      return "failed";
    case "cancelled":
      return "killed";
  }
}

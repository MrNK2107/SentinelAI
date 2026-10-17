import {
  LayoutDashboard,
  PlayCircle,
  Map,
  LineChart,
  Workflow,
  FileCheck2,
  MessageSquareText,
  Search,
  Boxes,
  ShieldAlert,
  Scale,
  Radar,
  Network,
  Layers,
} from "lucide-react";

export type NavItem = {
  title: string;
  to: string;
  icon: typeof LayoutDashboard;
  status?: "live" | "critical" | "warn";
};

// Labels match their destinations.
export const primaryNav: NavItem[] = [
  { title: "Dashboard", to: "/", icon: LayoutDashboard, status: "live" },
  { title: "Digital Twin", to: "/digital-twin", icon: Map },
  { title: "Geospatial & Vision", to: "/geospatial", icon: Radar },
  { title: "Knowledge Graph", to: "/graph", icon: Network },
  { title: "Live Replay", to: "/live-replay", icon: PlayCircle },
  { title: "Risk Analytics", to: "/risk-analytics", icon: LineChart },
  { title: "Command Center", to: "/command-center", icon: ShieldAlert, status: "critical" },
  { title: "Agent Workflow", to: "/agent-workflow", icon: Workflow },
  { title: "Permit Intelligence", to: "/permit-intelligence", icon: FileCheck2 },
  { title: "Compliance Assistant", to: "/compliance", icon: MessageSquareText },
];

export const secondaryNav: NavItem[] = [
  { title: "Incident Investigation", to: "/incident-investigation", icon: Search },
  { title: "Pattern Intelligence", to: "/incident-patterns", icon: Layers },
  { title: "Evidence Panel", to: "/evidence", icon: Scale },
  { title: "What-If Simulation", to: "/simulation", icon: Boxes },
];

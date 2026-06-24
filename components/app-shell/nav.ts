import {
  LayoutDashboard,
  PenSquare,
  FileText,
  CalendarDays,
  BarChart3,
  TrendingUp,
  Lightbulb,
  Library,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  group: "main" | "create" | "grow";
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, group: "main" },
  { href: "/tweet", label: "Tweet Studio", icon: PenSquare, group: "create" },
  { href: "/blog", label: "Blog Studio", icon: FileText, group: "create" },
  { href: "/ideas", label: "Ideas", icon: Lightbulb, group: "create" },
  { href: "/calendar", label: "Schedule", icon: CalendarDays, group: "create" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, group: "grow" },
  { href: "/growth", label: "Growth", icon: TrendingUp, group: "grow" },
  { href: "/library", label: "Library", icon: Library, group: "grow" },
  { href: "/settings", label: "Settings", icon: Settings, group: "main" },
];

import {
  Award,
  BookOpen,
  Boxes,
  CalendarCheck,
  ClipboardList,
  FlaskConical,
  FolderGit2,
  Gauge,
  LayoutDashboard,
  LineChart,
  type LucideIcon,
  MessageSquareQuote,
  Network,
  NotebookPen,
  Repeat2,
  Settings,
  Users,
} from "lucide-react";

/**
 * The application's navigation.
 *
 * Items for surfaces that do not exist yet are marked with the phase that
 * builds them and render disabled, with the phase shown. That is a deliberate
 * choice over creating twenty placeholder pages: the sidebar tells the truth
 * about what is built, and nothing pretends to be a working feature.
 */

export type BuildPhase = 2 | 3 | 4 | 5 | 6 | 7 | 10;

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** The phase that makes this route real. Items at or below the current phase are live. */
  phase: BuildPhase;
  /** Shown on hover for items not yet available. */
  note?: string;
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

/** Bumped as each phase lands. Everything at or below this is navigable. */
export const CURRENT_PHASE: BuildPhase = 2;

export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, phase: 2 },
      {
        label: "Today",
        href: "/today",
        icon: CalendarCheck,
        phase: 7,
        note: "Your daily study plan",
      },
      {
        label: "Review",
        href: "/review",
        icon: Repeat2,
        phase: 7,
        note: "Spaced repetition",
      },
    ],
  },
  {
    label: "Course",
    items: [
      {
        label: "My Course",
        href: "/course",
        icon: BookOpen,
        phase: 3,
        note: "Terms, modules and lessons",
      },
      {
        label: "Assignments",
        href: "/assignments",
        icon: ClipboardList,
        phase: 3,
        note: "Evidence-bearing work",
      },
      {
        label: "Labs",
        href: "/labs",
        icon: FlaskConical,
        phase: 3,
        note: "Interactive practical labs",
      },
    ],
  },
  {
    label: "Proof",
    items: [
      {
        label: "Certifications",
        href: "/certifications",
        icon: Award,
        phase: 4,
      },
      {
        label: "Skill Tree",
        href: "/skills",
        icon: Network,
        phase: 4,
        note: "Twelve branches, levels 0–5",
      },
      {
        label: "Projects",
        href: "/projects",
        icon: FolderGit2,
        phase: 4,
        note: "Portfolio and evidence",
      },
    ],
  },
  {
    label: "Business",
    items: [
      {
        label: "Business Lab",
        href: "/business",
        icon: Gauge,
        phase: 5,
        note: "Pricing, margins, capacity, hiring",
      },
      {
        label: "Client Pipeline",
        href: "/pipeline",
        icon: Users,
        phase: 5,
      },
      {
        label: "Market Validation",
        href: "/validation",
        icon: MessageSquareQuote,
        phase: 5,
      },
      {
        label: "Revenue",
        href: "/revenue",
        icon: LineChart,
        phase: 5,
        note: "Revenue and MRR",
      },
    ],
  },
  {
    label: "Library",
    items: [
      {
        label: "Software",
        href: "/software",
        icon: Boxes,
        phase: 6,
        note: "The tools Ascend runs on",
      },
      {
        label: "Templates",
        href: "/templates",
        icon: ClipboardList,
        phase: 6,
      },
      { label: "Notes", href: "/notes", icon: NotebookPen, phase: 6 },
    ],
  },
  {
    label: null,
    items: [
      {
        label: "Progress",
        href: "/progress",
        icon: LineChart,
        phase: 7,
        note: "Detailed analytics",
      },
      { label: "Settings", href: "/settings", icon: Settings, phase: 2 },
    ],
  },
];

export function isAvailable(item: NavItem): boolean {
  return item.phase <= CURRENT_PHASE;
}

/** Marks the active item, including nested routes like `/settings/pricing`. */
export function isActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

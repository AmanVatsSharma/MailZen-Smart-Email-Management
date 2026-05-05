import {
  Activity,
  BellRing,
  Building2,
  CreditCard,
  Contact,
  FileText,
  Filter,
  LayoutDashboard,
  Lock,
  Mail,
  MailPlus,
  MessageSquareText,
  Plug2,
  ShieldCheck,
  Tag,
  type LucideIcon,
  Sparkles,
  Zap,
} from 'lucide-react';

export type DashboardSectionId =
  | 'dashboard'
  | 'mail'
  | 'contacts'
  | 'automation'
  | 'providers';

export type RouteLink = {
  label: string;
  href: string;
  description?: string;
};

export type PrimaryNavItem = {
  id: DashboardSectionId;
  label: string;
  href: string;
  icon: LucideIcon;
};

export type SecondaryPanelConfig = {
  title: string;
  description: string;
  links: RouteLink[];
};

export const primaryNavItems: PrimaryNavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    id: 'mail',
    label: 'Mail',
    href: '/inbox',
    icon: Mail,
  },
  {
    id: 'contacts',
    label: 'Contacts',
    href: '/contacts',
    icon: Contact,
  },
  {
    id: 'automation',
    label: 'Automations',
    href: '/automations',
    icon: Zap,
  },
  {
    id: 'providers',
    label: 'Providers',
    href: '/email-providers',
    icon: MailPlus,
  },
];

export const secondaryPanelBySection: Record<DashboardSectionId, SecondaryPanelConfig> = {
  dashboard: {
    title: 'Workspace',
    description: 'Overview and design references.',
    links: [
      { label: 'Overview', href: '/dashboard', description: 'Email performance and KPIs' },
      { label: 'Design System', href: '/design-system', description: 'UI components playground' },
    ],
  },
  mail: {
    title: 'Mailbox',
    description: 'Inbox and message folders.',
    links: [
      { label: 'Inbox', href: '/inbox', description: 'Unread and active conversations' },
      { label: 'Sent', href: '/sent', description: 'Delivered messages' },
      { label: 'Scheduled', href: '/dashboard/scheduled', description: 'Pending scheduled sends' },
      { label: 'Archive', href: '/archive', description: 'Archived conversations' },
      { label: 'Trash', href: '/trash', description: 'Deleted messages' },
      { label: 'Labels', href: '/labels', description: 'Colour-coded inbox labels' },
    ],
  },
  contacts: {
    title: 'Contacts',
    description: 'Recipients and relationship data.',
    links: [
      { label: 'Address Book', href: '/contacts', description: 'Manage people and details' },
      { label: 'Sender Intelligence', href: '/contacts/senders', description: 'AI relationship scores and VIP management' },
    ],
  },
  automation: {
    title: 'Automations',
    description: 'Workflow automations and AI rules.',
    links: [
      { label: 'Automations', href: '/automations', description: 'Workspace workflow automations' },
      { label: 'Filters (legacy)', href: '/filters', description: 'Rule-based inbox automation' },
      { label: 'Warmup', href: '/warmup', description: 'Deliverability warmup management' },
      {
        label: 'Smart Replies',
        href: '/settings/smart-replies',
        description: 'AI response preferences',
      },
      {
        label: 'Billing',
        href: '/settings/billing',
        description: 'Subscription plans and limits',
      },
      {
        label: 'Workspaces',
        href: '/settings/workspaces',
        description: 'Team access and members',
      },
      {
        label: 'Notification Center',
        href: '/notifications',
        description: 'Browse all notifications and alerts',
      },
      {
        label: 'Notification Settings',
        href: '/settings/notifications',
        description: 'Channel preferences and SLA thresholds',
      },
      {
        label: 'Mailbox Health',
        href: '/mailbox-health',
        description: 'Sync status, incidents, and alert delivery',
      },
      {
        label: 'Templates',
        href: '/templates',
        description: 'Create and manage email templates',
      },
      {
        label: 'AI Audit Log',
        href: '/settings/ai-audit',
        description: 'Agent action history and compliance export',
      },
      {
        label: 'Feature Flags',
        href: '/settings/feature-flags',
        description: 'Admin-only feature rollout management',
      },
      {
        label: 'Privacy & Data',
        href: '/settings/privacy',
        description: 'Download your account data export',
      },
      {
        label: 'Integrations',
        href: '/settings/integrations',
        description: 'Connect Slack, webhooks, and external services',
      },
    ],
  },
  providers: {
    title: 'Providers',
    description: 'Connected email accounts.',
    links: [
      {
        label: 'Email Providers',
        href: '/email-providers',
        description: 'Connect and manage providers',
      },
    ],
  },
};

export const automationQuickLinks = [
  { label: 'Automations', href: '/automations', icon: Zap },
  { label: 'Filters', href: '/filters', icon: Filter },
  { label: 'Warmup', href: '/warmup', icon: Zap },
  { label: 'Smart Replies', href: '/settings/smart-replies', icon: MessageSquareText },
  { label: 'Notification Center', href: '/notifications', icon: BellRing },
  { label: 'Billing', href: '/settings/billing', icon: CreditCard },
  { label: 'Workspaces', href: '/settings/workspaces', icon: Building2 },
  { label: 'Notification Settings', href: '/settings/notifications', icon: BellRing },
  { label: 'Mailbox Health', href: '/mailbox-health', icon: Activity },
  { label: 'Templates', href: '/templates', icon: FileText },
  { label: 'AI Audit Log', href: '/settings/ai-audit', icon: ShieldCheck },
  { label: 'Privacy & Data', href: '/settings/privacy', icon: Lock },
  { label: 'Integrations', href: '/settings/integrations', icon: Plug2 },
];

export const mailFolderRoutes = new Set(['/inbox', '/sent', '/archive', '/trash']);

export const normalizePathname = (pathname: string): string => {
  if (!pathname) {
    return '/';
  }

  return pathname.length > 1 && pathname.endsWith('/')
    ? pathname.slice(0, -1)
    : pathname;
};

export const getSectionFromPathname = (pathname: string): DashboardSectionId => {
  const normalized = normalizePathname(pathname);

  if (normalized === '/dashboard' || normalized === '/design-system') {
    return 'dashboard';
  }

  if (normalized.startsWith('/dashboard/scheduled')) {
    return 'mail';
  }

  if (normalized === '/labels' || mailFolderRoutes.has(normalized)) {
    return 'mail';
  }

  if (normalized.startsWith('/contacts')) {
    return 'contacts';
  }

  if (
    normalized === '/filters' ||
    normalized === '/warmup' ||
    normalized.startsWith('/automations') ||
    normalized === '/notifications' ||
    normalized === '/mailbox-health' ||
    normalized === '/templates' ||
    normalized.startsWith('/settings/billing') ||
    normalized.startsWith('/settings/workspaces') ||
    normalized.startsWith('/settings/smart-replies') ||
    normalized.startsWith('/settings/notifications') ||
    normalized.startsWith('/settings/ai-audit') ||
    normalized.startsWith('/settings/feature-flags') ||
    normalized.startsWith('/settings/privacy') ||
    normalized.startsWith('/settings/integrations')
  ) {
    return 'automation';
  }

  if (normalized === '/email-providers') {
    return 'providers';
  }

  return 'dashboard';
};

export const isRouteActive = (pathname: string, href: string): boolean => {
  const normalizedPath = normalizePathname(pathname);
  const normalizedHref = normalizePathname(href);

  return (
    normalizedPath === normalizedHref ||
    normalizedPath.startsWith(`${normalizedHref}/`)
  );
};

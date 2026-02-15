import {
  BellRing,
  CreditCard,
  Contact,
  Filter,
  LayoutDashboard,
  Mail,
  MailPlus,
  MessageSquareText,
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
    href: '/',
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
    label: 'Automation',
    href: '/filters',
    icon: Sparkles,
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
      { label: 'Overview', href: '/', description: 'Email performance and KPIs' },
      { label: 'Design System', href: '/design-system', description: 'UI components playground' },
    ],
  },
  mail: {
    title: 'Mailbox',
    description: 'Inbox and message folders.',
    links: [
      { label: 'Inbox', href: '/inbox', description: 'Unread and active conversations' },
      { label: 'Sent', href: '/sent', description: 'Delivered messages' },
      { label: 'Archive', href: '/archive', description: 'Archived conversations' },
      { label: 'Trash', href: '/trash', description: 'Deleted messages' },
    ],
  },
  contacts: {
    title: 'Contacts',
    description: 'Recipients and relationship data.',
    links: [
      { label: 'Address Book', href: '/contacts', description: 'Manage people and details' },
    ],
  },
  automation: {
    title: 'Automation',
    description: 'Rules and AI automation.',
    links: [
      { label: 'Filters', href: '/filters', description: 'Rule-based inbox automation' },
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
        label: 'Notifications',
        href: '/settings/notifications',
        description: 'Notification channel preferences',
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
  { label: 'Filters', href: '/filters', icon: Filter },
  { label: 'Warmup', href: '/warmup', icon: Zap },
  { label: 'Smart Replies', href: '/settings/smart-replies', icon: MessageSquareText },
  { label: 'Billing', href: '/settings/billing', icon: CreditCard },
  { label: 'Notifications', href: '/settings/notifications', icon: BellRing },
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

  if (mailFolderRoutes.has(normalized)) {
    return 'mail';
  }

  if (normalized === '/contacts') {
    return 'contacts';
  }

  if (
    normalized === '/filters' ||
    normalized === '/warmup' ||
    normalized.startsWith('/settings/billing') ||
    normalized.startsWith('/settings/smart-replies') ||
    normalized.startsWith('/settings/notifications')
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

  if (normalizedHref === '/') {
    return normalizedPath === '/';
  }

  return (
    normalizedPath === normalizedHref ||
    normalizedPath.startsWith(`${normalizedHref}/`)
  );
};

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { EmailNavigation } from '@/components/email/EmailNavigation';
import type { EmailFolder } from '@/lib/email/email-types';
import {
  getSectionFromPathname,
  isRouteActive,
  mailFolderRoutes,
  normalizePathname,
  primaryNavItems,
  secondaryPanelBySection,
  type DashboardSectionId,
  type PrimaryNavItem,
  type RouteLink,
} from './dashboard-nav.config';

const NAV_SHORTCUTS: Partial<Record<DashboardSectionId, string>> = {
  dashboard: 'G D',
  mail: 'G I',
  contacts: 'G C',
  automation: 'G A',
  providers: 'G P',
};

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

const folderFromPath = (pathname: string): EmailFolder => {
  const normalized = normalizePathname(pathname);
  const value = normalized.replace('/', '');
  if (value === 'inbox' || value === 'sent' || value === 'archive' || value === 'trash') {
    return value;
  }
  return 'inbox';
};

const SectionLinkItem = ({
  item,
  pathname,
  onSelect,
}: {
  item: RouteLink;
  pathname: string;
  onSelect?: () => void;
}) => {
  const active = isRouteActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      onClick={onSelect}
      className={cn(
        'group block rounded-xl border px-3 py-2.5 transition-all duration-200',
        active
          ? 'border-primary/30 bg-primary/10 text-primary shadow-sm'
          : 'border-transparent bg-transparent text-foreground/80 hover:border-border/50 hover:bg-muted/50 hover:text-foreground',
      )}
    >
      <div className="flex items-center gap-2">
        {active && (
          <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-sm" style={{ boxShadow: '0 0 6px hsl(262 83% 58% / 0.6)' }} />
        )}
        <p className="text-sm font-medium">{item.label}</p>
      </div>
      {item.description ? (
        <p className="mt-0.5 text-xs text-muted-foreground pl-3.5">{item.description}</p>
      ) : null}
    </Link>
  );
};

const PrimaryRail = ({
  activeSection,
  onPrimarySelect,
}: {
  activeSection: DashboardSectionId;
  onPrimarySelect: (item: PrimaryNavItem) => void;
}) => {
  return (
    <div className="flex w-[68px] flex-col items-center border-r border-border/50 bg-sidebar px-2.5 py-4">
      {/* Logo mark */}
      <Link
        href="/"
        className="mb-5 group flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white transition-all duration-200 hover:shadow-lg"
        style={{
          background: 'linear-gradient(135deg, hsl(262 83% 58%), hsl(262 83% 44%))',
          boxShadow: '0 2px 10px hsl(262 83% 58% / 0.3)',
        }}
      >
        <span style={{ fontFamily: 'var(--font-sora)' }}>M</span>
      </Link>

      <div className="flex flex-1 flex-col items-center gap-1">
        {primaryNavItems.map((item) => {
          const Icon = item.icon as LucideIcon;
          const active = item.id === activeSection;
          const shortcut = NAV_SHORTCUTS[item.id];

          return (
            <button
              key={item.id}
              type="button"
              title={shortcut ? `${item.label} — ${shortcut}` : item.label}
              aria-label={item.label}
              onClick={() => onPrimarySelect(item)}
              className={cn(
                'group/nav relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200',
                active
                  ? 'text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground',
              )}
              style={
                active
                  ? {
                      background: 'linear-gradient(135deg, hsl(262 83% 58%), hsl(262 83% 48%))',
                      boxShadow: '0 4px 12px hsl(262 83% 58% / 0.35)',
                    }
                  : undefined
              }
            >
              <Icon className="h-4.5 w-4.5" />
              {active && (
                <span
                  className="absolute -right-2.5 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full"
                  style={{ background: 'hsl(262 83% 58%)' }}
                />
              )}
              {/* Shortcut hint on hover */}
              {shortcut && !active && (
                <span className="pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-md border border-border/60 bg-popover px-1.5 py-0.5 text-[10px] text-muted-foreground shadow-sm group-hover/nav:flex">
                  {shortcut}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* AI status indicator */}
      <div
        title="AI Active — running background agents"
        className="mb-1 flex flex-col items-center gap-1 cursor-default"
      >
        <span className="relative flex h-2 w-2">
          <span
            className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 animate-ping"
            style={{ animationDuration: '4s' }}
          />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
          AI
        </span>
      </div>
    </div>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const searchParams = useSearchParams();

  const routeSection = useMemo(() => getSectionFromPathname(pathname), [pathname]);
  const [activeSection, setActiveSection] = useState<DashboardSectionId>(routeSection);

  useEffect(() => {
    setActiveSection(routeSection);
  }, [routeSection]);

  const currentFolder = useMemo<EmailFolder>(() => {
    const requestedFolder = searchParams.get('folder');
    if (
      requestedFolder === 'inbox' ||
      requestedFolder === 'sent' ||
      requestedFolder === 'archive' ||
      requestedFolder === 'trash' ||
      requestedFolder === 'drafts' ||
      requestedFolder === 'spam'
    ) {
      return requestedFolder;
    }
    return folderFromPath(pathname);
  }, [pathname, searchParams]);

  const currentLabel = searchParams.get('label') ?? undefined;
  const activeSecondaryPanel = secondaryPanelBySection[activeSection];

  const handlePrimarySelect = (item: PrimaryNavItem) => {
    setActiveSection(item.id);
    router.push(item.href);
  };

  const closeMobileDrawer = () => {
    onClose?.();
  };

  const handleFolderSelect = (folder: EmailFolder) => {
    if (mailFolderRoutes.has(`/${folder}`)) {
      router.push(`/${folder}`);
      closeMobileDrawer();
      return;
    }
    const nextParams = new URLSearchParams();
    nextParams.set('folder', folder);
    router.push(`/inbox?${nextParams.toString()}`);
    closeMobileDrawer();
  };

  const handleLabelSelect = (labelId: string) => {
    const nextParams = new URLSearchParams();
    nextParams.set('label', labelId);
    const currentRoute = normalizePathname(pathname);
    const baseRoute = mailFolderRoutes.has(currentRoute) ? currentRoute : '/inbox';
    router.push(`${baseRoute}?${nextParams.toString()}`);
    closeMobileDrawer();
  };

  const renderSecondaryPanel = (isMobile: boolean) => {
    if (activeSection === 'mail') {
      return (
        <div className="flex h-full min-h-0 flex-col">
          <div className="px-4 py-3.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
              {activeSecondaryPanel.title}
            </p>
          </div>
          <div className="min-h-0 flex-1">
            <EmailNavigation
              currentFolder={currentFolder}
              onFolderSelect={handleFolderSelect}
              currentLabel={currentLabel}
              onLabelSelect={handleLabelSelect}
              showCompose={false}
              className="h-full"
            />
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="px-4 py-3.5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
            {activeSecondaryPanel.title}
          </p>
          {activeSecondaryPanel.description && (
            <p className="mt-0.5 text-xs text-muted-foreground/50">{activeSecondaryPanel.description}</p>
          )}
        </div>
        {/* Accent separator line */}
        <div className="mx-4 mb-2 h-px" style={{ background: 'linear-gradient(90deg, hsl(262 83% 58% / 0.3), transparent)' }} />
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-1 p-3">
            {activeSecondaryPanel.links.map((item) => (
              <SectionLinkItem
                key={item.href}
                item={item}
                pathname={pathname}
                onSelect={isMobile ? closeMobileDrawer : undefined}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  };

  return (
    <>
      <aside className="hidden h-full border-r border-border/50 bg-sidebar/80 backdrop-blur-xl lg:flex">
        <PrimaryRail activeSection={activeSection} onPrimarySelect={handlePrimarySelect} />
        <div className="w-[280px] min-w-[280px] bg-sidebar/60">
          {renderSecondaryPanel(false)}
        </div>
      </aside>

      <Sheet
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) closeMobileDrawer();
        }}
      >
        <SheetContent side="left" className="w-[92vw] max-w-[400px] p-0 lg:hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>Primary and secondary dashboard navigation</SheetDescription>
          </SheetHeader>
          <div className="flex h-full min-h-0 bg-sidebar">
            <PrimaryRail activeSection={activeSection} onPrimarySelect={handlePrimarySelect} />
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex h-14 items-center justify-end border-b border-border/50 px-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={closeMobileDrawer}
                  aria-label="Close navigation"
                  className="rounded-lg"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              </div>
              <div className="min-h-0 flex-1">{renderSecondaryPanel(true)}</div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default Sidebar;

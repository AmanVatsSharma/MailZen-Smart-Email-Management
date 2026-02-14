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

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

const iconRailButtonClass =
  'h-11 w-11 rounded-xl border border-transparent text-muted-foreground transition-all hover:border-primary/20 hover:bg-primary/10 hover:text-primary';

const folderFromPath = (pathname: string): EmailFolder => {
  const normalized = normalizePathname(pathname);
  const value = normalized.replace('/', '');

  if (
    value === 'inbox' ||
    value === 'sent' ||
    value === 'archive' ||
    value === 'trash'
  ) {
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
        'block rounded-xl border px-3 py-2.5 transition-colors',
        active
          ? 'border-primary/35 bg-primary/10 text-primary'
          : 'border-border/70 bg-background/25 text-foreground hover:bg-accent',
      )}
    >
      <p className="text-sm font-medium">{item.label}</p>
      {item.description ? (
        <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
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
    <div className="flex w-[76px] flex-col items-center border-r border-border/70 bg-background/90 px-3 py-4">
      <Link href="/" className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <span className="text-sm font-bold">M</span>
      </Link>

      <div className="flex flex-1 flex-col items-center gap-2">
        {primaryNavItems.map((item) => {
          const Icon = item.icon as LucideIcon;
          const active = item.id === activeSection;

          return (
            <Button
              key={item.id}
              type="button"
              variant="ghost"
              size="icon"
              title={item.label}
              aria-label={item.label}
              onClick={() => onPrimarySelect(item)}
              className={cn(
                iconRailButtonClass,
                active && 'border-primary/40 bg-primary/15 text-primary shadow-sm',
              )}
            >
              <Icon className="h-5 w-5" />
            </Button>
          );
        })}
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
          <div className="border-b border-border/70 px-4 py-3">
            <p className="text-sm font-semibold">{activeSecondaryPanel.title}</p>
            <p className="text-xs text-muted-foreground">{activeSecondaryPanel.description}</p>
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
        <div className="border-b border-border/70 px-4 py-3">
          <p className="text-sm font-semibold">{activeSecondaryPanel.title}</p>
          <p className="text-xs text-muted-foreground">{activeSecondaryPanel.description}</p>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-2 p-3">
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
      <aside className="hidden h-full border-r border-border/70 bg-background/60 backdrop-blur-xl lg:flex">
        <PrimaryRail activeSection={activeSection} onPrimarySelect={handlePrimarySelect} />
        <div className="w-[296px] min-w-[296px] bg-background/40">
          {renderSecondaryPanel(false)}
        </div>
      </aside>

      <Sheet
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeMobileDrawer();
          }
        }}
      >
        <SheetContent side="left" className="w-[92vw] max-w-[420px] p-0 lg:hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>Primary and secondary dashboard navigation</SheetDescription>
          </SheetHeader>
          <div className="flex h-full min-h-0 bg-background">
            <PrimaryRail activeSection={activeSection} onPrimarySelect={handlePrimarySelect} />
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex h-14 items-center justify-end border-b border-border/70 px-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={closeMobileDrawer}
                  aria-label="Close navigation"
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

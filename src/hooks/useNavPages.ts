'use client';

import { useState, useEffect } from 'react';
import type { NavFolderGroup } from '@/lib/admin/outlook-nav';
import { resolveIcon } from '@/lib/admin/icon-resolver';

interface NavPageData {
  id: string;
  title: string;
  subtitle?: string | null;
  url: string;
  icon?: string | null;
  openInNewTab: boolean;
}

interface NavSubSectionData {
  id: string;
  title: string;
  icon?: string | null;
  pages: NavPageData[];
}

interface NavSectionData {
  id: string;
  title: string;
  icon?: string | null;
  subSections: NavSubSectionData[];
}

export function useNavPages(railId: string): NavFolderGroup[] {
  const [groups, setGroups] = useState<NavFolderGroup[]>([]);

  useEffect(() => {
    if (!railId) return;

    let cancelled = false;

    async function fetchPages() {
      try {
        const res = await fetch(`/api/admin/nav-sections/by-rail/${railId}`);
        if (!res.ok || cancelled) return;
        const sections: NavSectionData[] = await res.json();

        const dynamicGroups: NavFolderGroup[] = sections.flatMap((section) =>
          section.subSections
            .filter((sub) => sub.pages.length > 0)
            .map((sub) => ({
              labelKey: `_dynamic_:${sub.title}`,
              collapsible: true,
              defaultOpen: true,
              items: sub.pages.map((page) => ({
                href: page.openInNewTab
                  ? page.url
                  : `/admin/navigateur/view?pageId=${page.id}`,
                labelKey: `_dynamic_:${page.title}`,
                icon: resolveIcon(page.icon),
              })),
            }))
        );

        if (!cancelled) setGroups(dynamicGroups);
      } catch {
        // silently fail — dynamic pages are optional
      }
    }

    fetchPages();
    return () => { cancelled = true; };
  }, [railId]);

  return groups;
}

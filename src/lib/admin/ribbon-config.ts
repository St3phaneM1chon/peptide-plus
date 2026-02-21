/**
 * Outlook-style Ribbon configuration per admin section.
 * Each section defines its own tabs and contextual actions.
 */

import type { LucideIcon } from 'lucide-react';
import {
  Plus, Trash2, Printer, PackageCheck, RotateCcw, Download,
  Copy, Eye, EyeOff, Megaphone, Power, Reply, ReplyAll, Forward,
  Archive, Flag, Mail, CheckCircle, XCircle, Save, RefreshCw,
  FolderInput, MailOpen, Star, Filter, ArrowUpDown, Upload, Film, Play,
} from 'lucide-react';

export interface RibbonAction {
  key: string;
  labelKey: string;
  icon: LucideIcon;
  variant?: 'primary' | 'default' | 'danger';
  separator?: boolean; // group separator after this item
}

export interface RibbonTab {
  key: string;
  labelKey: string;
}

export interface RibbonConfig {
  tabs: RibbonTab[];
  actions: Record<string, RibbonAction[]>; // key = tab key
}

const defaultTabs: RibbonTab[] = [
  { key: 'home', labelKey: 'admin.ribbon.tabHome' },
  { key: 'view', labelKey: 'admin.ribbon.tabView' },
];

export const ribbonConfigs: Record<string, RibbonConfig> = {
  dashboard: {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'refresh', labelKey: 'admin.ribbon.refresh', icon: RefreshCw },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: [],
    },
  },

  commerce: {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newOrder', labelKey: 'admin.ribbon.newOrder', icon: Plus, variant: 'primary' },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger', separator: true },
        { key: 'print', labelKey: 'admin.ribbon.print', icon: Printer },
        { key: 'markShipped', labelKey: 'admin.ribbon.markShipped', icon: PackageCheck, separator: true },
        { key: 'refund', labelKey: 'admin.ribbon.refund', icon: RotateCcw },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: [
        { key: 'filter', labelKey: 'admin.ribbon.filters', icon: Filter },
        { key: 'sort', labelKey: 'admin.ribbon.sort', icon: ArrowUpDown },
      ],
    },
  },

  catalog: {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newProduct', labelKey: 'admin.ribbon.newProduct', icon: Plus, variant: 'primary' },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger', separator: true },
        { key: 'duplicate', labelKey: 'admin.ribbon.duplicate', icon: Copy },
        { key: 'publish', labelKey: 'admin.ribbon.publish', icon: Eye, separator: true },
        { key: 'unpublish', labelKey: 'admin.ribbon.unpublish', icon: EyeOff },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: [
        { key: 'filter', labelKey: 'admin.ribbon.filters', icon: Filter },
        { key: 'sort', labelKey: 'admin.ribbon.sort', icon: ArrowUpDown },
      ],
    },
  },

  marketing: {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newPromo', labelKey: 'admin.ribbon.newPromo', icon: Plus, variant: 'primary' },
        { key: 'newCampaign', labelKey: 'admin.ribbon.newCampaign', icon: Megaphone, separator: true },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger' },
        { key: 'activate', labelKey: 'admin.ribbon.activate', icon: Power, separator: true },
        { key: 'deactivate', labelKey: 'admin.ribbon.deactivate', icon: XCircle },
      ],
      view: [],
    },
  },

  community: {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'reply', labelKey: 'admin.ribbon.reply', icon: Reply, variant: 'primary' },
        { key: 'archive', labelKey: 'admin.ribbon.archive', icon: Archive, separator: true },
        { key: 'flag', labelKey: 'admin.ribbon.flag', icon: Flag },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger' },
      ],
      view: [],
    },
  },

  loyalty: {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newTier', labelKey: 'admin.ribbon.newTier', icon: Plus, variant: 'primary' },
        { key: 'addPoints', labelKey: 'admin.ribbon.addPoints', icon: Star, separator: true },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger' },
      ],
      view: [],
    },
  },

  media: {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'upload', labelKey: 'admin.ribbon.upload', icon: Upload, variant: 'primary' },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger', separator: true },
        { key: 'play', labelKey: 'admin.ribbon.play', icon: Play },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: [
        { key: 'filter', labelKey: 'admin.ribbon.filters', icon: Filter },
        { key: 'sort', labelKey: 'admin.ribbon.sort', icon: ArrowUpDown },
      ],
    },
  },

  emails: {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newMessage', labelKey: 'admin.ribbon.newMessage', icon: Mail, variant: 'primary' },
        { key: 'delete', labelKey: 'admin.ribbon.delete', icon: Trash2, variant: 'danger' },
        { key: 'archive', labelKey: 'admin.ribbon.archive', icon: Archive, separator: true },
        { key: 'reply', labelKey: 'admin.ribbon.reply', icon: Reply },
        { key: 'replyAll', labelKey: 'admin.ribbon.replyAll', icon: ReplyAll },
        { key: 'forward', labelKey: 'admin.ribbon.forward', icon: Forward, separator: true },
        { key: 'flag', labelKey: 'admin.ribbon.flag', icon: Flag },
        { key: 'markRead', labelKey: 'admin.ribbon.markRead', icon: MailOpen },
        { key: 'moveTo', labelKey: 'admin.ribbon.moveTo', icon: FolderInput },
      ],
      view: [
        { key: 'filter', labelKey: 'admin.ribbon.filters', icon: Filter },
        { key: 'sort', labelKey: 'admin.ribbon.sort', icon: ArrowUpDown },
      ],
    },
  },

  accounting: {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'newEntry', labelKey: 'admin.ribbon.newEntry', icon: Plus, variant: 'primary' },
        { key: 'validate', labelKey: 'admin.ribbon.validate', icon: CheckCircle, separator: true },
        { key: 'cancel', labelKey: 'admin.ribbon.cancel', icon: XCircle, variant: 'danger' },
        { key: 'print', labelKey: 'admin.ribbon.print', icon: Printer, separator: true },
        { key: 'export', labelKey: 'admin.ribbon.export', icon: Download },
      ],
      view: [
        { key: 'filter', labelKey: 'admin.ribbon.filters', icon: Filter },
        { key: 'sort', labelKey: 'admin.ribbon.sort', icon: ArrowUpDown },
      ],
    },
  },

  system: {
    tabs: defaultTabs,
    actions: {
      home: [
        { key: 'save', labelKey: 'admin.ribbon.save', icon: Save, variant: 'primary' },
        { key: 'reload', labelKey: 'admin.ribbon.reload', icon: RefreshCw, separator: true },
        { key: 'exportConfig', labelKey: 'admin.ribbon.exportConfig', icon: Download },
      ],
      view: [],
    },
  },
};

export function getRibbonConfig(railId: string): RibbonConfig {
  return ribbonConfigs[railId] ?? ribbonConfigs.dashboard;
}

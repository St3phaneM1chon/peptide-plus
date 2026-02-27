'use client';

import { useSession } from 'next-auth/react';
import { useI18n } from '@/i18n/client';
import { PageHeader } from '@/components/admin/PageHeader';
import {
  Sparkles,
  Database,
  MessageCircle,
  Calculator,
  Package,
  ShoppingCart,
  Shield,
  Users,
  Megaphone,
  ImageIcon,
  Settings,
  Languages,
  Zap,
  BarChart2,
  ClipboardCheck,
  Terminal,
  BookOpen,
  Brain,
  Search as SearchIcon,
  RefreshCw,
  ArrowRight,
  Lock,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface MagicWord {
  command: string;
  description: string;
  icon: LucideIcon;
  category: 'audit' | 'system' | 'memory';
  domains?: string[];
  example?: string;
}

const MAGIC_WORDS: MagicWord[] = [
  // ── Audit domaines ──
  {
    command: 'auditer email',
    description: 'admin.magicWords.auditEmailDesc',
    icon: Database,
    category: 'audit',
    domains: ['EmailSettings', 'EmailTemplate', 'EmailLog', 'EmailCampaign'],
    example: 'auditer email',
  },
  {
    command: 'auditer chat',
    description: 'admin.magicWords.auditChatDesc',
    icon: MessageCircle,
    category: 'audit',
    domains: ['ChatSettings', 'ChatConversation', 'ChatMessage'],
    example: 'auditer chat',
  },
  {
    command: 'auditer comptabilite',
    description: 'admin.magicWords.auditAccountingDesc',
    icon: Calculator,
    category: 'audit',
    domains: ['JournalEntry', 'ChartOfAccount', 'FiscalYear', 'TaxRate'],
    example: 'auditer comptabilite',
  },
  {
    command: 'auditer catalogue',
    description: 'admin.magicWords.auditCatalogDesc',
    icon: Package,
    category: 'audit',
    domains: ['Product', 'Category', 'ProductVariant', 'ProductReview'],
    example: 'auditer catalogue',
  },
  {
    command: 'auditer commandes',
    description: 'admin.magicWords.auditOrdersDesc',
    icon: ShoppingCart,
    category: 'audit',
    domains: ['Order', 'OrderItem', 'Payment', 'Shipment', 'Invoice'],
    example: 'auditer commandes',
  },
  {
    command: 'auditer auth',
    description: 'admin.magicWords.auditAuthDesc',
    icon: Users,
    category: 'audit',
    domains: ['User', 'Account', 'Session'],
    example: 'auditer auth',
  },
  {
    command: 'auditer marketing',
    description: 'admin.magicWords.auditMarketingDesc',
    icon: Megaphone,
    category: 'audit',
    domains: ['LoyaltyProgram', 'Ambassador', 'Coupon', 'Referral'],
    example: 'auditer marketing',
  },
  {
    command: 'auditer media',
    description: 'admin.magicWords.auditMediaDesc',
    icon: ImageIcon,
    category: 'audit',
    domains: ['MediaFile', 'MediaFolder'],
    example: 'auditer media',
  },
  {
    command: 'auditer systeme',
    description: 'admin.magicWords.auditSystemDesc',
    icon: Settings,
    category: 'audit',
    domains: ['AdminSettings', 'BackupLog'],
    example: 'auditer systeme',
  },
  {
    command: 'auditer i18n',
    description: 'admin.magicWords.auditI18nDesc',
    icon: Languages,
    category: 'audit',
    example: 'auditer i18n',
  },
  {
    command: 'auditer securite',
    description: 'admin.magicWords.auditSecurityDesc',
    icon: Shield,
    category: 'audit',
    example: 'auditer securite',
  },
  {
    command: 'auditer performance',
    description: 'admin.magicWords.auditPerformanceDesc',
    icon: BarChart2,
    category: 'audit',
    example: 'auditer performance',
  },
  // ── System commands ──
  {
    command: 'audit <repertoire>',
    description: 'admin.magicWords.codeAuditDesc',
    icon: ClipboardCheck,
    category: 'system',
    example: 'audit src/lib/',
  },
  {
    command: 'backup / sauvegardes',
    description: 'admin.magicWords.backupDesc',
    icon: RefreshCw,
    category: 'system',
    example: 'backup',
  },
  // ── Memory commands ──
  {
    command: 'Aurelia / memoire',
    description: 'admin.magicWords.aureliaDesc',
    icon: Brain,
    category: 'memory',
    example: 'Aurelia',
  },
  {
    command: 'apprendre',
    description: 'admin.magicWords.learnDesc',
    icon: BookOpen,
    category: 'memory',
    example: 'apprendre',
  },
  {
    command: 'evolution',
    description: 'admin.magicWords.evolutionDesc',
    icon: Zap,
    category: 'memory',
    example: 'evolution',
  },
];

const METHODOLOGY_STEPS = [
  { step: 1, labelKey: 'admin.magicWords.step1', icon: Database, detail: 'admin.magicWords.step1Detail' },
  { step: 2, labelKey: 'admin.magicWords.step2', icon: Terminal, detail: 'admin.magicWords.step2Detail' },
  { step: 3, labelKey: 'admin.magicWords.step3', icon: SearchIcon, detail: 'admin.magicWords.step3Detail' },
  { step: 4, labelKey: 'admin.magicWords.step4', icon: ClipboardCheck, detail: 'admin.magicWords.step4Detail' },
  { step: 5, labelKey: 'admin.magicWords.step5', icon: Sparkles, detail: 'admin.magicWords.step5Detail' },
  { step: 6, labelKey: 'admin.magicWords.step6', icon: RefreshCw, detail: 'admin.magicWords.step6Detail' },
];

const CATEGORY_LABELS: Record<string, string> = {
  audit: 'admin.magicWords.categoryAudit',
  system: 'admin.magicWords.categorySystem',
  memory: 'admin.magicWords.categoryMemory',
};

const CATEGORY_COLORS: Record<string, string> = {
  audit: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  system: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  memory: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

export default function MotsMagiquesPage() {
  const { data: session } = useSession();
  const { t } = useI18n();

  // OWNER-only access
  const userRole = (session?.user as { role?: string })?.role;
  if (userRole !== 'OWNER') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Lock className="w-16 h-16 text-gray-400" />
        <h2 className="text-xl font-semibold text-gray-600 dark:text-gray-400">
          {t('admin.magicWords.ownerOnly')}
        </h2>
        <p className="text-gray-500">{t('admin.magicWords.ownerOnlyDesc')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title={t('admin.magicWords.title')}
        subtitle={t('admin.magicWords.subtitle')}
      />

      {/* Methodology Section */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-blue-600" />
          {t('admin.magicWords.methodology')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {METHODOLOGY_STEPS.map(({ step, labelKey, icon: Icon, detail }) => (
            <div
              key={step}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-bold">
                  {step}
                </span>
                <Icon className="w-5 h-5 text-gray-500" />
                <span className="font-medium text-sm">{t(labelKey)}</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 ml-11">
                {t(detail)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Magic Words by Category */}
      {(['audit', 'system', 'memory'] as const).map((category) => {
        const items = MAGIC_WORDS.filter((w) => w.category === category);
        return (
          <section key={category}>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[category]}`}
              >
                {t(CATEGORY_LABELS[category])}
              </span>
              <span className="text-sm text-gray-500">({items.length})</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map((word) => (
                <div
                  key={word.command}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <word.icon className="w-5 h-5 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono font-semibold text-gray-900 dark:text-gray-100">
                          {word.command}
                        </code>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {t(word.description)}
                      </p>
                      {word.domains && word.domains.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {word.domains.map((domain) => (
                            <span
                              key={domain}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                            >
                              {domain}
                            </span>
                          ))}
                        </div>
                      )}
                      {word.example && (
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <ArrowRight className="w-3 h-3" />
                          <span className="font-mono">{word.example}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

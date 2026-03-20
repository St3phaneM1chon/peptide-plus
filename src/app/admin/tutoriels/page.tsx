'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Book, ChevronRight, ChevronDown, FileText, Search, LayoutDashboard,
  ShoppingCart, Package, Megaphone, MessageCircle, Award, Video, Mail,
  Phone, Briefcase, Calculator, Settings, Loader2,
} from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { PageHeader } from '@/components/admin';

// ── Guide Index — all 13 sections with 127 pages ──────────────

interface GuidePage {
  slug: string;
  title: string;
}

interface GuideSection {
  id: string;
  title: string;
  icon: React.ElementType;
  pages: GuidePage[];
}

const GUIDE_INDEX: GuideSection[] = [
  {
    id: '00-introduction',
    title: 'Introduction',
    icon: Book,
    pages: [
      { slug: '00-introduction/01-introduction', title: 'Introduction a la Suite Koraline' },
    ],
  },
  {
    id: '01-dashboard',
    title: 'Tableau de bord',
    icon: LayoutDashboard,
    pages: [
      { slug: '01-dashboard/01-dashboard', title: 'Tableau de bord' },
    ],
  },
  {
    id: '02-commerce',
    title: 'Commerce',
    icon: ShoppingCart,
    pages: [
      { slug: '02-commerce/01-commandes', title: 'Commandes' },
      { slug: '02-commerce/02-clients', title: 'Clients' },
      { slug: '02-commerce/03-distributeurs', title: 'Distributeurs' },
      { slug: '02-commerce/04-abonnements', title: 'Abonnements' },
      { slug: '02-commerce/05-inventaire', title: 'Inventaire' },
      { slug: '02-commerce/06-fournisseurs', title: 'Fournisseurs' },
      { slug: '02-commerce/07-paiements', title: 'Paiements / Reconciliation' },
    ],
  },
  {
    id: '03-catalogue',
    title: 'Catalogue',
    icon: Package,
    pages: [
      { slug: '03-catalogue/01-produits', title: 'Produits' },
      { slug: '03-catalogue/02-categories', title: 'Categories' },
      { slug: '03-catalogue/03-bundles', title: 'Bundles' },
    ],
  },
  {
    id: '04-marketing',
    title: 'Marketing',
    icon: Megaphone,
    pages: [
      { slug: '04-marketing/01-promo-codes', title: 'Codes Promo' },
      { slug: '04-marketing/02-promotions', title: 'Promotions' },
      { slug: '04-marketing/03-newsletter', title: 'Newsletter' },
      { slug: '04-marketing/04-bannieres', title: 'Bannieres' },
      { slug: '04-marketing/05-upsell', title: 'Upsell' },
      { slug: '04-marketing/06-blog', title: 'Blog' },
      { slug: '04-marketing/07-blog-analytics', title: 'Blog Analytics' },
      { slug: '04-marketing/08-rapports', title: 'Rapports Marketing' },
    ],
  },
  {
    id: '05-communaute',
    title: 'Communaute',
    icon: MessageCircle,
    pages: [
      { slug: '05-communaute/01-avis', title: 'Avis Clients' },
      { slug: '05-communaute/02-questions', title: 'Questions & Reponses' },
      { slug: '05-communaute/03-chat', title: 'Chat Support' },
      { slug: '05-communaute/04-ambassadeurs', title: 'Ambassadeurs' },
    ],
  },
  {
    id: '06-fidelite',
    title: 'Fidelite',
    icon: Award,
    pages: [
      { slug: '06-fidelite/01-fidelite', title: 'Programme de Fidelite' },
      { slug: '06-fidelite/02-webinaires', title: 'Webinaires' },
    ],
  },
  {
    id: '07-media',
    title: 'Media',
    icon: Video,
    pages: [
      { slug: '07-media/01-dashboard', title: 'Dashboard Media' },
      { slug: '07-media/02-analytics', title: 'Analytics Media' },
      { slug: '07-media/03-teams', title: 'Microsoft Teams' },
      { slug: '07-media/04-zoom', title: 'Zoom' },
      { slug: '07-media/05-webex', title: 'Webex' },
      { slug: '07-media/06-google-meet', title: 'Google Meet' },
      { slug: '07-media/07-whatsapp', title: 'WhatsApp' },
      { slug: '07-media/08-ads-youtube', title: 'Publicites YouTube' },
      { slug: '07-media/09-ads-x', title: 'Publicites X' },
      { slug: '07-media/10-ads-tiktok', title: 'Publicites TikTok' },
      { slug: '07-media/11-ads-google', title: 'Publicites Google' },
      { slug: '07-media/12-ads-linkedin', title: 'Publicites LinkedIn' },
      { slug: '07-media/13-ads-meta', title: 'Publicites Meta' },
      { slug: '07-media/14-api-zoom', title: 'API Zoom' },
      { slug: '07-media/15-api-teams', title: 'API Teams' },
      { slug: '07-media/16-api-whatsapp', title: 'API WhatsApp' },
      { slug: '07-media/17-api-webex', title: 'API Webex' },
      { slug: '07-media/18-api-google-meet', title: 'API Google Meet' },
      { slug: '07-media/19-api-youtube', title: 'API YouTube' },
      { slug: '07-media/20-api-vimeo', title: 'API Vimeo' },
      { slug: '07-media/21-api-x', title: 'API X' },
      { slug: '07-media/22-api-tiktok', title: 'API TikTok' },
      { slug: '07-media/23-api-google-ads', title: 'API Google Ads' },
      { slug: '07-media/24-api-linkedin', title: 'API LinkedIn' },
      { slug: '07-media/25-api-meta', title: 'API Meta' },
      { slug: '07-media/26-content-hub', title: 'Content Hub' },
      { slug: '07-media/27-videos', title: 'Videos' },
      { slug: '07-media/28-video-categories', title: 'Categories Video' },
      { slug: '07-media/29-connections', title: 'Connexions Plateformes' },
      { slug: '07-media/30-imports', title: 'Imports' },
      { slug: '07-media/31-sessions', title: 'Sessions Video' },
      { slug: '07-media/32-consents', title: 'Consentements' },
      { slug: '07-media/33-consent-templates', title: 'Templates Consentement' },
      { slug: '07-media/34-images', title: 'Bibliotheque Images' },
      { slug: '07-media/35-library', title: 'Bibliotheque Media' },
      { slug: '07-media/36-brand-kit', title: 'Brand Kit' },
      { slug: '07-media/37-social-scheduler', title: 'Planificateur Social' },
    ],
  },
  {
    id: '08-emails',
    title: 'Emails',
    icon: Mail,
    pages: [
      { slug: '08-emails/01-inbox', title: 'Boite de Reception' },
      { slug: '08-emails/02-envois', title: 'Emails Envoyes' },
      { slug: '08-emails/03-brouillons', title: 'Brouillons' },
      { slug: '08-emails/04-templates', title: 'Templates' },
      { slug: '08-emails/05-campagnes', title: 'Campagnes' },
      { slug: '08-emails/06-flows', title: 'Flows Automatises' },
      { slug: '08-emails/07-analytics', title: 'Analytics Email' },
    ],
  },
  {
    id: '09-telephonie',
    title: 'Telephonie',
    icon: Phone,
    pages: [
      { slug: '09-telephonie/01-dashboard', title: 'Dashboard VoIP' },
      { slug: '09-telephonie/02-journal', title: "Journal d'Appels" },
      { slug: '09-telephonie/03-enregistrements', title: 'Enregistrements' },
      { slug: '09-telephonie/04-messagerie', title: 'Messagerie Vocale' },
      { slug: '09-telephonie/05-wallboard', title: 'Wallboard' },
      { slug: '09-telephonie/06-conference', title: 'Conference' },
      { slug: '09-telephonie/07-campagnes', title: "Campagnes d'Appels" },
      { slug: '09-telephonie/08-coaching', title: 'Coaching' },
      { slug: '09-telephonie/09-transferts', title: 'Transferts' },
      { slug: '09-telephonie/10-groupes', title: 'Groupes de Sonnerie' },
      { slug: '09-telephonie/11-sondages', title: 'Sondages Post-Appel' },
      { slug: '09-telephonie/12-ivr-builder', title: 'IVR Builder' },
      { slug: '09-telephonie/13-webhooks', title: 'Webhooks VoIP' },
      { slug: '09-telephonie/14-analytics-dashboard', title: 'Analytics Dashboard' },
      { slug: '09-telephonie/15-analytics-appels', title: 'Analytics Appels' },
      { slug: '09-telephonie/16-analytics-agents', title: 'Analytics Agents' },
      { slug: '09-telephonie/17-analytics-queues', title: 'Analytics Queues' },
      { slug: '09-telephonie/18-analytics-speech', title: 'Analytics Vocal (IA)' },
      { slug: '09-telephonie/19-connexions', title: 'Connexions VoIP' },
      { slug: '09-telephonie/20-numeros', title: 'Numeros de Telephone' },
      { slug: '09-telephonie/21-extensions', title: 'Extensions' },
      { slug: '09-telephonie/22-parametres', title: 'Parametres VoIP' },
    ],
  },
  {
    id: '10-crm',
    title: 'CRM',
    icon: Briefcase,
    pages: [
      { slug: '10-crm/01-dashboard', title: 'Dashboard CRM' },
      { slug: '10-crm/02-contacts', title: 'Contacts' },
      { slug: '10-crm/03-pipeline', title: 'Pipeline & Deals' },
      { slug: '10-crm/04-leads', title: 'Leads' },
      { slug: '10-crm/05-taches', title: 'Taches' },
      { slug: '10-crm/06-entreprises', title: 'Entreprises' },
      { slug: '10-crm/07-listes-segments', title: 'Listes & Segments' },
      { slug: '10-crm/08-automatisations', title: 'Automatisations' },
      { slug: '10-crm/09-centre-appels', title: "Centre d'Appels" },
      { slug: '10-crm/10-scraper', title: 'Scraper' },
      { slug: '10-crm/11-leaderboard', title: 'Leaderboard' },
      { slug: '10-crm/12-rapports', title: 'Rapports CRM' },
      { slug: '10-crm/13-import-export', title: 'Import / Export' },
    ],
  },
  {
    id: '11-comptabilite',
    title: 'Comptabilite',
    icon: Calculator,
    pages: [
      { slug: '11-comptabilite/01-plan-comptable', title: 'Plan Comptable' },
      { slug: '11-comptabilite/02-journal', title: 'Journal General' },
      { slug: '11-comptabilite/03-ecritures', title: 'Ecritures' },
      { slug: '11-comptabilite/04-grand-livre', title: 'Grand Livre / Balance' },
      { slug: '11-comptabilite/05-bilan', title: 'Bilan' },
      { slug: '11-comptabilite/06-resultats', title: 'Etat des Resultats' },
      { slug: '11-comptabilite/07-factures', title: 'Factures' },
      { slug: '11-comptabilite/08-depenses', title: 'Depenses' },
      { slug: '11-comptabilite/09-taxes', title: 'Taxes TPS/TVQ' },
      { slug: '11-comptabilite/10-rapprochement', title: 'Rapprochement Bancaire' },
      { slug: '11-comptabilite/11-budget', title: 'Budget' },
      { slug: '11-comptabilite/12-rapports', title: 'Rapports Financiers' },
    ],
  },
  {
    id: '12-systeme',
    title: 'Systeme',
    icon: Settings,
    pages: [
      { slug: '12-systeme/01-utilisateurs', title: 'Utilisateurs' },
      { slug: '12-systeme/02-roles', title: 'Roles & Permissions' },
      { slug: '12-systeme/03-parametres', title: 'Parametres Generaux' },
      { slug: '12-systeme/04-integrations', title: 'Integrations' },
      { slug: '12-systeme/05-audit', title: "Journal d'Audit" },
      { slug: '12-systeme/06-traductions', title: 'Traductions (i18n)' },
      { slug: '12-systeme/07-apparence', title: 'Apparence & Contenu' },
      { slug: '12-systeme/08-maintenance', title: 'Maintenance' },
      { slug: '12-systeme/09-securite', title: 'Securite' },
      { slug: '12-systeme/10-sauvegardes', title: 'Sauvegardes' },
    ],
  },
];

// ── Simple Markdown → HTML renderer ─────────────────────────

function markdownToHtml(md: string): string {
  let html = md
    // Escape HTML entities first (preserve code blocks later)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    return `<pre class="md-code-block"><code class="language-${lang}">${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');

  // Headers
  html = html.replace(/^######\s+(.+)$/gm, '<h6 class="md-h6">$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5 class="md-h5">$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4 class="md-h4">$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3 class="md-h3">$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2 class="md-h2">$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1 class="md-h1">$1</h1>');

  // Bold & italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Horizontal rule
  html = html.replace(/^---+$/gm, '<hr class="md-hr" />');

  // Blockquotes
  html = html.replace(/^&gt;\s+(.+)$/gm, '<blockquote class="md-blockquote">$1</blockquote>');

  // Tables
  html = html.replace(/^(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)*)/gm, (_match, headerRow: string, _sepRow: string, bodyRows: string) => {
    const headers = headerRow.split('|').filter((c: string) => c.trim()).map((c: string) => `<th class="md-th">${c.trim()}</th>`).join('');
    const rows = bodyRows.trim().split('\n').map((row: string) => {
      const cells = row.split('|').filter((c: string) => c.trim()).map((c: string) => `<td class="md-td">${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<div class="md-table-wrap"><table class="md-table"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div>`;
  });

  // Unordered lists (simple, supports nested with 2-space indent)
  html = html.replace(/^(\s*)[-*]\s+(.+)$/gm, (_match, indent: string, content: string) => {
    const level = Math.floor(indent.length / 2);
    return `<li class="md-li" data-level="${level}">${content}</li>`;
  });

  // Wrap consecutive <li> into <ul>
  html = html.replace(/((?:<li class="md-li"[^>]*>.*<\/li>\n?)+)/g, '<ul class="md-ul">$1</ul>');

  // Ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li class="md-oli">$1</li>');
  html = html.replace(/((?:<li class="md-oli">.*<\/li>\n?)+)/g, '<ol class="md-ol">$1</ol>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="md-link" target="_blank" rel="noopener noreferrer">$1</a>');

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="md-img" />');

  // Paragraphs: wrap lines that aren't already wrapped in block elements
  html = html.replace(/^(?!<[houpblatdi]|<\/|<hr|<img|<pre|<code|<blockquote)(.+)$/gm, '<p class="md-p">$1</p>');

  return html;
}

// ── Main Component ──────────────────────────────────────────

export default function TutorielsPage() {
  const { t } = useI18n();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['00-introduction']));
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Derived: total page count
  const totalPages = useMemo(() => GUIDE_INDEX.reduce((sum, s) => sum + s.pages.length, 0), []);

  // Find current page info
  const currentPage = useMemo(() => {
    if (!selectedSlug) return null;
    for (const section of GUIDE_INDEX) {
      const page = section.pages.find(p => p.slug === selectedSlug);
      if (page) return { section, page };
    }
    return null;
  }, [selectedSlug]);

  // Filter sections/pages based on search
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return GUIDE_INDEX;
    const q = searchQuery.toLowerCase();
    return GUIDE_INDEX.map(section => ({
      ...section,
      pages: section.pages.filter(p =>
        p.title.toLowerCase().includes(q) ||
        section.title.toLowerCase().includes(q)
      ),
    })).filter(s => s.pages.length > 0);
  }, [searchQuery]);

  // Fetch guide content
  const fetchContent = useCallback(async (slug: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tutoriels/${slug}`);
      if (!res.ok) {
        setError(t('admin.tutorials.notFound'));
        setContent('');
        return;
      }
      const data = await res.json();
      setContent(data.content || '');
    } catch {
      setError(t('admin.tutorials.loadError'));
      setContent('');
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Load content when selection changes
  useEffect(() => {
    if (selectedSlug) {
      fetchContent(selectedSlug);
    }
  }, [selectedSlug, fetchContent]);

  // Toggle section expansion
  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  // Select a page
  const selectPage = (slug: string, sectionId: string) => {
    setSelectedSlug(slug);
    // Auto-expand the section
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.add(sectionId);
      return next;
    });
  };

  // Ribbon: Print
  const handlePrint = useCallback(() => {
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>${currentPage?.page.title ?? 'Tutoriel'}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #1a1a2e; }
        h1 { font-size: 28px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
        h2 { font-size: 22px; margin-top: 32px; color: #334155; }
        h3 { font-size: 18px; margin-top: 24px; color: #475569; }
        table { border-collapse: collapse; width: 100%; margin: 16px 0; }
        th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; font-size: 13px; }
        th { background: #f8fafc; font-weight: 600; }
        pre { background: #f1f5f9; padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 13px; }
        code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
        blockquote { border-left: 4px solid #6366f1; padding-left: 16px; color: #64748b; margin: 16px 0; }
        ul, ol { padding-left: 24px; }
        li { margin: 4px 0; }
        @media print { body { padding: 0; } }
      </style></head><body>${markdownToHtml(content)}</body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  }, [content, currentPage]);

  // Ribbon: Export PDF (uses print dialog)
  const handleExportPdf = useCallback(() => {
    handlePrint();
  }, [handlePrint]);

  // Ribbon: Focus search
  const handleSearch = useCallback(() => {
    const input = document.getElementById('tutoriel-search');
    if (input) input.focus();
  }, []);

  useRibbonAction('print', handlePrint);
  useRibbonAction('exportPdf', handleExportPdf);
  useRibbonAction('search', handleSearch);

  // Rendered HTML
  const renderedHtml = useMemo(() => {
    if (!content) return '';
    return markdownToHtml(content);
  }, [content]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('admin.tutorials.title')}
        subtitle={t('admin.tutorials.subtitle')}
      />

      <div className="flex gap-4" style={{ height: 'calc(100vh - 220px)' }}>
        {/* ── Sidebar ────────────────────────────────── */}
        <div className="w-80 flex-shrink-0 bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-slate-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="tutoriel-search"
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('admin.tutorials.searchPlaceholder')}
                className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
              />
            </div>
            <div className="mt-2 text-xs text-slate-400">
              {t('admin.tutorials.sectionCount', { sections: 13, pages: totalPages })}
            </div>
          </div>

          {/* Section list */}
          <div className="flex-1 overflow-y-auto">
            {filteredSections.map(section => {
              const Icon = section.icon;
              const isExpanded = expandedSections.has(section.id);

              return (
                <div key={section.id}>
                  {/* Section header */}
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-100"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    )}
                    <Icon className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-slate-700 truncate flex-1 text-left">
                      {section.title}
                    </span>
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      {section.pages.length}
                    </span>
                  </button>

                  {/* Pages */}
                  {isExpanded && (
                    <div className="bg-slate-50/50">
                      {section.pages.map(page => (
                        <button
                          key={page.slug}
                          onClick={() => selectPage(page.slug, section.id)}
                          className={`w-full flex items-center gap-2 pl-10 pr-3 py-2 text-left hover:bg-indigo-50 transition-colors ${
                            selectedSlug === page.slug
                              ? 'bg-indigo-50 border-l-[3px] border-l-indigo-600 text-indigo-700'
                              : 'text-slate-600'
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
                          <span className="text-sm truncate">{page.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredSections.length === 0 && (
              <div className="p-6 text-center text-sm text-slate-400">
                {t('admin.tutorials.noResults')}
              </div>
            )}
          </div>
        </div>

        {/* ── Main content area ──────────────────────── */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden">
          {/* Breadcrumb */}
          {currentPage && (
            <div className="px-6 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2 text-sm">
              <Book className="w-4 h-4 text-indigo-500" />
              <span className="text-slate-500">{t('admin.tutorials.title')}</span>
              <ChevronRight className="w-3 h-3 text-slate-400" />
              <span className="text-slate-500">{currentPage.section.title}</span>
              <ChevronRight className="w-3 h-3 text-slate-400" />
              <span className="text-slate-900 font-medium">{currentPage.page.title}</span>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {!selectedSlug && (
              <div className="flex flex-col items-center justify-center h-full text-center px-8">
                <Book className="w-16 h-16 text-slate-200 mb-4" />
                <h3 className="text-lg font-semibold text-slate-700 mb-2">
                  {t('admin.tutorials.welcomeTitle')}
                </h3>
                <p className="text-slate-500 max-w-md">
                  {t('admin.tutorials.welcomeDesc')}
                </p>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              </div>
            )}

            {error && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-center px-8">
                <FileText className="w-12 h-12 text-amber-300 mb-4" />
                <p className="text-slate-500">{error}</p>
              </div>
            )}

            {!loading && !error && content && (
              <div
                className="tutorial-content px-8 py-6 max-w-4xl mx-auto"
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Tutorial content styles ──────────────────── */}
      <style>{`
        .tutorial-content .md-h1 {
          font-size: 1.75rem;
          font-weight: 700;
          color: #1e293b;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 0.75rem;
          margin-bottom: 1.5rem;
          margin-top: 0;
        }
        .tutorial-content .md-h2 {
          font-size: 1.375rem;
          font-weight: 600;
          color: #334155;
          margin-top: 2rem;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #f1f5f9;
        }
        .tutorial-content .md-h3 {
          font-size: 1.125rem;
          font-weight: 600;
          color: #475569;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .tutorial-content .md-h4 {
          font-size: 1rem;
          font-weight: 600;
          color: #64748b;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
        }
        .tutorial-content .md-p {
          color: #475569;
          line-height: 1.75;
          margin: 0.75rem 0;
        }
        .tutorial-content .md-ul,
        .tutorial-content .md-ol {
          padding-left: 1.5rem;
          margin: 0.75rem 0;
          color: #475569;
        }
        .tutorial-content .md-li,
        .tutorial-content .md-oli {
          margin: 0.375rem 0;
          line-height: 1.625;
        }
        .tutorial-content .md-code-block {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          padding: 1rem;
          overflow-x: auto;
          margin: 1rem 0;
          font-size: 0.8125rem;
          line-height: 1.625;
        }
        .tutorial-content .md-inline-code {
          background: #f1f5f9;
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-size: 0.8125rem;
          color: #6366f1;
        }
        .tutorial-content .md-blockquote {
          border-left: 4px solid #6366f1;
          padding-left: 1rem;
          color: #64748b;
          margin: 1rem 0;
          font-style: italic;
        }
        .tutorial-content .md-hr {
          border: none;
          border-top: 1px solid #e2e8f0;
          margin: 2rem 0;
        }
        .tutorial-content .md-table-wrap {
          overflow-x: auto;
          margin: 1rem 0;
          border-radius: 0.5rem;
          border: 1px solid #e2e8f0;
        }
        .tutorial-content .md-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }
        .tutorial-content .md-th {
          background: #f8fafc;
          font-weight: 600;
          color: #334155;
          padding: 0.625rem 0.75rem;
          text-align: left;
          border-bottom: 2px solid #e2e8f0;
        }
        .tutorial-content .md-td {
          padding: 0.5rem 0.75rem;
          border-bottom: 1px solid #f1f5f9;
          color: #475569;
        }
        .tutorial-content .md-link {
          color: #6366f1;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .tutorial-content .md-link:hover {
          color: #4f46e5;
        }
        .tutorial-content .md-img {
          max-width: 100%;
          border-radius: 0.5rem;
          margin: 1rem 0;
        }
      `}</style>
    </div>
  );
}

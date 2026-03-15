import { BaseSectionAuditor, type SectionConfig } from './base-section-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';
import * as path from 'path';

export default class SectionDashboardAuditor extends BaseSectionAuditor {
  auditTypeCode = 'SECTION-DASHBOARD';
  sectionConfig: SectionConfig = {
    sectionName: 'Dashboard',
    adminPages: ['dashboard'],
    apiRoutes: ['admin/dashboard', 'admin/analytics'],
    prismaModels: ['Order', 'User', 'Product'],
    i18nNamespaces: ['admin.nav.dashboard'],
  };

  /** Override UI checks with dashboard-specific KPI and chart checks */
  protected override async angle4_uiPlaywright(): Promise<AuditCheckResult[]> {
    const results = await super.angle4_uiPlaywright();
    const prefix = 'section-dashboard-ui';

    const dashboardPage = path.join(this.srcDir, 'app', 'admin', 'dashboard', 'page.tsx');
    const content = this.getEffectivePageContent(dashboardPage);
    if (!content) return results;

    // Check for KPI cards/widgets
    const hasKpiCards = /KPI|kpi|stat|Stat|Card|card|widget|Widget|metric|Metric|totalOrders|revenue|Revenu|Commandes totales/i.test(content);
    results.push(
      hasKpiCards
        ? this.pass(`${prefix}-kpi-cards`, 'Dashboard has KPI cards/widgets')
        : this.fail(`${prefix}-kpi-cards`, 'HIGH',
            'Dashboard missing KPI cards',
            'Admin dashboard should display key metrics (total orders, revenue, new customers, etc.) as cards',
            { filePath: 'src/app/admin/dashboard/page.tsx', recommendation: 'Add KPI summary cards for key business metrics' })
    );

    // Check for chart/graph components
    const hasCharts = /Chart|Recharts|chart|recharts|BarChart|LineChart|PieChart|AreaChart|ResponsiveContainer|canvas/i.test(content);
    results.push(
      hasCharts
        ? this.pass(`${prefix}-charts`, 'Dashboard includes chart/graph components')
        : this.fail(`${prefix}-charts`, 'MEDIUM',
            'Dashboard missing charts/graphs',
            'Visual data representation (line charts, bar charts) helps admin understand trends',
            { filePath: 'src/app/admin/dashboard/page.tsx', recommendation: 'Add Recharts or similar charting library for data visualization' })
    );

    // Check for recent activity section
    const hasRecentActivity = /recent|latest|activity|activite|derniere|dernier|timeline|feed/i.test(content);
    results.push(
      hasRecentActivity
        ? this.pass(`${prefix}-recent-activity`, 'Dashboard has recent activity section')
        : this.fail(`${prefix}-recent-activity`, 'LOW',
            'Dashboard missing recent activity section',
            'A recent activity feed (latest orders, new users) gives admin a quick overview',
            { filePath: 'src/app/admin/dashboard/page.tsx', recommendation: 'Add a recent orders/activity section' })
    );

    return results;
  }

  /** Override state testing with dashboard-specific zero-data and date range checks */
  protected override async angle5_stateTesting(): Promise<AuditCheckResult[]> {
    const results = await super.angle5_stateTesting();
    const prefix = 'section-dashboard-state';

    const dashboardPage = path.join(this.srcDir, 'app', 'admin', 'dashboard', 'page.tsx');
    const content = this.getEffectivePageContent(dashboardPage);
    if (!content) return results;

    // Check for zero-data / empty state (new install with no orders)
    const hasZeroState = /no data|noData|empty|aucun|length\s*===?\s*0|\.length\s*[<!=]|placeholder|onboarding|getting.?started/i.test(content);
    results.push(
      hasZeroState
        ? this.pass(`${prefix}-zero-data`, 'Dashboard handles zero-data state gracefully')
        : this.fail(`${prefix}-zero-data`, 'MEDIUM',
            'Dashboard may not handle zero-data state',
            'A fresh install with no orders should show helpful empty state, not broken charts or NaN values',
            { filePath: 'src/app/admin/dashboard/page.tsx', recommendation: 'Add zero-data state with placeholder content or onboarding prompt' })
    );

    // Check for date range selector
    const hasDateRange = /dateRange|date-range|DatePicker|datePicker|startDate|endDate|period|fromDate|toDate|calendar|Calendar/i.test(content);
    results.push(
      hasDateRange
        ? this.pass(`${prefix}-date-range`, 'Dashboard has date range selector')
        : this.fail(`${prefix}-date-range`, 'MEDIUM',
            'Dashboard missing date range selector',
            'Admin should be able to filter dashboard data by date range (today, this week, this month, custom)',
            { filePath: 'src/app/admin/dashboard/page.tsx', recommendation: 'Add a date range picker to filter KPIs and charts' })
    );

    return results;
  }

  /** Override responsive checks with dashboard-specific grid and chart responsiveness */
  protected override async angle7_responsive(): Promise<AuditCheckResult[]> {
    const results = await super.angle7_responsive();
    const prefix = 'section-dashboard-responsive';

    const dashboardPage = path.join(this.srcDir, 'app', 'admin', 'dashboard', 'page.tsx');
    const content = this.getEffectivePageContent(dashboardPage);
    if (!content) return results;

    // Check KPI cards use responsive grid (grid-cols with breakpoints)
    const hasResponsiveGrid = /grid-cols-1\s.*md:grid-cols|grid-cols-1\s.*sm:grid-cols|grid-cols-2\s.*lg:grid-cols|md:grid-cols-|lg:grid-cols-/i.test(content);
    results.push(
      hasResponsiveGrid
        ? this.pass(`${prefix}-kpi-grid`, 'KPI cards use responsive grid layout')
        : this.fail(`${prefix}-kpi-grid`, 'MEDIUM',
            'KPI cards may not use responsive grid',
            'KPI cards should stack on mobile (grid-cols-1) and spread on desktop (md:grid-cols-2 or lg:grid-cols-4)',
            { filePath: 'src/app/admin/dashboard/page.tsx', recommendation: 'Use grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 for KPI cards' })
    );

    // Check charts are responsive (ResponsiveContainer or responsive prop)
    const hasResponsiveCharts = /ResponsiveContainer|responsive|width.*100%|w-full.*chart|aspect-ratio/i.test(content);
    results.push(
      hasResponsiveCharts
        ? this.pass(`${prefix}-charts-responsive`, 'Charts use responsive sizing')
        : this.fail(`${prefix}-charts-responsive`, 'MEDIUM',
            'Charts may not be responsive',
            'Charts should use ResponsiveContainer (Recharts) or CSS-based responsive sizing to adapt to screen width',
            { filePath: 'src/app/admin/dashboard/page.tsx', recommendation: 'Wrap charts in ResponsiveContainer or use w-full with aspect-ratio' })
    );

    return results;
  }
}

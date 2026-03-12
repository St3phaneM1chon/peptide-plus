/**
 * Cross-module bridge card components.
 *
 * Each card fetches its own data via the corresponding bridge API
 * and renders a compact summary widget.
 */

export {
  LoyaltyPromosBridgeCard,
  LoyaltyCommunityBridgeCard,
  LoyaltyOrdersBridgeCard,
} from './LoyaltyBridgeCards';

export {
  EmailOrdersSidebarWidget,
  EmailCrmSidebarWidget,
} from './EmailBridgeCards';

export {
  MediaMarketingBridgeCard,
} from './MediaBridgeCards';

export { RecentOrdersWidget } from './RecentOrdersWidget';
export { CustomerStatsWidget } from './CustomerStatsWidget';
export { AccountingSummaryWidget } from './AccountingSummaryWidget';
export { LoyaltyBadgeWidget } from './LoyaltyBadgeWidget';
export { ActivityTimelineWidget } from './ActivityTimelineWidget';

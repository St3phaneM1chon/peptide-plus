/**
 * Shared Bridge Types
 *
 * Centralised type definitions for all cross-module bridges.
 * Every bridge API returns BridgeResponse<T> – when the target
 * module is disabled the payload is { enabled: false }.
 */

// ─── Generic wrapper ────────────────────────────────────────
export type BridgeResponse<T> =
  | { enabled: false }
  | ({ enabled: true } & T);

// ─── Module identifiers ─────────────────────────────────────
export type BridgeModule =
  | 'ecommerce'
  | 'crm'
  | 'accounting'
  | 'voip'
  | 'email'
  | 'marketing'
  | 'loyalty'
  | 'media'
  | 'community'
  | 'catalog'
  | 'system';

// ─── Bridge #3 Commerce → Comptabilité ──────────────────────
export interface AccountingBridgeData {
  entries: AccountingEntry[];
  totalDebit: number;
  totalCredit: number;
  count: number;
}

export interface AccountingEntry {
  id: string;
  entryNumber: string;
  date: string;
  description: string | null;
  type: string;
  status: string;
  lines?: AccountingLine[];
}

export interface AccountingLine {
  id: string;
  accountCode: string | null;
  accountName: string | null;
  description: string | null;
  debit: number;
  credit: number;
}

// ─── Bridge #5 Commerce → Fidélité ──────────────────────────
export interface LoyaltyBridgeData {
  pointsEarned: number;
  pointsUsed: number;
  currentTier: string | null;
  currentPoints: number;
  transactions?: LoyaltyBridgeTransaction[];
}

export interface LoyaltyBridgeTransaction {
  id: string;
  type: string;
  points: number;
  description: string | null;
  createdAt: string;
}

// ─── Bridge #9 Commerce → Marketing ─────────────────────────
export interface MarketingBridgeData {
  promoCode: string | null;
  promoDiscount: number | null;
  discount: number;
  promoDetails: {
    code: string;
    discountType: string;
    discountValue: number;
    name: string | null;
  } | null;
  hasPromotion: boolean;
}

// ─── Bridge #1-2 CRM ↔ Commerce (Purchase History) ──────────
export interface PurchaseHistoryBridgeData {
  recentOrders: BridgeOrder[];
  totalOrders: number;
  totalSpent: number;
}

export interface BridgeOrder {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
}

// ─── Bridge #7 CRM → Téléphonie (Call History) ──────────────
export interface CallHistoryBridgeData {
  recentCalls: BridgeCall[];
  totalCalls: number;
  totalDuration: number;
}

export interface BridgeCall {
  id: string;
  direction: string;
  status: string;
  duration: number;
  startedAt: string;
}

// ─── Bridge #11 CRM → Email (Email History) ─────────────────
export interface EmailHistoryBridgeData {
  recentEmails: BridgeEmail[];
  totalSent: number;
}

export interface BridgeEmail {
  id: string;
  subject: string | null;
  status: string;
  sentAt: string;
}

// ─── Bridge #15 CRM → Fidélité (Loyalty Info) ───────────────
export interface LoyaltyInfoBridgeData {
  currentTier: string;
  currentPoints: number;
}

// ─── Bridge #8 Téléphonie → CRM (CRM Deals) ────────────────
export interface CrmDealsBridgeData {
  deals: BridgeDeal[];
}

export interface BridgeDeal {
  id: string;
  title: string;
  stageName: string | null;
  value: number;
}

// ─── Bridge #13 Téléphonie → Commerce (Recent Orders) ───────
export interface RecentOrdersBridgeData {
  recentOrders: BridgeOrder[];
  totalOrders: number;
  totalSpent: number;
}

// ─── Bridge #22 Commerce → Emails ───────────────────────────
export interface OrderEmailsBridgeData {
  recentEmails: BridgeEmail[];
  totalSent: number;
}

// ─── Bridge #23 Commerce → Téléphonie ───────────────────────
export interface OrderCallsBridgeData {
  recentCalls: BridgeCall[];
  totalCalls: number;
  totalDuration: number;
}

// ─── Bridge #24 Commerce → CRM (Source Deal) ────────────────
export interface OrderDealBridgeData {
  deal: BridgeDeal | null;
}

// ─── Bridge #12 Email → CRM ────────────────────────────────
export interface EmailCrmBridgeData {
  deals: BridgeDeal[];
  totalDeals: number;
}

// ─── Bridge #14 Comptabilité → CRM ─────────────────────────
export interface AccountingCrmBridgeData {
  deal: BridgeDeal | null;
  orderNumber: string | null;
}

// ─── Bridge #10 Marketing → Commerce ────────────────────────
export interface PromoRevenueBridgeData {
  orders: BridgeOrder[];
  totalOrders: number;
  totalRevenue: number;
  conversionRate: number;
}

// ─── Bridge #6 Fidélité → Commerce ──────────────────────────
export interface LoyaltyOrdersBridgeData {
  recentOrders: BridgeOrder[];
  totalOrders: number;
  totalSpent: number;
}

// ─── Bridge #25 Catalogue → Commerce (Product Sales) ────────
export interface ProductSalesBridgeData {
  totalUnitsSold: number;
  totalRevenue: number;
  recentOrders: BridgeOrder[];
}

// ─── Bridge #17 Catalogue → Marketing (Active Promos) ───────
export interface ProductPromosBridgeData {
  activePromos: BridgePromo[];
}

export interface BridgePromo {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  name: string | null;
  isActive: boolean;
}

// ─── Bridge #27 Catalogue → Media (Product Videos) ──────────
export interface ProductVideosBridgeData {
  videos: BridgeVideo[];
  totalVideos: number;
}

export interface BridgeVideo {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  duration: number | null;
  viewCount: number;
}

// ─── Bridge #26 Catalogue → Communauté (Reviews & Q&A) ─────
export interface ProductReviewsBridgeData {
  reviews: BridgeReview[];
  averageRating: number;
  totalReviews: number;
}

export interface BridgeReview {
  id: string;
  rating: number;
  comment: string | null;
  userName: string | null;
  createdAt: string;
}

// ─── Bridge #28 Catalogue → CRM (Deals with Product) ───────
export interface ProductDealsBridgeData {
  deals: BridgeDeal[];
  totalDeals: number;
}

// ─── Bridge #33 Marketing → Emails (Campaign Stats) ────────
export interface CampaignEmailStatsBridgeData {
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  openRate: number;
  clickRate: number;
}

// ─── Bridge #43 Emails → Commerce ──────────────────────────
export interface EmailOrdersBridgeData {
  recentOrders: BridgeOrder[];
  totalOrders: number;
  totalSpent: number;
}

// ─── Bridge #45 Téléphonie → Fidélité ──────────────────────
export interface CallLoyaltyBridgeData {
  currentTier: string | null;
  currentPoints: number;
}

// ─── Bridge #46 Téléphonie → Emails ────────────────────────
export interface CallEmailsBridgeData {
  recentEmails: BridgeEmail[];
  totalSent: number;
}

// ─── Bridge #50 CRM → Comptabilité ─────────────────────────
export interface DealAccountingBridgeData {
  entries: AccountingEntry[];
  totalDebit: number;
  totalCredit: number;
  count: number;
}

// ─── Bridge #16 Marketing → CRM ────────────────────────────
export interface MarketingCrmBridgeData {
  deals: BridgeDeal[];
  totalDeals: number;
}

// ─── Bridge #34 Communauté → Commerce ──────────────────────
export interface ReviewerOrdersBridgeData {
  recentOrders: BridgeOrder[];
  totalOrders: number;
  hasPurchased: boolean;
}

// ─── Dashboard cross-module ────────────────────────────────
export interface DashboardCommerceSummary {
  ordersToday: number;
  revenueToday: number;
  pendingOrders: number;
}

export interface DashboardCrmSummary {
  openDeals: number;
  wonToday: number;
  pipelineValue: number;
}

export interface DashboardAccountingSummary {
  draftEntries: number;
  entriesThisMonth: number;
}

export interface DashboardLoyaltySummary {
  newMembersToday: number;
  pointsDistributedToday: number;
}

export interface DashboardMarketingSummary {
  activePromoCodes: number;
}

export interface DashboardTelephonySummary {
  callsToday: number;
  avgDurationSeconds: number;
}

export interface DashboardEmailSummary {
  sentToday: number;
  openRate: number;
  bounceRate: number;
}

export interface DashboardMediaSummary {
  videosPublished: number;
  totalViews: number;
}

export interface DashboardCommunitySummary {
  recentReviews: number;
  forumPosts: number;
  averageRating: number;
}

export interface DashboardSystemSummary {
  recentErrors: number;
  jobsInQueue: number;
}

// ─── Unified Timeline ──────────────────────────────────────
export interface TimelineEvent {
  id: string;
  module: BridgeModule;
  type: string;
  title: string;
  description: string | null;
  timestamp: string;
  metadata?: Record<string, unknown>;
  link?: string;
}

export interface TimelineResponse {
  events: TimelineEvent[];
  total: number;
  cursor: string | null;
}

// ─── Customer 360 ──────────────────────────────────────────
export interface Customer360Response {
  user: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    image: string | null;
    createdAt: string;
  };
  healthScore: number;
  modules: {
    commerce?: BridgeResponse<PurchaseHistoryBridgeData>;
    crm?: BridgeResponse<{ deals: BridgeDeal[]; totalDeals: number }>;
    voip?: BridgeResponse<CallHistoryBridgeData>;
    email?: BridgeResponse<EmailHistoryBridgeData>;
    loyalty?: BridgeResponse<LoyaltyInfoBridgeData & { lifetimePoints: number }>;
    marketing?: BridgeResponse<{ promosUsed: number; totalDiscount: number }>;
    community?: BridgeResponse<{ reviews: number; forumPosts: number; isAmbassador: boolean }>;
    accounting?: BridgeResponse<{ outstandingInvoices: number; totalPaid: number }>;
    media?: BridgeResponse<{ consents: number }>;
  };
}

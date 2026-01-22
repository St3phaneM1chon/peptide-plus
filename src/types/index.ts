/**
 * TYPES TYPESCRIPT - Site Transactionnel
 */

// =====================================================
// USER TYPES
// =====================================================

export enum UserRole {
  PUBLIC = 'PUBLIC',
  CUSTOMER = 'CUSTOMER',
  CLIENT = 'CLIENT',
  EMPLOYEE = 'EMPLOYEE',
  OWNER = 'OWNER',
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: UserRole;
  mfaEnabled: boolean;
  stripeCustomerId: string | null;
  createdAt: Date;
}

export interface SessionUser extends User {
  accessToken?: string;
  mfaVerified: boolean;
}

// =====================================================
// COMPANY TYPES
// =====================================================

export interface Company {
  id: string;
  name: string;
  slug: string;
  contactEmail: string;
  phone: string | null;
  billingAddress: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingPostal: string | null;
  billingCountry: string | null;
  ownerId: string;
  isActive: boolean;
  createdAt: Date;
}

export interface CompanyWithCustomers extends Company {
  customers: CompanyCustomer[];
  _count: {
    customers: number;
    purchases: number;
  };
}

export interface CompanyCustomer {
  id: string;
  companyId: string;
  customerId: string;
  customer: User;
  addedAt: Date;
}

// =====================================================
// PRODUCT TYPES
// =====================================================

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface CategoryWithProducts extends Category {
  products: Product[];
  _count: {
    products: number;
  };
}

export interface Product {
  id: string;
  // Informations de base
  name: string;
  subtitle: string | null;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  fullDetails: string | null;
  specifications: string | null;
  productType: ProductType;
  // Prix
  price: number;
  compareAtPrice: number | null;
  // Médias principaux
  imageUrl: string | null;
  videoUrl: string | null;
  // Documents
  certificateUrl: string | null;
  certificateName: string | null;
  dataSheetUrl: string | null;
  dataSheetName: string | null;
  // Catégorie
  categoryId: string;
  category?: Category;
  // Pour produits digitaux (formations)
  duration: number | null;
  level: string | null;
  language: string;
  instructor: string | null;
  prerequisites: string | null;
  objectives: string | null;
  targetAudience: string | null;
  // Pour produits physiques
  weight: number | null;
  dimensions: string | null;
  requiresShipping: boolean;
  sku: string | null;
  barcode: string | null;
  manufacturer: string | null;
  origin: string | null;
  // SEO
  metaTitle: string | null;
  metaDescription: string | null;
  // Stats
  purchaseCount: number;
  averageRating: number | null;
  reviewCount: number;
  // Status
  isActive: boolean;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Relations
  images?: ProductImage[];
  formats?: ProductFormat[];
}

export interface ProductImage {
  id: string;
  productId: string;
  url: string;
  alt: string | null;
  caption: string | null;
  sortOrder: number;
  isPrimary: boolean;
  width: number | null;
  height: number | null;
  createdAt: Date;
}

export interface ProductFormat {
  id: string;
  productId: string;
  name: string;
  description: string | null;
  price: number | null;
  sku: string | null;
  downloadUrl: string | null;
  fileSize: string | null;
  fileType: string | null;
  inStock: boolean;
  stockQuantity: number | null;
  sortOrder: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
}

export interface Shipping {
  id: string;
  purchaseId: string;
  recipientName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  status: ShippingStatus;
  shippedAt: Date | null;
  estimatedDelivery: Date | null;
  deliveredAt: Date | null;
  instructions: string | null;
}

export interface UserAddress {
  id: string;
  userId: string;
  label: string | null;
  recipientName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string | null;
  isDefault: boolean;
}

export interface ProductWithCategory extends Product {
  category: Category;
}

export interface ProductWithDetails extends ProductWithCategory {
  modules: Module[];
}

export interface Module {
  id: string;
  productId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  duration: number | null;
  contentUrl: string | null;
}

// =====================================================
// PURCHASE TYPES
// =====================================================

export enum PurchaseStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum ProductType {
  DIGITAL = 'DIGITAL',     // Cours en ligne, formations (accès immédiat)
  PHYSICAL = 'PHYSICAL',   // Produits physiques (nécessite livraison)
  HYBRID = 'HYBRID',       // Mix des deux
}

export enum ShippingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  IN_TRANSIT = 'IN_TRANSIT',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
}

// Chat
export enum ConversationStatus {
  OPEN = 'OPEN',
  PENDING = 'PENDING',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  FILE = 'FILE',
  SYSTEM = 'SYSTEM',
}

export interface Conversation {
  id: string;
  userId: string;
  subject: string | null;
  status: ConversationStatus;
  assignedToId: string | null;
  priority: number;
  tags: string | null;
  lastMessageAt: Date;
  unreadCount: number;
  createdAt: Date;
  user?: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  assignedTo?: {
    id: string;
    name: string | null;
  } | null;
  messages?: Message[];
  _count?: {
    messages: number;
  };
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  content: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentSize: number | null;
  readAt: Date | null;
  isSystem: boolean;
  createdAt: Date;
  sender?: {
    id: string;
    name: string | null;
    image: string | null;
    role: UserRole;
  };
}

export interface QuickReply {
  id: string;
  title: string;
  content: string;
  category: string | null;
  sortOrder: number;
  isActive: boolean;
}

export enum PaymentMethod {
  STRIPE_CARD = 'STRIPE_CARD',
  APPLE_PAY = 'APPLE_PAY',
  GOOGLE_PAY = 'GOOGLE_PAY',
  PAYPAL = 'PAYPAL',
  VISA_CLICK_TO_PAY = 'VISA_CLICK_TO_PAY',
  MASTERCARD_CLICK_TO_PAY = 'MASTERCARD_CLICK_TO_PAY',
}

export interface Purchase {
  id: string;
  userId: string;
  companyId: string | null;
  productId: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  stripePaymentId: string | null;
  paypalOrderId: string | null;
  status: PurchaseStatus;
  receiptUrl: string | null;
  receiptNumber: string | null;
  createdAt: Date;
}

export interface PurchaseWithDetails extends Purchase {
  user: User;
  product: Product;
  company: Company | null;
  courseAccess: CourseAccess | null;
}

export interface SavedCard {
  id: string;
  userId: string;
  stripePaymentMethodId: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

// =====================================================
// COURSE ACCESS TYPES
// =====================================================

export interface CourseAccess {
  id: string;
  userId: string;
  productId: string;
  purchaseId: string;
  progress: number;
  lastAccessedAt: Date | null;
  completedAt: Date | null;
  certificateUrl: string | null;
  certificateNumber: string | null;
  certificateIssuedAt: Date | null;
}

export interface CourseAccessWithProduct extends CourseAccess {
  product: Product;
}

export interface Grade {
  id: string;
  userId: string;
  productId: string;
  moduleId: string;
  score: number;
  passed: boolean;
  attempts: number;
  completedAt: Date;
}

export interface GradeWithModule extends Grade {
  module: Module;
}

// =====================================================
// API RESPONSE TYPES
// =====================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// =====================================================
// PAYMENT TYPES
// =====================================================

export interface PaymentIntent {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
}

export interface CheckoutSession {
  sessionId: string;
  url: string;
}

export interface PayPalOrder {
  orderId: string;
  approvalUrl: string;
}

// =====================================================
// DASHBOARD STATS TYPES
// =====================================================

export interface CustomerDashboardStats {
  totalCourses: number;
  completedCourses: number;
  inProgressCourses: number;
  totalSpent: number;
  averageScore: number | null;
  certificates: number;
}

export interface ClientDashboardStats {
  totalStudents: number;
  activeStudents: number;
  totalCoursesPurchased: number;
  totalSpent: number;
  completionRate: number;
}

export interface OwnerDashboardStats {
  totalRevenue: number;
  totalCustomers: number;
  totalClients: number;
  totalProducts: number;
  monthlyRevenue: number;
  topProducts: Product[];
  recentPurchases: PurchaseWithDetails[];
}

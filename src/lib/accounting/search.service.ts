/**
 * Advanced Search Service
 * Full-text search, filters, and saved searches for accounting
 */

import { db as prisma } from '@/lib/db';

export interface SearchQuery {
  // Text search
  query?: string;
  
  // Entity type filter
  entityTypes?: ('ENTRY' | 'INVOICE' | 'SUPPLIER' | 'CUSTOMER' | 'TRANSACTION')[];
  
  // Date range
  dateFrom?: Date;
  dateTo?: Date;
  
  // Amount range
  amountMin?: number;
  amountMax?: number;
  
  // Status filter
  statuses?: string[];
  
  // Account filter
  accountCodes?: string[];
  
  // Tags
  tags?: string[];
  
  // Sort
  sortBy?: 'date' | 'amount' | 'relevance';
  sortOrder?: 'asc' | 'desc';
  
  // Pagination
  page?: number;
  limit?: number;
}

export interface SearchResult {
  id: string;
  type: 'ENTRY' | 'INVOICE' | 'SUPPLIER' | 'CUSTOMER' | 'TRANSACTION';
  title: string;
  description?: string;
  date: Date;
  amount: number;
  status: string;
  reference?: string;
  highlights?: { field: string; snippet: string }[];
  relevanceScore: number;
}

export interface SavedSearch {
  id: string;
  name: string;
  query: SearchQuery;
  userId: string;
  isDefault: boolean;
  createdAt: Date;
  lastUsed?: Date;
  useCount: number;
}

/**
 * Perform advanced search across accounting entities
 */
export async function advancedSearch(
  query: SearchQuery
): Promise<{
  results: SearchResult[];
  total: number;
  facets: {
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    byMonth: Record<string, number>;
  };
  page: number;
  pages: number;
}> {
  const {
    query: searchText,
    entityTypes = ['ENTRY', 'INVOICE', 'SUPPLIER', 'TRANSACTION'],
    dateFrom,
    dateTo,
    amountMin,
    amountMax,
    statuses,
    accountCodes,
    sortBy = 'date',
    sortOrder = 'desc',
    page = 1,
    limit = 20,
  } = query;

  const results: SearchResult[] = [];
  const facets = {
    byType: {} as Record<string, number>,
    byStatus: {} as Record<string, number>,
    byMonth: {} as Record<string, number>,
  };

  // Build common date filter
  const dateFilter: Record<string, Date> = {};
  if (dateFrom) dateFilter.gte = dateFrom;
  if (dateTo) dateFilter.lte = dateTo;

  // Search Journal Entries
  if (entityTypes.includes('ENTRY')) {
    const entryWhere: Record<string, unknown> = {};
    
    if (searchText) {
      entryWhere.OR = [
        { entryNumber: { contains: searchText, mode: 'insensitive' } },
        { description: { contains: searchText, mode: 'insensitive' } },
        { reference: { contains: searchText, mode: 'insensitive' } },
      ];
    }
    
    if (Object.keys(dateFilter).length > 0) {
      entryWhere.date = dateFilter;
    }
    
    if (statuses && statuses.length > 0) {
      entryWhere.status = { in: statuses };
    }

    const entries = await prisma.journalEntry.findMany({
      where: entryWhere,
      include: { lines: true },
      orderBy: { date: sortOrder },
    });

    for (const entry of entries) {
      const totalAmount = entry.lines.reduce((sum, l) => sum + Number(l.debit), 0);
      
      // Apply amount filter
      if (amountMin !== undefined && totalAmount < amountMin) continue;
      if (amountMax !== undefined && totalAmount > amountMax) continue;

      // Apply account filter
      if (accountCodes && accountCodes.length > 0) {
        const hasAccount = entry.lines.some(l => accountCodes.includes(l.accountId));
        if (!hasAccount) continue;
      }

      results.push({
        id: entry.id,
        type: 'ENTRY',
        title: entry.entryNumber,
        description: entry.description,
        date: entry.date,
        amount: totalAmount,
        status: entry.status,
        reference: entry.reference || undefined,
        highlights: searchText ? generateHighlights(entry.description, searchText) : undefined,
        relevanceScore: calculateRelevance(entry.description, searchText),
      });

      // Update facets
      facets.byType['ENTRY'] = (facets.byType['ENTRY'] || 0) + 1;
      facets.byStatus[entry.status] = (facets.byStatus[entry.status] || 0) + 1;
      const monthKey = entry.date.toISOString().slice(0, 7);
      facets.byMonth[monthKey] = (facets.byMonth[monthKey] || 0) + 1;
    }
  }

  // Search Customer Invoices
  if (entityTypes.includes('INVOICE')) {
    const invoiceWhere: Record<string, unknown> = {};
    
    if (searchText) {
      invoiceWhere.OR = [
        { invoiceNumber: { contains: searchText, mode: 'insensitive' } },
        { customerName: { contains: searchText, mode: 'insensitive' } },
      ];
    }
    
    if (Object.keys(dateFilter).length > 0) {
      invoiceWhere.invoiceDate = dateFilter;
    }
    
    if (statuses && statuses.length > 0) {
      invoiceWhere.status = { in: statuses };
    }

    const invoices = await prisma.customerInvoice.findMany({
      where: invoiceWhere,
      orderBy: { invoiceDate: sortOrder },
    });

    for (const invoice of invoices) {
      const amount = Number(invoice.total);
      
      if (amountMin !== undefined && amount < amountMin) continue;
      if (amountMax !== undefined && amount > amountMax) continue;

      results.push({
        id: invoice.id,
        type: 'INVOICE',
        title: invoice.invoiceNumber,
        description: `Facture pour ${invoice.customerName}`,
        date: invoice.invoiceDate,
        amount,
        status: invoice.status,
        highlights: searchText ? generateHighlights(invoice.customerName, searchText) : undefined,
        relevanceScore: calculateRelevance(invoice.customerName + invoice.invoiceNumber, searchText),
      });

      facets.byType['INVOICE'] = (facets.byType['INVOICE'] || 0) + 1;
      facets.byStatus[invoice.status] = (facets.byStatus[invoice.status] || 0) + 1;
    }
  }

  // Search Supplier Invoices
  if (entityTypes.includes('SUPPLIER')) {
    const supplierWhere: Record<string, unknown> = {};
    
    if (searchText) {
      supplierWhere.OR = [
        { invoiceNumber: { contains: searchText, mode: 'insensitive' } },
        { supplierName: { contains: searchText, mode: 'insensitive' } },
      ];
    }
    
    if (Object.keys(dateFilter).length > 0) {
      supplierWhere.invoiceDate = dateFilter;
    }

    const suppliers = await prisma.supplierInvoice.findMany({
      where: supplierWhere,
      orderBy: { invoiceDate: sortOrder },
    });

    for (const invoice of suppliers) {
      const amount = Number(invoice.total);
      
      if (amountMin !== undefined && amount < amountMin) continue;
      if (amountMax !== undefined && amount > amountMax) continue;

      results.push({
        id: invoice.id,
        type: 'SUPPLIER',
        title: invoice.invoiceNumber,
        description: `Facture de ${invoice.supplierName}`,
        date: invoice.invoiceDate,
        amount,
        status: invoice.status,
        highlights: searchText ? generateHighlights(invoice.supplierName, searchText) : undefined,
        relevanceScore: calculateRelevance(invoice.supplierName + invoice.invoiceNumber, searchText),
      });

      facets.byType['SUPPLIER'] = (facets.byType['SUPPLIER'] || 0) + 1;
      facets.byStatus[invoice.status] = (facets.byStatus[invoice.status] || 0) + 1;
    }
  }

  // Search Bank Transactions
  if (entityTypes.includes('TRANSACTION')) {
    const txWhere: Record<string, unknown> = {};
    
    if (searchText) {
      txWhere.description = { contains: searchText, mode: 'insensitive' };
    }
    
    if (Object.keys(dateFilter).length > 0) {
      txWhere.date = dateFilter;
    }

    const transactions = await prisma.bankTransaction.findMany({
      where: txWhere,
      orderBy: { date: sortOrder },
    });

    for (const tx of transactions) {
      const amount = Number(tx.amount);
      
      if (amountMin !== undefined && amount < amountMin) continue;
      if (amountMax !== undefined && amount > amountMax) continue;

      results.push({
        id: tx.id,
        type: 'TRANSACTION',
        title: tx.description,
        description: `${tx.type} - ${tx.category || 'Non catégorisé'}`,
        date: tx.date,
        amount,
        status: tx.reconciliationStatus,
        reference: tx.reference || undefined,
        highlights: searchText ? generateHighlights(tx.description, searchText) : undefined,
        relevanceScore: calculateRelevance(tx.description, searchText),
      });

      facets.byType['TRANSACTION'] = (facets.byType['TRANSACTION'] || 0) + 1;
      facets.byStatus[tx.reconciliationStatus] = (facets.byStatus[tx.reconciliationStatus] || 0) + 1;
    }
  }

  // Sort results
  results.sort((a, b) => {
    if (sortBy === 'relevance') {
      return sortOrder === 'desc' 
        ? b.relevanceScore - a.relevanceScore 
        : a.relevanceScore - b.relevanceScore;
    }
    if (sortBy === 'amount') {
      return sortOrder === 'desc' ? b.amount - a.amount : a.amount - b.amount;
    }
    // Default: date
    return sortOrder === 'desc' 
      ? b.date.getTime() - a.date.getTime() 
      : a.date.getTime() - b.date.getTime();
  });

  // Paginate
  const total = results.length;
  const pages = Math.ceil(total / limit);
  const paginatedResults = results.slice((page - 1) * limit, page * limit);

  return {
    results: paginatedResults,
    total,
    facets,
    page,
    pages,
  };
}

/**
 * Generate text highlights for search results
 */
function generateHighlights(
  text: string,
  searchText?: string
): { field: string; snippet: string }[] {
  if (!searchText || !text) return [];

  const highlights: { field: string; snippet: string }[] = [];
  const lowerText = text.toLowerCase();
  const lowerSearch = searchText.toLowerCase();
  
  const index = lowerText.indexOf(lowerSearch);
  if (index !== -1) {
    const start = Math.max(0, index - 30);
    const end = Math.min(text.length, index + searchText.length + 30);
    let snippet = text.slice(start, end);
    
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';
    
    highlights.push({ field: 'text', snippet });
  }

  return highlights;
}

/**
 * Calculate relevance score for sorting
 */
function calculateRelevance(text: string, searchText?: string): number {
  if (!searchText || !text) return 0;

  const lowerText = text.toLowerCase();
  const lowerSearch = searchText.toLowerCase();
  const words = lowerSearch.split(/\s+/);

  let score = 0;

  // Exact match bonus
  if (lowerText.includes(lowerSearch)) {
    score += 10;
  }

  // Word matches
  for (const word of words) {
    if (lowerText.includes(word)) {
      score += 2;
    }
  }

  // Start of text match bonus
  if (lowerText.startsWith(lowerSearch)) {
    score += 5;
  }

  return score;
}

// ============================================
// SAVED SEARCHES
// ============================================

const savedSearches: Map<string, SavedSearch> = new Map();

/**
 * Save a search query
 */
export function saveSearch(
  name: string,
  query: SearchQuery,
  userId: string
): SavedSearch {
  const search: SavedSearch = {
    id: `search-${Date.now()}`,
    name,
    query,
    userId,
    isDefault: false,
    createdAt: new Date(),
    useCount: 0,
  };

  savedSearches.set(search.id, search);
  return search;
}

/**
 * Get user's saved searches
 */
export function getSavedSearches(userId: string): SavedSearch[] {
  return Array.from(savedSearches.values())
    .filter(s => s.userId === userId)
    .sort((a, b) => b.useCount - a.useCount);
}

/**
 * Delete a saved search
 */
export function deleteSavedSearch(searchId: string, userId: string): boolean {
  const search = savedSearches.get(searchId);
  if (search && search.userId === userId) {
    savedSearches.delete(searchId);
    return true;
  }
  return false;
}

/**
 * Record search usage
 */
export function recordSearchUsage(searchId: string): void {
  const search = savedSearches.get(searchId);
  if (search) {
    search.useCount++;
    search.lastUsed = new Date();
  }
}

// ============================================
// SEARCH SUGGESTIONS
// ============================================

/**
 * Get search suggestions based on recent activity
 */
export async function getSearchSuggestions(
  partialQuery: string,
  limit: number = 5
): Promise<string[]> {
  const suggestions: string[] = [];

  if (partialQuery.length < 2) return suggestions;

  // Search recent entry numbers
  const entries = await prisma.journalEntry.findMany({
    where: {
      OR: [
        { entryNumber: { contains: partialQuery, mode: 'insensitive' } },
        { description: { contains: partialQuery, mode: 'insensitive' } },
      ],
    },
    select: { entryNumber: true, description: true },
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  for (const entry of entries) {
    if (!suggestions.includes(entry.entryNumber)) {
      suggestions.push(entry.entryNumber);
    }
  }

  // Search customer names
  const invoices = await prisma.customerInvoice.findMany({
    where: {
      customerName: { contains: partialQuery, mode: 'insensitive' },
    },
    select: { customerName: true },
    take: limit,
    distinct: ['customerName'],
  });

  for (const invoice of invoices) {
    if (!suggestions.includes(invoice.customerName)) {
      suggestions.push(invoice.customerName);
    }
  }

  return suggestions.slice(0, limit);
}

/**
 * Get popular search terms
 */
export function getPopularSearchTerms(): string[] {
  // In production, track actual search history
  return [
    'Stripe',
    'TPS',
    'Remboursement',
    'Postes Canada',
    'Azure',
  ];
}

// ============================================
// SEARCH FILTERS
// ============================================

/**
 * Get available filter options
 */
export async function getFilterOptions(): Promise<{
  statuses: { value: string; label: string; count: number }[];
  accountCodes: { value: string; label: string }[];
  dateRanges: { value: string; label: string; from: Date; to: Date }[];
}> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  return {
    statuses: [
      { value: 'DRAFT', label: 'Brouillon', count: 0 },
      { value: 'POSTED', label: 'Validé', count: 0 },
      { value: 'VOIDED', label: 'Annulé', count: 0 },
      { value: 'PAID', label: 'Payé', count: 0 },
      { value: 'PENDING', label: 'En attente', count: 0 },
      { value: 'OVERDUE', label: 'En retard', count: 0 },
    ],
    accountCodes: [
      { value: '1010', label: '1010 - Banque' },
      { value: '1040', label: '1040 - Stripe' },
      { value: '4010', label: '4010 - Ventes' },
      { value: '5010', label: '5010 - Achats' },
      { value: '6110', label: '6110 - Frais Stripe' },
    ],
    dateRanges: [
      { value: 'today', label: 'Aujourd\'hui', from: new Date(now.setHours(0,0,0,0)), to: new Date() },
      { value: 'this_month', label: 'Ce mois', from: startOfMonth, to: new Date() },
      { value: 'this_quarter', label: 'Ce trimestre', from: startOfQuarter, to: new Date() },
      { value: 'this_year', label: 'Cette année', from: startOfYear, to: new Date() },
      { value: 'last_30', label: '30 derniers jours', from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), to: new Date() },
      { value: 'last_90', label: '90 derniers jours', from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), to: new Date() },
    ],
  };
}

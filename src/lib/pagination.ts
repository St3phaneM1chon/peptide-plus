/**
 * Server-side pagination helpers for API routes.
 * Supports offset-based and cursor-based pagination.
 */

import { NextRequest } from 'next/server';

export interface PaginationParams {
  page: number;
  limit: number;
  sort: string;
  order: 'asc' | 'desc';
  search: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Extract pagination params from URL search params.
 * Defaults: page=1, limit=25, sort=createdAt, order=desc
 */
export function parsePagination(
  request: NextRequest,
  options?: {
    defaultSort?: string;
    defaultOrder?: 'asc' | 'desc';
    defaultLimit?: number;
    maxLimit?: number;
    allowedSorts?: string[];
  }
): PaginationParams {
  const { searchParams } = new URL(request.url);

  const defaultSort = options?.defaultSort || 'createdAt';
  const defaultOrder = options?.defaultOrder || 'desc';
  const defaultLimit = options?.defaultLimit || 25;
  const maxLimit = options?.maxLimit || 100;
  const allowedSorts = options?.allowedSorts;

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  let limit = Math.min(maxLimit, Math.max(1, parseInt(searchParams.get('limit') || String(defaultLimit), 10)));
  if (isNaN(limit)) limit = defaultLimit;

  let sort = searchParams.get('sort') || defaultSort;
  if (allowedSorts && !allowedSorts.includes(sort)) {
    sort = defaultSort;
  }

  let order = (searchParams.get('order') || defaultOrder) as 'asc' | 'desc';
  if (order !== 'asc' && order !== 'desc') order = defaultOrder;

  const search = searchParams.get('search') || '';

  return { page, limit, sort, order, search };
}

/**
 * Build Prisma skip/take from pagination params.
 */
export function prismaPagination(params: PaginationParams) {
  return {
    skip: (params.page - 1) * params.limit,
    take: params.limit,
    orderBy: { [params.sort]: params.order },
  };
}

/**
 * Build a paginated response object.
 */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / params.limit);
  return {
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasNext: params.page < totalPages,
      hasPrev: params.page > 1,
    },
  };
}

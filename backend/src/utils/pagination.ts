const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export type PaginationQuery = {
  page?: unknown;
  limit?: unknown;
  q?: unknown;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
};

export function parsePagination(query: PaginationQuery): {
  page: number;
  limit: number;
  skip: number;
  q: string;
} {
  const pageRaw = Number.parseInt(String(query.page ?? DEFAULT_PAGE), 10);
  const limitRaw = Number.parseInt(String(query.limit ?? DEFAULT_LIMIT), 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : DEFAULT_PAGE;
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(MAX_LIMIT, limitRaw)
      : DEFAULT_LIMIT;
  const q = typeof query.q === 'string' ? query.q.trim() : '';
  return { page, limit, skip: (page - 1) * limit, q };
}

export function paginationMeta(total: number, page: number, limit: number): PaginationMeta {
  const totalPages = total === 0 ? 1 : Math.ceil(total / limit);
  const currentPage = Math.min(page, totalPages);
  return {
    page: currentPage,
    limit,
    total,
    totalPages,
    hasMore: currentPage < totalPages,
  };
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

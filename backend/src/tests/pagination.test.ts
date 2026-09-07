import { describe, expect, it } from 'vitest';
import { paginationMeta, parsePagination } from '../utils/pagination.js';

describe('parsePagination', () => {
  it('defaults to page 1 and 20 items', () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 20, skip: 0, q: '' });
  });

  it('computes skip from the requested page', () => {
    expect(parsePagination({ page: '2', limit: '10' })).toMatchObject({
      page: 2,
      limit: 10,
      skip: 10,
    });
  });

  it('clamps invalid pages and oversized limits', () => {
    expect(parsePagination({ page: '0', limit: '999' })).toMatchObject({
      page: 1,
      limit: 50,
      skip: 0,
    });
  });
});

describe('paginationMeta', () => {
  it('reports whether more pages exist', () => {
    expect(paginationMeta(45, 1, 20)).toEqual({
      page: 1,
      limit: 20,
      total: 45,
      totalPages: 3,
      hasMore: true,
    });
    expect(paginationMeta(45, 3, 20).hasMore).toBe(false);
  });
});

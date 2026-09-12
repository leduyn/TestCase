import { Request } from 'express';

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function parsePagination(
  req: Request,
  defaults: { defaultLimit?: number; maxLimit?: number } = {}
): PaginationParams {
  const { defaultLimit = 20, maxLimit = 100 } = defaults;
  const rawPage = Number(req.query.page ?? 1);
  const rawLimit = Number(req.query.limit ?? defaultLimit);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(Math.floor(rawLimit), maxLimit)
    : defaultLimit;
  return { page, limit, skip: (page - 1) * limit };
}

export function buildMeta(total: number, page: number, limit: number): PaginationMeta {
  return {
    total,
    page,
    limit,
    totalPages: total > 0 ? Math.ceil(total / limit) : 0,
  };
}

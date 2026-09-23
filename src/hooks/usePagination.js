import { useEffect, useState } from 'react';
export function usePagination(items, resetKey = '', pageSize = 50) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [resetKey]);
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pages);
  return { items: items.slice((current - 1) * pageSize, current * pageSize), page: current, pages, setPage, total: items.length };
}

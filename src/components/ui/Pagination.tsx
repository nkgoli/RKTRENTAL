import Link from 'next/link';

export const PAGE_SIZE = 20;

/** Clamp a `page` query value to a valid 1-based page for `total` rows. */
export function pageFrom(value: string | undefined, total: number, size = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(total / size));
  const requested = Number.parseInt(value ?? '1', 10);
  return Math.min(pages, Number.isFinite(requested) && requested > 0 ? requested : 1);
}

export function paginate<T>(rows: T[], page: number, size = PAGE_SIZE) {
  return rows.slice((page - 1) * size, page * size);
}

/** Footer for a long table: "21–40 of 45" with Prev/Next links built by `href(page)`. */
export function Pagination({
  page,
  total,
  size = PAGE_SIZE,
  noun = 'rows',
  href,
}: {
  page: number;
  total: number;
  size?: number;
  noun?: string;
  href: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return null;
  const from = (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  return (
    <nav className="pager" aria-label="Pagination">
      <span>
        {from}–{to} of {total} {noun}
      </span>
      <span className="pager-links">
        {page > 1 ? (
          <Link className="chip" href={href(page - 1)} rel="prev">
            ‹ Prev
          </Link>
        ) : (
          <span className="chip" aria-disabled="true">
            ‹ Prev
          </span>
        )}
        <span className="chip active" aria-current="page">
          {page} / {pages}
        </span>
        {page < pages ? (
          <Link className="chip" href={href(page + 1)} rel="next">
            Next ›
          </Link>
        ) : (
          <span className="chip" aria-disabled="true">
            Next ›
          </span>
        )}
      </span>
    </nav>
  );
}

'use client';

import Link from 'next/link';

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <section className="card" role="alert" aria-labelledby="dashboard-error-title">
      <h2 id="dashboard-error-title">Dashboard data is unavailable</h2>
      <p>We could not load your portfolio summary. Try again, or open your properties directly.</p>
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={reset}>
          Try again
        </button>
        <Link className="btn btn-secondary" href="/properties">
          Open properties
        </Link>
      </div>
    </section>
  );
}

'use client';

export function OperationsError({
  reset,
  area,
}: {
  reset: () => void;
  area: 'requests' | 'files';
}) {
  return (
    <section className="card stack" role="alert">
      <h2>
        {area === 'requests' ? 'Repair requests could not be loaded' : 'Files could not be loaded'}
      </h2>
      <p className="muted">
        Try loading this view again. Your saved{' '}
        {area === 'requests' ? 'requests and attachments' : 'documents and photos'} have not been
        changed.
      </p>
      <div className="row">
        <button className="btn btn-primary" onClick={reset}>
          Try again
        </button>
        <a className="btn btn-secondary" href={area === 'requests' ? '/maintenance' : '/documents'}>
          Open all {area}
        </a>
      </div>
    </section>
  );
}

'use client';
import Link from 'next/link';
export default function RentAnalysisError({ reset }: { reset: () => void }) {
  return (
    <section className="card stack" role="alert">
      <h1>Couldn’t load Rent Analysis</h1>
      <p>Your property, unit and filters are kept in the address. Try again.</p>
      <button className="btn btn-primary" onClick={reset}>
        Try again
      </button>
      <Link href="/rent-analysis">Choose a property</Link>
    </section>
  );
}

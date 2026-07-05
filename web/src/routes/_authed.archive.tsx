import { createFileRoute } from '@tanstack/react-router';
import { getArchiveFn } from '../server/archive';

export const Route = createFileRoute('/_authed/archive')({
  loader: () => getArchiveFn(),
  component: ArchivePage,
});

function ArchivePage() {
  const discussed = Route.useLoaderData();

  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Book club</p>
        <h1>Past picks</h1>
      </section>

      {discussed.length === 0 ? (
        <div className="empty">Nothing discussed yet.</div>
      ) : (
        <ul className="archive">
          {discussed.map((submission) => (
            <li key={submission.id} className="archive-row">
              <a href={submission.url} target="_blank" rel="noreferrer">
                {submission.title}
              </a>
              {submission.discussedAt != null ? (
                <time>
                  {new Date(submission.discussedAt).toLocaleDateString()}
                </time>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <a href="/" className="back-link">
        ← Back to the pool
      </a>
    </main>
  );
}

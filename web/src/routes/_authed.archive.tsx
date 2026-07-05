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
      <h1>Recently discussed</h1>
      <p className="subtitle">Everything the club has read, newest first.</p>

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
                <time>{new Date(submission.discussedAt).toLocaleDateString()}</time>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

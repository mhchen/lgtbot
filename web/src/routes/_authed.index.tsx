import { createFileRoute } from '@tanstack/react-router';
import { getPoolFn } from '../server/pool';

export const Route = createFileRoute('/_authed/')({
  loader: () => getPoolFn(),
  component: PoolPage,
});

function PoolPage() {
  const { rows, currentVoteId } = Route.useLoaderData();

  return (
    <main>
      <h1>This week&rsquo;s pool</h1>
      <p className="subtitle">Voting closes Tuesday morning.</p>

      {rows.length === 0 ? (
        <div className="empty">Nothing in the pool yet. Be the first to submit.</div>
      ) : (
        <ul className="pool">
          {rows.map((row) => {
            const mine = row.id === currentVoteId;
            return (
              <li key={row.id} className="pool-row" data-mine={mine}>
                <div className="pool-count">
                  {row.voteCount}
                  <small>{row.voteCount === 1 ? 'vote' : 'votes'}</small>
                </div>
                <div className="pool-main">
                  <a className="pool-title" href={row.url} target="_blank" rel="noreferrer">
                    {row.title}
                  </a>
                  {mine ? <span className="pool-mine-tag">Your vote</span> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

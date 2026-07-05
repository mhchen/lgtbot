import { useState } from 'react';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { getPoolFn } from '../server/pool';
import { castVoteFn } from '../server/vote';
import { submitArticleFn } from '../server/submit';

export const Route = createFileRoute('/_authed/')({
  loader: () => getPoolFn(),
  component: PoolPage,
});

function PoolPage() {
  const { rows, currentVoteId } = Route.useLoaderData();
  const router = useRouter();

  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingDiscussedAt, setPendingDiscussedAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function vote(submissionId: number) {
    await castVoteFn({ data: { submissionId } });
    await router.invalidate();
  }

  async function submit(confirmResubmit: boolean) {
    setBusy(true);
    setError(null);
    try {
      const result = await submitArticleFn({
        data: { url, title: title || undefined, confirmResubmit },
      });
      if ('needsConfirm' in result) {
        setPendingDiscussedAt(result.discussedAt ?? Date.now());
        return;
      }
      setUrl('');
      setTitle('');
      setPendingDiscussedAt(null);
      await router.invalidate();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>This week&rsquo;s pool</h1>
      <p className="subtitle">Voting closes Tuesday morning.</p>

      <form
        className="submit-form"
        onSubmit={(event) => {
          event.preventDefault();
          submit(false);
        }}
      >
        <input
          className="field"
          type="url"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            setPendingDiscussedAt(null);
          }}
          placeholder="Paste an article URL"
          required
        />
        <input
          className="field"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Title (optional)"
        />
        <button type="submit" className="submit-btn" disabled={busy}>
          {busy ? 'Working…' : 'Submit'}
        </button>
      </form>

      {error ? <p className="form-error">{error}</p> : null}

      {pendingDiscussedAt ? (
        <div className="resubmit">
          <span>
            This was discussed on {new Date(pendingDiscussedAt).toLocaleDateString()}. Submit anyway?
          </span>
          <div className="resubmit-actions">
            <button
              type="button"
              className="vote-btn"
              disabled={busy}
              onClick={() => submit(true)}
            >
              Submit anyway
            </button>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setPendingDiscussedAt(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

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
                <button
                  type="button"
                  className="vote-btn"
                  disabled={mine}
                  onClick={() => vote(row.id)}
                >
                  {mine ? 'Voted' : 'Vote'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

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
  const [pendingDiscussedAt, setPendingDiscussedAt] = useState<number | null>(
    null
  );
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
      setError(
        caught instanceof Error ? caught.message : 'Something went wrong.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Book club</p>
        <h1>This week&rsquo;s pool</h1>
      </section>

      <div className="submit">
        <p className="submit__label">Add to the pool</p>
        <form
          className="submit__form"
          onSubmit={(event) => {
            event.preventDefault();
            submit(false);
          }}
        >
          <div className="field-group field-group--grow">
            <label className="field-label" htmlFor="submit-url">
              Article URL
            </label>
            <input
              id="submit-url"
              className="field"
              type="url"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                setPendingDiscussedAt(null);
              }}
              placeholder="https://…"
              required
            />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="submit-title">
              Title <span className="field-label__hint">(optional)</span>
            </label>
            <input
              id="submit-title"
              className="field"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="We'll fetch it"
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Working…' : 'Submit'}
          </button>
        </form>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {pendingDiscussedAt ? (
        <div className="resubmit">
          <span>
            This was discussed on{' '}
            {new Date(pendingDiscussedAt).toLocaleDateString()}. Submit anyway?
          </span>
          <div className="resubmit__actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => submit(true)}
            >
              Submit anyway
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setPendingDiscussedAt(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="empty">
          Nothing in the pool yet. Be the first to submit.
        </div>
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
                  <a
                    className="pool-title"
                    href={row.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {row.title}
                  </a>
                  {mine ? <span className="pool-mine">Your vote</span> : null}
                </div>
                <button
                  type="button"
                  className={`btn ${mine ? 'btn-ghost' : 'btn-secondary'}`}
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

      <div className="section-head">
        <h2>Past picks</h2>
        <a href="/archive" className="nav-link">
          View archive
        </a>
      </div>
    </main>
  );
}

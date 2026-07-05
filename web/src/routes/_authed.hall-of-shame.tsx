import { createFileRoute } from '@tanstack/react-router';
import { getHallOfShameFn } from '../server/bans';

export const Route = createFileRoute('/_authed/hall-of-shame')({
  loader: () => getHallOfShameFn(),
  component: HallOfShamePage,
});

function HallOfShamePage() {
  const { leaderboard, trophies } = Route.useLoaderData();

  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Hall of shame</p>
        <h1>Book club bans</h1>
      </section>

      {leaderboard.length === 0 ? (
        <div className="empty">Nobody has been banned yet. Give it time.</div>
      ) : (
        <ul className="board">
          {leaderboard.map((row) => (
            <li
              key={row.userId}
              className="board-row"
              data-top={row.rank <= 3 ? row.rank : undefined}
            >
              <div className="board-rank">{row.rank}</div>
              <img className="avatar" src={row.avatarUrl} alt="" />
              <div className="board-main">
                <div className="board-name">{row.displayName}</div>
                {row.achievementTitle ? (
                  <div className="board-sub">
                    <span
                      className="level-badge"
                      style={{ color: 'var(--coral)' }}
                    >
                      <b>{row.achievementTitle}</b>
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="board-stat">
                <b>{row.banCount}</b>
                <small>{row.banCount === 1 ? 'ban' : 'bans'}</small>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="section-head">
        <h2>Trophy case</h2>
      </div>
      <div className="trophies">
        {trophies.map((tier) => (
          <div
            key={tier.threshold}
            className="trophy"
            data-earned={tier.earned}
          >
            <img
              className="trophy__img"
              src={`/cheevos/${tier.threshold}-bans.png`}
              alt={tier.title}
            />
            <div className="trophy__threshold">{tier.threshold} bans</div>
            <div className="trophy__title">{tier.title}</div>
            <div className="trophy__sub">{tier.subtitle}</div>
            <div className="trophy__holder">
              {tier.holders.length > 0 ? (
                <>
                  Held by <b>{tier.holders.join(', ')}</b>
                </>
              ) : (
                'Unclaimed'
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

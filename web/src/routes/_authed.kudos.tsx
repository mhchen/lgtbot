import { createFileRoute } from '@tanstack/react-router';
import { getKudosLeaderboardFn } from '../server/kudos';

const LEVEL_COLORS = [
  'oklch(0.83 0.12 205)',
  'oklch(0.82 0.12 232)',
  'oklch(0.79 0.12 262)',
  'oklch(0.76 0.13 292)',
  'oklch(0.74 0.15 322)',
  'oklch(0.74 0.17 348)',
  'oklch(0.76 0.18 358)',
  'oklch(0.77 0.16 15)',
  'oklch(0.79 0.14 32)',
  'oklch(0.83 0.15 55)',
];

export const Route = createFileRoute('/_authed/kudos')({
  loader: () => getKudosLeaderboardFn(),
  component: KudosPage,
});

function KudosPage() {
  const rows = Route.useLoaderData();

  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Kudos</p>
        <h1>Helpfulness leaderboard</h1>
      </section>

      {rows.length === 0 ? (
        <div className="empty">
          No kudos yet. React with :lgt: on a good message to start the board.
        </div>
      ) : (
        <ul className="board">
          {rows.map((row) => (
            <li
              key={row.userId}
              className="board-row"
              data-top={row.rank <= 3 ? row.rank : undefined}
            >
              <div className="board-rank">{row.rank}</div>
              <img className="avatar" src={row.avatarUrl} alt="" />
              <div className="board-main">
                <div className="board-name">{row.displayName}</div>
                <div className="board-sub">
                  <span
                    className="level-badge"
                    style={{
                      color: LEVEL_COLORS[Math.min(row.levelNumber, 10) - 1],
                    }}
                  >
                    Lv {row.levelNumber} <b>{row.levelName}</b>
                  </span>
                </div>
              </div>
              <div className="board-stat">
                <b>{row.totalPoints.toLocaleString()}</b>
                <small>points</small>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

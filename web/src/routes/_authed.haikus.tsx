import { createFileRoute } from '@tanstack/react-router';
import { getHaikusFn } from '../server/haikus';

export const Route = createFileRoute('/_authed/haikus')({
  loader: () => getHaikusFn(),
  component: HaikusPage,
});

function HaikusPage() {
  const haikus = Route.useLoaderData();

  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Haikus</p>
        <h1>Accidental poetry</h1>
      </section>

      {haikus.length === 0 ? (
        <div className="empty">
          No haikus yet. Keep talking, eventually someone slips into meter.
        </div>
      ) : (
        <div className="haikus">
          {haikus.map((haiku) => (
            <figure key={haiku.id} className="haiku">
              <p className="haiku__lines">
                {haiku.lines.map((line, index) => (
                  <span key={index} className="haiku__line">
                    {line}
                  </span>
                ))}
              </p>
              <figcaption className="haiku__attr">
                — {haiku.author}
                <span className="haiku__date">
                  {new Date(haiku.createdAt).toLocaleDateString()}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </main>
  );
}

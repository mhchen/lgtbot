import { test, expect } from 'bun:test';
import {
  buildVoteMessagePayload,
  fetchTitle,
  resolveSubmissionTitle,
} from '../book-club-picks';

test('buildVoteMessagePayload includes the submitter, title, and a vote button', () => {
  const payload = buildVoteMessagePayload({
    id: 7,
    title: 'A Post',
    url: 'https://example.com/post',
    submittedBy: '123',
  });
  expect(payload.content).toContain('A Post');
  expect(payload.content).toContain('<@123>');
  const json = payload.components[0].toJSON();
  expect(json.components[0]).toMatchObject({
    custom_id: 'bookclub-vote-btn-7',
  });
});

test('resolveSubmissionTitle prefers an explicit user title', async () => {
  const title = await resolveSubmissionTitle('https://example.com', 'My Title');
  expect(title).toBe('My Title');
});

test('fetchTitle decodes HTML entities in the page title', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      '<html><head><title>Nine Questions I Wish I&#x27;d Asked &amp; More</title></head></html>'
    )) as typeof fetch;
  try {
    const title = await fetchTitle('https://example.com/post');
    expect(title).toBe("Nine Questions I Wish I'd Asked & More");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

import { createServerFn } from '@tanstack/react-start';
import { requireMemberFn } from './membership';

export const submitArticleFn = createServerFn({ method: 'POST' })
  .validator(
    (data: { url: string; title?: string; confirmResubmit?: boolean }) => data,
  )
  .handler(async ({ data }) => {
    const member = await requireMemberFn();

    const {
      normalizeUrl,
      resolveSubmissionTitle,
      buildVoteMessagePayload,
      BOOK_CLUB_CHANNEL_ID,
    } = await import('../../../src/book-club-picks');
    const {
      findActiveByUrl,
      findDiscussedByUrl,
      createSubmission,
      trackVoteMessage,
    } = await import('../../../src/db/book-club-picks');

    let cleanUrl: string;
    try {
      cleanUrl = normalizeUrl(data.url);
    } catch {
      throw new Error('That does not look like a valid URL.');
    }

    if (findActiveByUrl(cleanUrl) != null) {
      throw new Error('That article is already in the pool.');
    }

    const discussed = findDiscussedByUrl(cleanUrl);
    if (discussed != null && !data.confirmResubmit) {
      return {
        needsConfirm: true as const,
        discussedAt: discussed.discussedAt!.getTime(),
      };
    }

    const title = await resolveSubmissionTitle(data.url, data.title);
    const submission = createSubmission({
      url: cleanUrl,
      title,
      submittedBy: member.userId,
    });

    const { REST } = await import('discord.js');
    const { Routes } = await import('discord-api-types/v10');
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

    const payload = buildVoteMessagePayload(submission);
    const message = (await rest.post(Routes.channelMessages(BOOK_CLUB_CHANNEL_ID), {
      body: {
        content: payload.content,
        components: payload.components.map((row) => row.toJSON()),
      },
    })) as { id: string };

    trackVoteMessage({
      submissionId: submission.id,
      messageId: message.id,
      channelId: BOOK_CLUB_CHANNEL_ID,
    });

    return { ok: true as const };
  });

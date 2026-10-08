import { createServerFn } from '@tanstack/react-start';
import { requireMemberFn } from './membership';

export const setPickSubscriptionFn = createServerFn({ method: 'POST' })
  .validator((data: { subscribed: boolean }) => data)
  .handler(async ({ data }) => {
    const member = await requireMemberFn();
    const { addPickSubscriber, removePickSubscriber } = await import(
      '../../../src/db/book-club-picks'
    );
    if (data.subscribed) {
      addPickSubscriber(member.userId);
    } else {
      removePickSubscriber(member.userId);
    }
    return { ok: true as const };
  });

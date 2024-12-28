import express, { type Request } from 'express';
import crypto from 'crypto';
import {
  Client,
  EmbedBuilder,
  TextChannel,
  type APIEmbedField,
} from 'discord.js';
import { getStreamInfo, getUserInfo } from './twitch';

function verifyTwitchSignature(req: Request, buf: Buffer) {
  const messageId = req.headers['twitch-eventsub-message-id'] as string;
  const timestamp = req.headers['twitch-eventsub-message-timestamp'] as string;
  const signature = req.headers['twitch-eventsub-message-signature'] as string;

  const computedSignature =
    'sha256=' +
    crypto
      .createHmac('sha256', process.env.WEBHOOK_SECRET!)
      .update(messageId + timestamp + buf)
      .digest('hex');

  return computedSignature === signature;
}

export function startWebhookServer({
  client,
  channelId,
}: {
  client: Client;
  channelId: string;
}) {
  const app = express();
  app.use(
    express.json({
      verify: (req: any, _, buf) => {
        req.rawBody = buf;
      },
    })
  );

  app.post('/twitch-stream-started', async (req, res) => {
    if (!verifyTwitchSignature(req, req.rawBody)) {
      res.sendStatus(403);
      return;
    }

    if (
      req.headers['twitch-eventsub-message-type'] ===
      'webhook_callback_verification'
    ) {
      res.send(req.body.challenge);
      return;
    }

    if (req.body.subscription.type === 'stream.online') {
      const username = req.body.event.broadcaster_user_name;
      const userId = req.body.event.broadcaster_user_id;

      const streamInfo = await getStreamInfo({ userId });
      const userInfo = await getUserInfo({ userId });

      const embed = new EmbedBuilder()
        .setColor('#6441a5')
        .setTitle(`${username} is now live!`)
        .setThumbnail(userInfo.profile_image_url)
        .addFields(
          ...([
            streamInfo.game_name && {
              name: 'Playing',
              value: streamInfo.game_name,
            },
            streamInfo.title && { name: 'Title', value: streamInfo.title },
          ].filter(Boolean) as APIEmbedField[])
        )
        .setImage(
          streamInfo.thumbnail_url?.replace('{width}x{height}', '1280x720')
        )
        .setURL(`https://twitch.tv/${username}`);

      const channel = await client.channels.fetch(channelId);
      if (channel instanceof TextChannel) {
        await channel.send({ embeds: [embed] });
      }
    }

    res.sendStatus(200);
  });

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Webhook server listening on port ${port}`);
  });
}

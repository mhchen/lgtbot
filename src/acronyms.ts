import { Client, Message } from 'discord.js';
import { logger } from './logger';

const WATERCOOLER_CHANNEL_ID = '964903664265359433';

const acronyms = new Map<string, string>([
  ['afaik', 'as far as I know'],
  ['afk', 'away from keyboard'],
  ['be', 'backend'],
  ['brb', 'be right back'],
  ['bro', 'brother'],
  ['btw', 'by the way'],
  ['cya', 'see you'],
  ['dm', 'direct message'],
  ['fe', 'frontend'],
  ['fomo', 'fear of missing out'],
  ['fr', 'for real'],
  ['ftw', 'for the win'],
  ['fwiw', "for what it's worth"],
  ['fyi', 'for your information'],
  ['gj', 'good job'],
  ['gm', 'good morning'],
  ['gn', 'good night'],
  ['goat', 'greatest of all time'],
  ['icymi', 'in case you missed it'],
  ['idk', "I don't know"],
  ['iirc', 'if I recall correctly'],
  ['imho', 'in my humble opinion'],
  ['imo', 'in my opinion'],
  ['irl', 'in real life'],
  ['iykyk', 'if you know you know'],
  ['j/k', 'just kidding'],
  ['jk', 'just kidding'],
  ['js', 'javascript'],
  ['lmao', 'laughing my ass off'],
  ['lol', 'laughing out loud'],
  ['n/a', 'not applicable'],
  ['n/m', 'nevermind'],
  ['ngl', 'not gonna lie'],
  ['nj', 'nice job'],
  ['noob', 'newbie'],
  ['np', 'no problem'],
  ['nsfw', 'not safe for work'],
  ['nvm', 'nevermind'],
  ['omg', 'oh my god'],
  ['ong', 'on god'],
  ['otoh', 'on the other hand'],
  ['qa', 'quality assurance'],
  ['rip', 'rest in peace'],
  ['rn', 'right now'],
  ['rofl', 'rolling on the floor laughing'],
  ['roflmao', 'rolling on the floor laughing my ass off'],
  ['sis', 'sister'],
  ['smh', 'shaking my head'],
  ['tbh', 'to be honest'],
  ['tl;dr', "too long; didn't read"],
  ['tldr', "too long; didn't read"],
  ['tn', 'tonight'],
  ['ts', 'typescript'],
  ['ty', 'thank you'],
  ['u', 'you'],
  ['ui', 'user interface'],
  ['ux', 'user experience'],
  ['wtf', 'what the fuck'],
  ['wyd', 'what you doing'],
  ['yolo', 'you only live once'],
  ['yw', "you're welcome"],
]);

function detectAcronyms(content: string): string[] {
  const words = content.toLowerCase().split(/\b/);
  const detectedAcronyms = words.filter((word) => acronyms.has(word));

  return detectedAcronyms;
}

export function registerAcronymListeners(client: Client): void {
  logger.info('Acronym listeners registered');

  client.on('messageCreate', async (message: Message) => {
    try {
      if (message.author.bot) return;

      if (message.channel.id !== WATERCOOLER_CHANNEL_ID) return;

      const detectedAcronyms = detectAcronyms(message.content);

      if (detectedAcronyms.length > 0) {
        const definitions = detectedAcronyms
          .map((acronym) => `${acronym} = ${acronyms.get(acronym)}`)
          .join('\n');

        await message.reply(definitions);

        logger.info({
          event: 'acronyms_detected',
          userId: message.author.id,
          acronyms: detectedAcronyms,
          channelId: message.channel.id,
        });
      }
    } catch (error) {
      logger.error({
        event: 'acronym_detection_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        messageId: message.id,
      });
    }
  });
}

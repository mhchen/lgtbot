import { CommandInteraction, TextChannel, Message } from 'discord.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const MESSAGE_LIMIT = 25;

function createGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  return new GoogleGenerativeAI(apiKey);
}

async function fetchRecentMessages({
  interaction,
  limit,
}: {
  interaction: CommandInteraction;
  limit: number;
}): Promise<Message[]> {
  if (!interaction.channel || !(interaction.channel instanceof TextChannel)) {
    throw new Error('Command must be used in a text channel');
  }

  const messages = await interaction.channel.messages.fetch({ limit });
  return Array.from(messages.values());
}

function formatMessagesForPrompt(messages: Message[], userId: string): string {
  return messages
    .reverse()
    .map((msg) => {
      const isUser = msg.author.id === userId;
      const username = isUser ? 'THE_USER' : msg.author.username;
      return `${username}: ${msg.content}`;
    })
    .join('\n');
}

function createRoastPrompt(messageContext: string): string {
  return `
You are a comedy roast bot. Your job is to playfully roast the user marked as THE_USER based on their messages in this chat history:

${messageContext}

Create a single paragraph roast that playfully teases THE_USER about their conversation style, vocabulary choices, or topics they've discussed. 
The roast should be funny, clever, and unexpected, but not mean-spirited or genuinely hurtful.
Keep it under 250 characters.
Do not use any disclaimers or explanations - just deliver the roast directly.
`;
}

async function generateRoast(messageContext: string): Promise<string> {
  try {
    const genAI = createGeminiClient();
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent(
      createRoastPrompt(messageContext)
    );
    const response = result.response;
    console.log(response);
    const text = response.text();

    return text;
  } catch (error) {
    console.error('Error generating roast:', error);
    return "Sorry, I couldn't roast you this time. The roast machine needs to cool down.";
  }
}

export async function handleRoastMe(
  interaction: CommandInteraction
): Promise<string> {
  await interaction.deferReply();

  try {
    const messages = await fetchRecentMessages({
      interaction,
      limit: MESSAGE_LIMIT,
    });

    const messageContext = formatMessagesForPrompt(
      messages,
      interaction.user.id
    );

    const roast = await generateRoast(messageContext);
    return roast;
  } catch (error) {
    console.error('Error in roastme command:', error);
    return "Failed to generate a roast. Maybe you're just too perfect to roast?";
  }
}

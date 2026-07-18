// @ts-ignore
import { encode } from 'gpt-3-encoder';
import { Message } from './types.js';

export function countTokens(text: string): number {
  if (!text) return 0;
  try {
    return encode(text).length;
  } catch (error) {
    // Fallback approximation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}

export function countMessagesTokens(messages: Message[]): number {
  let count = 0;
  for (const msg of messages) {
    count += countTokens(msg.role);
    count += countTokens(msg.content);
    count += 4; // OpenAI formatting overhead
  }
  count += 3; // Assistant reply buffer
  return count;
}

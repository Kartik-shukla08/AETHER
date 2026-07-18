export interface Message {
  role: 'user' | 'assistant' | 'system' | string;
  content: string;
}

export interface ChatParams {
  provider: string; // "openai" | "gemini" | "groq" | "grok" | "openrouter"
  model: string;
  messages: Message[];
  stream?: boolean;
  apiKey: string;
  conversationId?: string;
}

export interface InferenceMetrics {
  latencyMs: number;
  ttftMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  requestPreview: string;
  responsePreview: string;
}

export interface ChatResponse {
  content: string;
  metrics: InferenceMetrics;
}

export interface ChatStreamChunk {
  text: string;
}

export interface ChatStreamResponse {
  stream: AsyncIterable<ChatStreamChunk>;
  metricsPromise: Promise<ChatResponse>;
}

export interface LLMProvider {
  chat(params: ChatParams): Promise<ChatResponse>;
  chatStream(params: ChatParams): Promise<ChatStreamResponse>;
}

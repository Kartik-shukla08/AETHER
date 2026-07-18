import { OpenAI } from 'openai';
import { LLMProvider, ChatParams, ChatResponse, ChatStreamResponse } from '../types.js';
import { countTokens, countMessagesTokens } from '../tokenizer.js';

export class OpenAIProvider implements LLMProvider {
  private getClient(apiKey: string, provider: string): OpenAI {
    let baseURL: string | undefined;
    if (provider === 'groq') {
      baseURL = 'https://api.groq.com/openai/v1';
    } else if (provider === 'grok') {
      baseURL = 'https://api.x.ai/v1';
    } else if (provider === 'openrouter') {
      baseURL = 'https://openrouter.ai/api/v1';
    }
    return new OpenAI({
      apiKey,
      baseURL,
    });
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    const { provider, model, messages, apiKey } = params;
    const client = this.getClient(apiKey, provider);

    const startTime = Date.now();
    const requestPayload = {
      model,
      messages: messages as any,
      stream: false,
    };

    const response = (await client.chat.completions.create(requestPayload)) as any;
    const latencyMs = Date.now() - startTime;
    const ttftMs = latencyMs; // non-streaming: TTFT = total latency

    const content = response.choices[0]?.message?.content || '';
    const inputTokens = response.usage?.prompt_tokens ?? countMessagesTokens(messages);
    const outputTokens = response.usage?.completion_tokens ?? countTokens(content);
    const totalTokens = response.usage?.total_tokens ?? (inputTokens + outputTokens);

    return {
      content,
      metrics: {
        latencyMs,
        ttftMs,
        inputTokens,
        outputTokens,
        totalTokens,
        requestPreview: JSON.stringify(requestPayload),
        responsePreview: JSON.stringify(response),
      },
    };
  }

  async chatStream(params: ChatParams): Promise<ChatStreamResponse> {
    const { provider, model, messages, apiKey } = params;
    const client = this.getClient(apiKey, provider);

    const startTime = Date.now();
    const requestPayload: any = {
      model,
      messages: messages as any,
      stream: true,
    };

    // OpenAI and Groq support stream_options
    if (provider === 'openai' || provider === 'groq') {
      requestPayload.stream_options = { include_usage: true };
    }

    const responseStream = (await client.chat.completions.create(requestPayload)) as any;

    let ttftMs = 0;
    let completedContent = '';
    let usage: any = null;

    let resolveMetrics: (value: ChatResponse) => void;
    const metricsPromise = new Promise<ChatResponse>((resolve) => {
      resolveMetrics = resolve;
    });

    const streamGenerator = async function* () {
      try {
        for await (const chunk of responseStream) {
          if (chunk.usage) {
            usage = chunk.usage;
          }

          const text = chunk.choices[0]?.delta?.content || '';
          if (text) {
            if (ttftMs === 0) {
              ttftMs = Date.now() - startTime;
            }
            completedContent += text;
            yield { text };
          }
        }
      } finally {
        const latencyMs = Date.now() - startTime;
        if (ttftMs === 0) {
          ttftMs = latencyMs;
        }
        const inputTokens = usage?.prompt_tokens ?? countMessagesTokens(messages);
        const outputTokens = usage?.completion_tokens ?? countTokens(completedContent);
        const totalTokens = usage?.total_tokens ?? (inputTokens + outputTokens);

        resolveMetrics({
          content: completedContent,
          metrics: {
            latencyMs,
            ttftMs,
            inputTokens,
            outputTokens,
            totalTokens,
            requestPreview: JSON.stringify(requestPayload),
            responsePreview: JSON.stringify({ completedContent, usage }),
          },
        });
      }
    };

    return {
      stream: streamGenerator(),
      metricsPromise,
    };
  }
}

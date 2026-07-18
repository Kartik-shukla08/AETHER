import { GoogleGenerativeAI } from '@google/generative-ai';
import { LLMProvider, ChatParams, ChatResponse, ChatStreamResponse } from '../types.js';
import { countTokens, countMessagesTokens } from '../tokenizer.js';

export class GeminiProvider implements LLMProvider {
  async chat(params: ChatParams): Promise<ChatResponse> {
    const { model, messages, apiKey } = params;
    const genAI = new GoogleGenerativeAI(apiKey);

    const systemMsg = messages.find((m) => m.role === 'system');
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const modelInstance = genAI.getGenerativeModel({
      model,
      ...(systemMsg ? { systemInstruction: systemMsg.content } : {}),
    });

    const startTime = Date.now();
    const result = await modelInstance.generateContent({ contents });
    const latencyMs = Date.now() - startTime;
    const ttftMs = latencyMs; // Non-streaming TTFT = total latency

    const response = await result.response;
    const content = response.text() || '';

    let inputTokens = countMessagesTokens(messages);
    let outputTokens = countTokens(content);
    if ((response as any).usageMetadata) {
      inputTokens = (response as any).usageMetadata.promptTokenCount ?? inputTokens;
      outputTokens = (response as any).usageMetadata.candidatesTokenCount ?? outputTokens;
    }
    const totalTokens = inputTokens + outputTokens;

    return {
      content,
      metrics: {
        latencyMs,
        ttftMs,
        inputTokens,
        outputTokens,
        totalTokens,
        requestPreview: JSON.stringify({ model, contents, systemInstruction: systemMsg?.content }),
        responsePreview: JSON.stringify(response),
      },
    };
  }

  async chatStream(params: ChatParams): Promise<ChatStreamResponse> {
    const { model, messages, apiKey } = params;
    const genAI = new GoogleGenerativeAI(apiKey);

    const systemMsg = messages.find((m) => m.role === 'system');
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const modelInstance = genAI.getGenerativeModel({
      model,
      ...(systemMsg ? { systemInstruction: systemMsg.content } : {}),
    });

    const startTime = Date.now();
    const resultStream = await modelInstance.generateContentStream({ contents });

    let ttftMs = 0;
    let completedContent = '';
    let response: any = null;

    let resolveMetrics: (value: ChatResponse) => void;
    const metricsPromise = new Promise<ChatResponse>((resolve) => {
      resolveMetrics = resolve;
    });

    const streamGenerator = async function* () {
      try {
        for await (const chunk of resultStream.stream) {
          const text = chunk.text();
          if (text) {
            if (ttftMs === 0) {
              ttftMs = Date.now() - startTime;
            }
            completedContent += text;
            yield { text };
          }
        }
        // Obtain the full response metadata once generator finishes
        response = await resultStream.response;
      } finally {
        const latencyMs = Date.now() - startTime;
        if (ttftMs === 0) {
          ttftMs = latencyMs;
        }

        let inputTokens = countMessagesTokens(messages);
        let outputTokens = countTokens(completedContent);
        if (response && (response as any).usageMetadata) {
          inputTokens = (response as any).usageMetadata.promptTokenCount ?? inputTokens;
          outputTokens = (response as any).usageMetadata.candidatesTokenCount ?? outputTokens;
        }
        const totalTokens = inputTokens + outputTokens;

        resolveMetrics({
          content: completedContent,
          metrics: {
            latencyMs,
            ttftMs,
            inputTokens,
            outputTokens,
            totalTokens,
            requestPreview: JSON.stringify({ model, contents, systemInstruction: systemMsg?.content }),
            responsePreview: JSON.stringify({ completedContent, usageMetadata: response?.usageMetadata }),
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

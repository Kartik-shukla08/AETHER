import { OpenAIProvider } from './providers/openai.js';
import { GeminiProvider } from './providers/gemini.js';
import { LLMProvider, ChatParams, ChatResponse, ChatStreamResponse } from './types.js';

import { publishInferenceEvent } from './queue.js';

export * from './types.js';
export * from './tokenizer.js';
export { publishInferenceEvent, closeQueue } from './queue.js';

export class ProviderFactory {
  static getProvider(providerName: string): LLMProvider {
    const lower = providerName.toLowerCase();
    if (lower === 'gemini') {
      return new GeminiProvider();
    }
    if (['openai', 'groq', 'grok', 'openrouter'].includes(lower)) {
      return new OpenAIProvider();
    }
    throw new Error(`Unsupported provider: ${providerName}`);
  }
}

export async function chat(params: ChatParams): Promise<ChatResponse> {
  const provider = ProviderFactory.getProvider(params.provider);
  const startTime = Date.now();
  try {
    const response = await provider.chat(params);
    if (params.conversationId) {
      publishInferenceEvent({
        conversationId: params.conversationId,
        provider: params.provider,
        model: params.model,
        latencyMs: response.metrics.latencyMs,
        ttftMs: response.metrics.ttftMs,
        inputTokens: response.metrics.inputTokens,
        outputTokens: response.metrics.outputTokens,
        totalTokens: response.metrics.totalTokens,
        requestPreview: response.metrics.requestPreview,
        responsePreview: response.metrics.responsePreview,
        status: 'success',
      }).catch(err => console.error('[SDK] Error publishing success event:', err));
    }
    return response;
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    if (params.conversationId) {
      publishInferenceEvent({
        conversationId: params.conversationId,
        provider: params.provider,
        model: params.model,
        latencyMs,
        ttftMs: latencyMs,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        requestPreview: JSON.stringify({ messages: params.messages }),
        responsePreview: JSON.stringify({ error: error.message }),
        status: 'error',
        errorMessage: error.message || 'Unknown provider error',
      }).catch(err => console.error('[SDK] Error publishing error event:', err));
    }
    throw error;
  }
}

export async function chatStream(params: ChatParams): Promise<ChatStreamResponse> {
  const provider = ProviderFactory.getProvider(params.provider);
  const startTime = Date.now();
  try {
    const response = await provider.chatStream(params);
    
    if (params.conversationId) {
      const cid = params.conversationId;
      response.metricsPromise
        .then((metrics) => {
          publishInferenceEvent({
            conversationId: cid,
            provider: params.provider,
            model: params.model,
            latencyMs: metrics.metrics.latencyMs,
            ttftMs: metrics.metrics.ttftMs,
            inputTokens: metrics.metrics.inputTokens,
            outputTokens: metrics.metrics.outputTokens,
            totalTokens: metrics.metrics.totalTokens,
            requestPreview: metrics.metrics.requestPreview,
            responsePreview: metrics.metrics.responsePreview,
            status: 'success',
          }).catch(err => console.error('[SDK] Error publishing stream success event:', err));
        })
        .catch((err) => {
          const latencyMs = Date.now() - startTime;
          publishInferenceEvent({
            conversationId: cid,
            provider: params.provider,
            model: params.model,
            latencyMs,
            ttftMs: latencyMs,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            requestPreview: JSON.stringify({ messages: params.messages }),
            responsePreview: JSON.stringify({ error: err.message }),
            status: 'error',
            errorMessage: err.message || 'Stream processing failed',
          }).catch(e => console.error('[SDK] Error publishing stream error event:', e));
        });
    }

    return response;
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    if (params.conversationId) {
      publishInferenceEvent({
        conversationId: params.conversationId,
        provider: params.provider,
        model: params.model,
        latencyMs,
        ttftMs: latencyMs,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        requestPreview: JSON.stringify({ messages: params.messages }),
        responsePreview: JSON.stringify({ error: error.message }),
        status: 'error',
        errorMessage: error.message || 'Unknown provider error',
      }).catch(err => console.error('[SDK] Error publishing stream creation error event:', err));
    }
    throw error;
  }
}

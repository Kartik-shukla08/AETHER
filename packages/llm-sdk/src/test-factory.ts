import { ProviderFactory } from './index.js';
import { OpenAIProvider } from './providers/openai.js';
import { GeminiProvider } from './providers/gemini.js';

function run() {
  console.log('=== Running LLM SDK Factory Unit Tests ===');

  try {
    const openai = ProviderFactory.getProvider('openai');
    console.log('✓ openai maps to OpenAIProvider');
    if (!(openai instanceof OpenAIProvider)) throw new Error('openai mismatch');

    const groq = ProviderFactory.getProvider('groq');
    console.log('✓ groq maps to OpenAIProvider');
    if (!(groq instanceof OpenAIProvider)) throw new Error('groq mismatch');

    const grok = ProviderFactory.getProvider('grok');
    console.log('✓ grok maps to OpenAIProvider');
    if (!(grok instanceof OpenAIProvider)) throw new Error('grok mismatch');

    const openrouter = ProviderFactory.getProvider('openrouter');
    console.log('✓ openrouter maps to OpenAIProvider');
    if (!(openrouter instanceof OpenAIProvider)) throw new Error('openrouter mismatch');

    const gemini = ProviderFactory.getProvider('gemini');
    console.log('✓ gemini maps to GeminiProvider');
    if (!(gemini instanceof GeminiProvider)) throw new Error('gemini mismatch');

    console.log('✓ All factory tests passed successfully!');
  } catch (error: any) {
    console.error('✗ Factory test failed:', error.message);
    process.exit(1);
  }
}

run();

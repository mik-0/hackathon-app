/**
 * Lemonade Server Service - Connects to Lemonade server for LLM processing
 */

export interface LemonadeConfig {
  baseUrl: string;
  apiKey?: string;
  model?: string;
  timeout?: number;
}

export class LemonadeService {
  private config: LemonadeConfig;

  constructor(config: LemonadeConfig) {
    this.config = {
      timeout: 30000,
      model: 'llama2',
      ...config,
    };
  }

  /**
   * Test connection to Lemonade server
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${this.config.baseUrl}/v1/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
        },
        signal: AbortSignal.timeout(this.config.timeout!),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        message: `Connected to Lemonade server. Found ${data.data?.length || 0} models.`,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Analyze text for extremist content
   */
  async analyzeExtremistContent(text: string): Promise<{
    isExtremist: boolean;
    confidence: number;
    reasoning: string;
  }> {
    const prompt = `Analyze the following text for extremist, offensive, or harmful content. Respond with JSON format:
{
  "isExtremist": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

Text to analyze: ${text}`;

    try {
      const response = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 200,
        }),
        signal: AbortSignal.timeout(this.config.timeout!),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || '';

      // Parse JSON response
      try {
        const result = JSON.parse(content);
        return {
          isExtremist: result.isExtremist || false,
          confidence: result.confidence || 0.0,
          reasoning: result.reasoning || 'No reasoning provided',
        };
      } catch (parseError) {
        // Fallback if JSON parsing fails
        const isExtremist = content.toLowerCase().includes('true') || content.toLowerCase().includes('extremist');
        return {
          isExtremist,
          confidence: 0.5,
          reasoning: 'Analysis completed with fallback parsing',
        };
      }
    } catch (error) {
      throw new Error(`Extremist analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Create singleton instance
const lemonadeService = new LemonadeService({
  baseUrl: process.env.LEMONADE_BASE_URL || 'http://localhost:8080',
  apiKey: process.env.LEMONADE_API_KEY,
  model: process.env.LEMONADE_MODEL || 'llama2',
  timeout: parseInt(process.env.LEMONADE_TIMEOUT || '30000'),
});

export default lemonadeService;

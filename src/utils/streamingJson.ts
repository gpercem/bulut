import { Lexer } from "streaming-json";

/**
 * StreamingJsonParser helps extract field values from incomplete JSON streams.
 * Useful for parsing LLM responses that stream JSON token by token.
 */
export class StreamingJsonParser {
  private lexer: Lexer;
  private lastExtractedValue: string = "";

  constructor() {
    this.lexer = new Lexer();
  }

  /**
   * Append a new chunk of JSON text to the parser
   */
  appendChunk(chunk: string): void {
    this.lexer.AppendString(chunk);
  }

  /**
   * Get the current valid JSON, with incomplete parts filled in
   */
  getCompleteJson(): string {
    return this.lexer.CompleteJSON();
  }

  /**
   * Extract a specific field value from the incomplete JSON.
   * Returns the extracted value, or empty string if not available yet.
   * 
   * @param fieldName - The field name to extract (e.g., "reply")
   * @returns The current value of the field, or empty string
   */
  extractField(fieldName: string): string {
    try {
      const completeJson = this.getCompleteJson();
      const parsed = JSON.parse(completeJson);
      
      if (parsed && typeof parsed === "object" && fieldName in parsed) {
        const value = parsed[fieldName];
        if (typeof value === "string") {
          // Only update if we have a real value, not a placeholder null
          if (value !== "" || this.lastExtractedValue === "") {
            this.lastExtractedValue = value;
          }
        }
      }
    } catch {
      // If parsing fails, keep the last successfully extracted value
    }
    
    return this.lastExtractedValue;
  }

  /**
   * Reset the parser for a new JSON stream
   */
  reset(): void {
    this.lexer = new Lexer();
    this.lastExtractedValue = "";
  }
}

/**
 * Extract the "reply" field value from a streaming JSON response.
 * This is a convenience function for the common case of extracting reply text.
 * 
 * @param parser - The StreamingJsonParser instance
 * @returns The current reply text
 */
export const extractReplyText = (parser: StreamingJsonParser): string => {
  return parser.extractField("reply");
};

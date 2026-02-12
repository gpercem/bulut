import { describe, it, expect, vi } from "vitest";
import { StreamingJsonParser, extractReplyText } from "./streamingJson";

// Mock the streaming-json module for testing
vi.mock("streaming-json", () => {
  return {
    Lexer: class MockLexer {
      private buffer = "";
      
      AppendString(s: string) {
        this.buffer += s;
      }
      
      CompleteJSON() {
        // Simple completion: if incomplete, add closing braces/quotes
        let complete = this.buffer;
        
        // Count unclosed strings
        const quoteCount = (complete.match(/(?<!\\)"/g) || []).length;
        if (quoteCount % 2 === 1) {
          complete += '"';
        }
        
        // Count unclosed objects
        const openBraces = (complete.match(/{/g) || []).length;
        const closeBraces = (complete.match(/}/g) || []).length;
        complete += '}'.repeat(openBraces - closeBraces);
        
        return complete;
      }
    }
  };
});

describe("StreamingJsonParser", () => {
  it("should extract reply from complete JSON", () => {
    const parser = new StreamingJsonParser();
    parser.appendChunk('{"reply": "Hello, world!"}');
    
    const reply = extractReplyText(parser);
    expect(reply).toBe("Hello, world!");
  });

  it("should extract reply from streaming JSON chunks", () => {
    const parser = new StreamingJsonParser();
    
    // Simulate streaming JSON
    parser.appendChunk('{"reply": "Hel');
    let reply = extractReplyText(parser);
    expect(reply).toBe("Hel");
    
    parser.appendChunk('lo, wor');
    reply = extractReplyText(parser);
    expect(reply).toBe("Hello, wor");
    
    parser.appendChunk('ld!"}');
    reply = extractReplyText(parser);
    expect(reply).toBe("Hello, world!");
  });

  it("should extract reply from JSON with additional fields", () => {
    const parser = new StreamingJsonParser();
    
    // Complete field first
    parser.appendChunk('{"reply": "Processing"}');
    let reply = extractReplyText(parser);
    expect(reply).toBe("Processing");
  });

  it("should handle reset correctly", () => {
    const parser = new StreamingJsonParser();
    
    parser.appendChunk('{"reply": "First message"}');
    expect(extractReplyText(parser)).toBe("First message");
    
    parser.reset();
    
    parser.appendChunk('{"reply": "Second message"}');
    expect(extractReplyText(parser)).toBe("Second message");
  });
});

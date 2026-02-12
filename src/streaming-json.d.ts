declare module "streaming-json" {
  export class Lexer {
    constructor();
    AppendString(s: string): void;
    CompleteJSON(): string;
  }
}

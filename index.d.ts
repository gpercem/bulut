export type BulutVoice = 'zeynep' | 'ali';

export interface BulutProps {
  /** The project ID for your Bulut instance (required). */
  projectId: string;
  /** Backend API URL. Defaults to `"http://localhost:8000"`. */
  backendBaseUrl?: string;
  /** LLM model identifier. */
  model?: string;
  /** Voice for TTS output. */
  voice?: BulutVoice;
  /** Primary theme colour as hex, e.g. `"#6C03C1"`. */
  baseColor?: string;
}

/**
 * Drop-in React / Next.js chatbot widget.
 *
 * @example
 * ```tsx
 * import { Bulut } from 'bulut';
 *
 * export default function Page() {
 *   return <Bulut projectId="proj_abc123" />;
 * }
 * ```
 */
export declare function Bulut(props: BulutProps): JSX.Element;

export default Bulut;

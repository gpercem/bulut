export interface BulutProps {
  /** The project ID for your Bulut instance (required). */
  projectId: string;
  /** Backend API URL. Defaults to `"https://api.bulut.lu"`. */
  backendBaseUrl?: string;
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

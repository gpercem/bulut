'use client';

import { createElement, useEffect, useRef } from 'react';

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
  /** Agent display name (max 15 chars). */
  agentName?: string;
}

/**
 * `<Bulut>` – drop-in React / Next.js chatbot widget.
 *
 * Renders the Bulut floating chat widget inside a Shadow DOM container
 * so its styles never leak into your application.
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
export function Bulut({
  projectId,
  backendBaseUrl,
  model,
  voice,
  baseColor,
  agentName,
}: BulutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerIdRef = useRef(
    `bulut-${Math.random().toString(36).slice(2, 9)}`,
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const containerId = containerIdRef.current;
    el.id = containerId;

    let destroyed = false;
    let cleanup: (() => void) | undefined;

    // Dynamic import keeps the Preact widget code out of the SSR bundle
    // and avoids `window`/`document` references at import time.
    (async () => {
      const mod = await import('./index');
      if (destroyed) return;

      mod.init({
        containerId,
        projectId,
        backendBaseUrl,
        model,
        voice,
        baseColor,
        agentName,
      });

      cleanup = () => mod.destroy();
    })();

    return () => {
      destroyed = true;
      cleanup?.();
    };
  }, [projectId, backendBaseUrl, model, voice, baseColor, agentName]);

  // Plain createElement – no JSX – so this file stays free of the
  // Preact JSX transform and keeps real React imports.
  return createElement('div', { ref: containerRef });
}

export default Bulut;

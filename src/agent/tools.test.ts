import { describe, expect, it } from 'vitest';
import {
  CURSOR_MOVE_DURATION_MS,
  SCROLL_DURATION_MS,
  computeCenteredScrollTop,
  isRectOutsideViewport,
  parseAgentResponse,
} from './tools';

describe('parseAgentResponse', () => {
  it('parses pure JSON response', () => {
    const raw = JSON.stringify({
      reply: 'Merhaba',
      tool_calls: [{ tool: 'navigate', url: '/dashboard' }],
    });

    const parsed = parseAgentResponse(raw);
    expect(parsed.reply).toBe('Merhaba');
    expect(parsed.toolCalls).toHaveLength(1);
    expect(parsed.toolCalls[0]).toEqual({ tool: 'navigate', url: '/dashboard' });
  });

  it('parses fenced JSON response', () => {
    const raw = [
      'İşte çıktı:',
      '```json',
      '{"reply":"Hazır","tool_calls":[{"tool":"interact","action":"click","selector":"#submit"}]}',
      '```',
    ].join('\n');

    const parsed = parseAgentResponse(raw);
    expect(parsed.reply).toBe('Hazır');
    expect(parsed.toolCalls).toEqual([
      { tool: 'interact', action: 'click', selector: '#submit', text: undefined, x: undefined, y: undefined },
    ]);
  });

  it('parses prose-wrapped JSON object', () => {
    const raw = 'Cevabım aşağıda {"reply":"Tamam","toolCalls":[{"tool":"navigate","url":"?tab=interact"}]} teşekkürler';
    const parsed = parseAgentResponse(raw);
    expect(parsed.reply).toBe('Tamam');
    expect(parsed.toolCalls).toEqual([{ tool: 'navigate', url: '?tab=interact' }]);
  });

  it('falls back to raw text for invalid JSON', () => {
    const raw = 'normal metin ama json değil';
    const parsed = parseAgentResponse(raw);
    expect(parsed.reply).toBe(raw);
    expect(parsed.toolCalls).toEqual([]);
  });

  it('keeps only valid tool entries from mixed list', () => {
    const raw = JSON.stringify({
      reply: 'İşlem',
      tool_calls: [
        { tool: 'interact', action: 'click', selector: '#ok' },
        { tool: 'interact', action: 'invalid', selector: '#x' },
        { tool: 'navigate', url: '/next' },
        { tool: 'navigate' },
        { tool: 'scroll', selector: 'section.features' },
        { tool: 'scroll' },
      ],
    });

    const parsed = parseAgentResponse(raw);
    expect(parsed.toolCalls).toEqual([
      { tool: 'interact', action: 'click', selector: '#ok', text: undefined, x: undefined, y: undefined },
      { tool: 'navigate', url: '/next' },
      { tool: 'scroll', selector: 'section.features' },
    ]);
  });

  it('parses getPageContext tool calls', () => {
    const raw = JSON.stringify({
      reply: 'Sayfa bağlamı alınıyor',
      tool_calls: [{ tool: 'getPageContext' }],
    });

    const parsed = parseAgentResponse(raw);
    expect(parsed.toolCalls).toEqual([{ tool: 'getPageContext' }]);
  });

  it('parses scroll tool calls', () => {
    const raw = JSON.stringify({
      reply: 'Bölüme kaydırıyorum',
      tool_calls: [{ tool: 'scroll', selector: '#pricing' }],
    });

    const parsed = parseAgentResponse(raw);
    expect(parsed.toolCalls).toEqual([{ tool: 'scroll', selector: '#pricing' }]);
  });
});

describe('scroll helpers', () => {
  it('detects elements outside viewport', () => {
    expect(isRectOutsideViewport({ top: -10, bottom: 20 } as DOMRect, 800)).toBe(true);
    expect(isRectOutsideViewport({ top: 10, bottom: 820 } as DOMRect, 800)).toBe(true);
    expect(isRectOutsideViewport({ top: 10, bottom: 300 } as DOMRect, 800)).toBe(false);
  });

  it('computes centered scroll top with clamping', () => {
    const centered = computeCenteredScrollTop(400, 900, 120, 800, 3000);
    expect(centered).toBeGreaterThan(0);

    const clampedTop = computeCenteredScrollTop(0, -300, 120, 800, 3000);
    expect(clampedTop).toBe(0);

    const clampedBottom = computeCenteredScrollTop(2500, 2000, 120, 800, 2600);
    expect(clampedBottom).toBe(2600);
  });

  it('uses 900ms animation durations for cursor and scroll', () => {
    expect(CURSOR_MOVE_DURATION_MS).toBe(900);
    expect(SCROLL_DURATION_MS).toBe(900);
  });
});

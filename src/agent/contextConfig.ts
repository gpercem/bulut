/**
 * Tunable parameters for page context collection.
 *
 * Adjust these values to control how much information the agent receives
 * about the current page.  Lower values reduce token usage (and latency);
 * higher values give the LLM more detail to work with.
 */

/** Maximum number of links to include in the context. */
export const MAX_LINKS = 120;

/** Maximum number of interactable elements to include. */
export const MAX_INTERACTABLES = 2000;

/** Maximum number of headings (h1-h3) to include. */
export const MAX_HEADINGS = 100;

/** Maximum number of main-content text snippets. */
export const MAX_TEXT_SNIPPETS = 30;

/** Maximum number of pages kept in the in-memory context cache. */
export const MAX_CACHED_PAGES = 25;

/** Maximum number of DOM elements scanned per page. */
export const MAX_PAGE_SCAN_ELEMENTS = 10000;

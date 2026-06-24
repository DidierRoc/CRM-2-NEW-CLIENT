import DOMPurify from 'dompurify';

/**
 * Sanitize untrusted HTML before rendering with dangerouslySetInnerHTML.
 * Strips <script>, on*=handlers, javascript: URLs, etc.
 * Used for admin-authored contract templates which are stored in the DB
 * and could otherwise enable stored XSS against other CRM users.
 */
export function sanitizeContractHtml(html: string): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'],
  });
}

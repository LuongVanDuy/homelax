function escapeHtml(value: string, preserveEntities = false) {
  return value
    .replace(preserveEntities ? /&(?!(?:#\d+|#x[\da-f]+|[a-z][\da-z]*);)/gi : /&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function legacyPlainTextToHtml(value: string, preserveEntities = false) {
  return value
    .replace(/\r\n?/g, '\n')
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line, preserveEntities)}</p>`)
    .join('');
}

export function roomDescriptionEditorValue(value: string) {
  const normalized = String(value || '').replace(/\r\n?/g, '\n').trim();
  if (!normalized || /<\/?[a-z][^>]*>/i.test(normalized)) return normalized;
  return legacyPlainTextToHtml(normalized);
}

export function normalizeRoomDescription(value: string) {
  const normalized = String(value || '').replace(/\r\n?/g, '\n').trim();
  if (!normalized) return '';

  if (!/<\/?[a-z][^>]*>/i.test(normalized)) {
    return legacyPlainTextToHtml(normalized);
  }

  return normalized
    .replace(/<p(?:\s[^>]*)?>(?:\s|&nbsp;|<br\b[^>]*>)*<\/p>/gi, '')
    .trim();
}

const ROOM_DESCRIPTION_ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
  'ul', 'ol', 'li', 'blockquote',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
]);

function safeDescriptionHref(value: string) {
  const href = value.trim();
  return /^(https?:|mailto:|tel:|\/|#)/i.test(href) ? href : '';
}

export function roomDescriptionDisplayHtml(value: string) {
  // Public projection strips tags but can retain named HTML entities from the editor.
  // Preserve one encoded layer for the browser; never decode it into executable markup.
  const normalized = String(value || '').replace(/\r\n?/g, '\n').trim();
  const html = /<\/?[a-z][^>]*>/i.test(normalized)
    ? normalized : legacyPlainTextToHtml(normalized, true);
  if (!html) return '';
  if (typeof DOMParser === 'undefined') {
    return legacyPlainTextToHtml(normalized, true);
  }

  const document = new DOMParser().parseFromString(html, 'text/html');
  const elements = [...document.body.querySelectorAll('*')];

  for (const element of elements) {
    const tag = element.tagName.toLowerCase();
    if (!ROOM_DESCRIPTION_ALLOWED_TAGS.has(tag)) {
      if (['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math'].includes(tag)) {
        element.remove();
      } else {
        element.replaceWith(...Array.from(element.childNodes));
      }
      continue;
    }

    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      if (tag === 'a' && name === 'href') {
        const href = safeDescriptionHref(attribute.value);
        if (href) element.setAttribute('href', href);
        else element.removeAttribute(attribute.name);
        continue;
      }
      if (tag === 'a' && name === 'target') {
        if (!['_blank', '_self'].includes(attribute.value)) {
          element.removeAttribute(attribute.name);
        }
        continue;
      }
      if ((tag === 'td' || tag === 'th') && ['colspan', 'rowspan'].includes(name)) {
        continue;
      }
      element.removeAttribute(attribute.name);
    }

    if (tag === 'a' && element.getAttribute('target') === '_blank') {
      element.setAttribute('rel', 'noopener noreferrer');
    }
  }

  return document.body.innerHTML;
}

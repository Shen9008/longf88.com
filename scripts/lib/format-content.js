'use strict';

const { sanitizeEncoding } = require('./sanitize-text.js');

/**
 * Converts inline markdown **bold** to <strong> in HTML/text fragments.
 * Skips segments already inside HTML tags (e.g. attributes).
 * @param {string} html
 * @returns {string}
 */
function convertMarkdownBold(html) {
  if (!html || typeof html !== 'string') return html;

  const cleaned = sanitizeEncoding(html);
  const parts = cleaned.split(/(<[^>]+>)/g);
  return parts
    .map((part) => {
      if (part.startsWith('<')) return part;
      return part.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
    })
    .join('');
}

module.exports = { convertMarkdownBold, sanitizeEncoding };

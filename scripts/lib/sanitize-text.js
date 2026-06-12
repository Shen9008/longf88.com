'use strict';

/**
 * Repairs common mojibake / replacement-character corruption in CMS copy.
 * Typical source: Windows-1252 smart quotes pasted into UTF-8 pipelines.
 * @param {string} input
 * @returns {string}
 */
function sanitizeEncoding(input) {
  if (input == null || typeof input !== 'string' || input === '') return input;

  let s = input;

  // Raw Windows-1252 control bytes sometimes appear in UTF-8 strings.
  s = s
    .replace(/\u0091/g, '\u2018')
    .replace(/\u0092/g, '\u2019')
    .replace(/\u0093/g, '\u201C')
    .replace(/\u0094/g, '\u201D')
    .replace(/\u0096/g, '\u2013')
    .replace(/\u0097/g, '\u2014');

  if (!s.includes('\uFFFD')) {
    return normalizeSmartPunctuation(s);
  }

  // Branded / fixed phrases first.
  s = s.replace(/Touch \uFFFDn Go/g, "Touch 'n Go");
  s = s.replace(/Hold\uFFFDem/gi, "Hold'em");
  s = s.replace(/Gonzo\uFFFDs Quest/gi, "Gonzo's Quest");
  s = s.replace(/Dragon\uFFFDs Fire/gi, "Dragon's Fire");
  s = s.replace(/caf\uFFFD/g, 'caf\u00E9');

  // Quoted phrases: "winning", "Mega Moolah", "https"
  s = s.replace(/\uFFFD([^<\uFFFD]+?)\uFFFD/g, '"$1"');

  // Contractions & possessives: don't, it's, player's, Malaysia's
  s = s.replace(/([a-zA-Z])\uFFFD(t|s|re|ve|ll|d|m|n)\b/g, "$1'$2");

  // Em dash glued to words: account—a, popular—combining
  s = s.replace(/([a-zA-Z])\uFFFD([a-zA-Z])/g, '$1\u2014$2');

  // Em dash with spacing: guides — slots, exploration — players
  s = s.replace(/\s+\uFFFD\s+/g, ' \u2014 ');

  // Lone separator before a word: settings — all
  s = s.replace(/\uFFFD\s+/g, '\u2014 ');

  // Any remaining replacement chars — safest fallback is apostrophe
  s = s.replace(/\uFFFD/g, "'");

  return normalizeSmartPunctuation(s);
}

/** Prefer readable ASCII punctuation in static HTML copy. */
function normalizeSmartPunctuation(text) {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '\u2014');
}

module.exports = { sanitizeEncoding, normalizeSmartPunctuation };

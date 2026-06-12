'use strict';

const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

/** Load .env then .env.local (local overrides). Matches update.md / common local setup. */
function loadEnv() {
  require('dotenv').config({ path: path.join(ROOT, '.env') });
  require('dotenv').config({ path: path.join(ROOT, '.env.local'), override: true });
}

loadEnv();

module.exports = { loadEnv, ROOT };

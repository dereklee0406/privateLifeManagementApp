/**
 * Purpose: Patch @noble/hashes package.json exports to include "./crypto.js".
 * Background: In @noble/hashes v1.x, package.json exports define all modules with .js
 * (e.g. ./utils.js, ./sha2.js, ./pbkdf2.js) but only defines "./crypto" without "./crypto.js".
 * When React Native's Metro bundler resolves imports, it requests "./crypto.js" and emits:
 * "Attempted to import the module .../@noble/hashes/crypto.js which is not listed in exports".
 * This script adds "./crypto.js" to exports, matching @noble/ciphers and eliminating the warning.
 */
const fs = require('fs');
const path = require('path');

function patchNobleHashes(pkgJsonPath) {
  if (!fs.existsSync(pkgJsonPath)) return false;
  try {
    const raw = fs.readFileSync(pkgJsonPath, 'utf8');
    const pkg = JSON.parse(raw);
    if (!pkg.exports || !pkg.exports['./crypto']) return false;
    if (pkg.exports['./crypto.js']) {
      // Already patched
      return true;
    }
    pkg.exports['./crypto.js'] = { ...pkg.exports['./crypto'] };
    fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    console.log(`[patch-noble-hashes] Successfully patched ${pkgJsonPath}`);
    return true;
  } catch (err) {
    console.warn(`[patch-noble-hashes] Failed to patch ${pkgJsonPath}:`, err.message);
    return false;
  }
}

// Search root node_modules and any nested node_modules
const rootPkg = path.join(__dirname, '..', 'node_modules', '@noble', 'hashes', 'package.json');
patchNobleHashes(rootPkg);

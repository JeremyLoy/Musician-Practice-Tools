// @ts-check
/** @import { DictEntry } from './dictionary.js' */
import DICT from './dictionary.js';

/**
 * Normalizes a string by removing diacritics and lowercasing.
 * @param {string} s
 * @returns {string}
 */
export function normStr(s) {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Scores how well a needle matches a haystack string.
 * Returns 0 for no match, 0.5 for character-sequence match, 2+ for substring match.
 * @param {string} haystack - The string to search within.
 * @param {string} needle - The search term.
 * @returns {number} Score from 0 (no match) to ~3 (exact start match).
 */
export function fuzzyScore(haystack, needle) {
    if (haystack.includes(needle)) return 2 + 1 / (haystack.indexOf(needle) + 1);
    let hi = 0;
    for (let i = 0; i < needle.length; i++) {
        const idx = haystack.indexOf(needle[i], hi);
        if (idx === -1) return 0;
        hi = idx + 1;
    }
    return 0.5;
}

/**
 * Renders a single dictionary entry as an HTML string.
 * @param {DictEntry} e
 * @returns {string}
 */
function dictItemHTML(e) {
    return `<div class="dict-item">
            <span class="dict-term">${e.term}</span>
            <span class="dict-lang">${e.lang}</span>
            <span class="dict-def">${e.def}</span>
        </div>`;
}

/**
 * Filters and renders dictionary entries matching the search query.
 * @param {string} query - User search input (may be empty to show all).
 */
function renderDict(query) {
    const q = normStr(query.trim());
    const el = document.getElementById('dictResults');
    if (!q) {
        el.innerHTML = DICT.map(dictItemHTML).join('');
        return;
    }
    const scored = DICT.flatMap(e => {
        const best = Math.max(fuzzyScore(e.normTerm, q) * 3, fuzzyScore(e.normDef, q));
        return best > 0 ? [{ e, score: best }] : [];
    });
    if (!scored.length) {
        el.innerHTML = `<div class="dict-empty">No results for "${query}"</div>`;
        return;
    }
    scored.sort((a, b) => b.score - a.score);
    el.innerHTML = scored.map(({ e }) => dictItemHTML(e)).join('');
}

/** Initializes the dictionary module: wires up search input and renders all entries. */
export function initDict() {
    document.getElementById('dictSearch')?.addEventListener('input', e => renderDict(/** @type {HTMLInputElement} */ (e.target).value));
    renderDict('');
}

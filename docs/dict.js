import DICT from './dictionary.js';

export function normStr(s) {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

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

function dictItemHTML(e) {
    return `<div class="dict-item">
            <span class="dict-term">${e.term}</span>
            <span class="dict-lang">${e.lang}</span>
            <span class="dict-def">${e.def}</span>
        </div>`;
}

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

export function initDict() {
    document.getElementById('dictSearch').addEventListener('input', e => renderDict(e.target.value));
    renderDict('');
}

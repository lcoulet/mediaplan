// UserGuideModal.tsx — Renders docs/user-guide.md (synced to public/guide/)
// inside a modal. The markdown is fetched at open time; captures are
// referenced relative to the guide location.

import { useState, useEffect } from 'react';

interface UserGuideModalProps {
  onClose: () => void;
}

// Minimal markdown renderer for the guide (headings, lists, tables, images,
// bold/italic). The guide is hand-maintained; this renders it readably
// inside the app without a markdown dependency.
function renderMarkdown(md: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s: string) => {
    let out = esc(s);
    // Images and links share the [..](..) syntax: extract images first
    // to placeholders so the link pass cannot rewrite their srcs.
    const imgs: string[] = [];
    out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_all, alt: string, src: string) => {
      imgs.push(`<img class="guide-img" src="${src}" alt="${alt}" title="${alt}">`);
      return `\u0000${imgs.length - 1}\u0000`;
    });
    out = out
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
    // Restore image placeholders
    out = out.replace(/\u0000(\d+)\u0000/g, (_all, i: string) => imgs[Number(i)]);
    return out;
  };

  const lines = md.split('\n');
  const out: string[] = [];
  let inList = false;
  let inTable = false;
  let inCode = false;

  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };
  const closeTable = () => { if (inTable) { out.push('</table>'); inTable = false; } };

  for (const raw of lines) {
    if (raw.trim().startsWith('```')) {
      if (inCode) { out.push('</pre>'); inCode = false; }
      else { closeList(); closeTable(); out.push('<pre>'); inCode = true; }
      continue;
    }
    if (inCode) { out.push(esc(raw)); continue; }

    const line = raw;
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
      closeList(); closeTable();
      out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`);
    } else if ((m = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/))) {
      closeList(); closeTable();
      out.push(`<img class="guide-img" src="${m[2]}" alt="${m[1]}" title="${m[1]}">`);
    } else if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const cells = line.trim().slice(1, -1).split('|').map((c) => c.trim());
      if (cells.every((c) => /^:?-+:?$/.test(c) || c === '')) continue; // separator
      if (!inTable) { closeList(); out.push('<table>'); inTable = true; }
      const tag = cells.length && out.length && !out[out.length - 1].includes('</tr>') ? 'td' : 'td';
      out.push(`<tr>${cells.map((c) => `<${tag}>${inline(c)}</${tag}>`).join('')}</tr>`);
    } else if ((m = line.match(/^\s*-\s+(.*)$/))) {
      closeTable();
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inline(m[1])}</li>`);
    } else if (line.trim() === '') {
      closeList(); closeTable();
    } else if ((m = line.match(/^(-{3,}|\*{3,})$/))) {
      closeList(); closeTable();
      out.push('<hr>');
    } else {
      closeList(); closeTable();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList(); closeTable();
  if (inCode) out.push('</pre>');
  return out.join('\n');
}

export default function UserGuideModal({ onClose }: UserGuideModalProps) {
  const [html, setHtml] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetch('guide/user-guide.md')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      // The guide references captures/ relative to docs/; the app serves
      // them under guide/captures/ — prefix image srcs accordingly.
      .then((md) => setHtml(renderMarkdown(md.replace(/\]\(captures\//g, '](guide/captures/'))))
      .catch((e) => setError(`Impossible de charger la documentation (${e.message}).`));
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content user-guide-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ×
        </button>
        <h2>Documentation utilisateur</h2>
        {error ? (
          <p className="warning-text">{error}</p>
        ) : (
          <div
            className="user-guide-body"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </div>
  );
}

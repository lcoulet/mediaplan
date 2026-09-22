// render-guide.js — minimal markdown renderer for the standalone user
// guide page (public/guide/index.html). Mirrors the in-app UserGuideModal
// renderer: headings, lists, tables, images, bold/italic, code, links.
// The guide references captures/ — served alongside as guide/captures/.

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(s) {
  var out = esc(s);
  var imgs = [];
  out = out.replace(/!\[[^\]]*\]\(([^)]+)\)/g, function (all, src) {
    imgs.push('<img class="guide-img" src="' + src + '">');
    return '\u0000' + (imgs.length - 1) + '\u0000';
  });
  out = out
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  return out.replace(/\u0000(\d+)\u0000/g, function (all, i) {
    return imgs[Number(i)];
  });
}

function renderMarkdown(md) {
  var lines = md.split('\n');
  var out = [];
  var inList = false, inTable = false, inCode = false;
  function closeList() { if (inList) { out.push('</ul>'); inList = false; } }
  function closeTable() { if (inTable) { out.push('</table>'); inTable = false; } }

  lines.forEach(function (raw) {
    var t = raw.trim();
    if (t.indexOf('```') === 0) {
      if (inCode) { out.push('</pre>'); inCode = false; }
      else { closeList(); closeTable(); out.push('<pre>'); inCode = true; }
      return;
    }
    if (inCode) { out.push(esc(raw)); return; }
    var m;
    if ((m = raw.match(/^(#{1,6})\s+(.*)$/))) {
      closeList(); closeTable();
      out.push('<h' + m[1].length + '>' + inline(m[2]) + '</h' + m[1].length + '>');
    } else if (t.charAt(0) === '|' && t.charAt(t.length - 1) === '|') {
      var cells = t.slice(1, -1).split('|').map(function (c) { return c.trim(); });
      var allSep = cells.every(function (c) { return /^:?-+:?$/.test(c) || c === ''; });
      if (allSep) return;
      closeList();
      if (!inTable) { out.push('<table>'); inTable = true; }
      out.push('<tr>' + cells.map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>');
    } else if ((m = raw.match(/^\s*-\s+(.*)$/))) {
      closeTable();
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push('<li>' + inline(m[1]) + '</li>');
    } else if (t === '') {
      closeList(); closeTable();
    } else if (/^(-{3,}|\*{3,})$/.test(t)) {
      closeList(); closeTable();
      out.push('<hr>');
    } else {
      closeList(); closeTable();
      out.push('<p>' + inline(raw) + '</p>');
    }
  });
  closeList(); closeTable();
  if (inCode) out.push('</pre>');
  return out.join('\n');
}

fetch('user-guide.md')
  .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
  .then(function (md) {
    document.getElementById('guide').innerHTML = renderMarkdown(
      md.replace(/\]\(captures\//g, '](captures/')
    );
    var titleMatch = md.match(/^#\s+(.+)$/m);
    if (titleMatch) document.title = titleMatch[1];
  })
  .catch(function (e) {
    document.getElementById('guide').innerHTML =
      '<p class="load-error">Impossible de charger la documentation (' + e.message + ').</p>';
  });

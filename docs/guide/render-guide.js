// render-guide.js — minimal markdown renderer for the standalone user
// guide page (public/guide/index.html). Renders headings (with anchor ids
// for the chapter TOC), lists, tables, images, bold/italic, code, links.
// The guide references captures/ — served alongside as guide/captures/.

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function slug(s) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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
  var usedIds = {};
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
      // Anchor ids on H2 (chapters) so the sidebar TOC can link to them.
      var open = '<h' + m[1].length + '>';
      if (m[1].length === 2) {
        var id = slug(m[2]);
        while (usedIds[id]) { id += '-x'; }
        usedIds[id] = true;
        open = '<h2 id="' + id + '">';
      }
      out.push(open + inline(m[2]) + '</h' + m[1].length + '>');
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

function buildToc(container) {
  var toc = document.getElementById('toc');
  if (!toc) return;
  var heads = container.querySelectorAll('h2[id]');
  if (!heads.length) return;
  var ul = document.createElement('ul');
  heads.forEach(function (h) {
    var li = document.createElement('li');
    var a = document.createElement('a');
    a.href = '#' + h.id;
    a.textContent = h.textContent;
    a.addEventListener('click', function (e) {
      e.preventDefault();
      h.scrollIntoView({ behavior: 'smooth' });
      history.replaceState(null, '', '#' + h.id);
    });
    li.appendChild(a);
    ul.appendChild(li);
  });
  toc.appendChild(ul);
  // Highlight the chapter currently in view while scrolling.
  var links = Array.prototype.slice.call(ul.querySelectorAll('a'));
  var setActive = function (id) {
    links.forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('href') === '#' + id);
    });
  };
  function onScroll() {
    var mark = (window.scrollY || document.documentElement.scrollTop) + window.innerHeight * 0.25;
    var current = heads[0];
    for (var i = 0; i < heads.length; i++) {
      if (heads[i].offsetTop <= mark) current = heads[i];
    }
    if (current) setActive(current.id);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

fetch('user-guide.md')
  .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
  .then(function (md) {
    var guide = document.getElementById('guide');
    guide.innerHTML = renderMarkdown(
      md.replace(/]\(captures\//g, '](captures/')
    );
    buildToc(guide);
    var titleMatch = md.match(/^#\s+(.+)$/m);
    if (titleMatch) document.title = titleMatch[1];
  })
  .catch(function (e) {
    document.getElementById('guide').innerHTML =
      '<p class="load-error">Impossible de charger la documentation (' + e.message + ').</p>';
  });

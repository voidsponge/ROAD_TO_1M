/* Widget d'audit embarquable. Usage :
   <script src="https://VOTRE-DOMAINE/static/widget.js" data-key="CLE" async></script>
   Options : data-title, data-button, data-color */
(function () {
  var script = document.currentScript;
  if (!script) return;
  var key = script.getAttribute('data-key');
  var origin = new URL(script.src).origin;
  var color = /^#[0-9a-f]{6}$/i.test(script.getAttribute('data-color') || '') ? script.getAttribute('data-color') : '#1d4ed8';
  var title = script.getAttribute('data-title') || 'Votre site est-il en règle ?';
  var button = script.getAttribute('data-button') || 'Tester mon site gratuitement';

  var host = document.createElement('div');
  script.parentNode.insertBefore(host, script);
  var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
  var css = document.createElement('style');
  css.textContent = ':host{all:initial}' +
    '.w{font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f172a;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;max-width:520px;box-sizing:border-box}' +
    '.w *{box-sizing:border-box}h2{font-size:1.2rem;margin:0 0 6px}p{margin:6px 0;color:#475569;font-size:.92rem}' +
    'label{display:block;font-weight:600;margin:12px 0 4px;font-size:.92rem}' +
    'input{width:100%;font:inherit;padding:10px 12px;border:2px solid #94a3b8;border-radius:8px}' +
    'button,a.b{display:inline-block;margin-top:14px;background:' + color + ';color:#fff;border:0;border-radius:8px;padding:11px 18px;font:inherit;font-weight:600;cursor:pointer;text-decoration:none}' +
    'button[disabled]{opacity:.6;cursor:wait}.err{color:#b91c1c}.score{font-size:2rem;font-weight:800;color:#0f172a}' +
    ':focus-visible{outline:3px solid #f59e0b;outline-offset:2px}';
  root.appendChild(css);
  var box = document.createElement('div');
  box.className = 'w';
  root.appendChild(box);

  function el(tag, props, children) {
    var n = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) { if (k === 'text') n.textContent = props[k]; else n.setAttribute(k, props[k]); });
    (children || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }
  var status = el('p', { role: 'status', 'aria-live': 'polite' });
  var urlInput = el('input', { id: 'aw-url', type: 'text', inputmode: 'url', required: '', placeholder: 'votre-site.fr', autocomplete: 'url' });
  var mailInput = el('input', { id: 'aw-mail', type: 'email', required: '', placeholder: 'vous@exemple.fr', autocomplete: 'email' });
  var submit = el('button', { type: 'submit', text: button });
  var form = el('form', {}, [
    el('h2', { text: title }),
    el('p', { text: 'Cookies et RGPD, accessibilité, mentions légales, sécurité : votre rapport en 30 secondes.' }),
    el('label', { for: 'aw-url', text: 'Adresse de votre site' }), urlInput,
    el('label', { for: 'aw-mail', text: 'Votre e-mail' }), mailInput,
    el('p', { text: 'Votre e-mail sert uniquement à vous recontacter au sujet de ce rapport.' }),
    submit, status,
  ]);
  box.appendChild(form);

  function fail(msg) { status.className = 'err'; status.textContent = msg; submit.disabled = false; }
  function poll(data, tries) {
    fetch(data.statusUrl, { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
      if (d.status === 'done') {
        box.textContent = '';
        box.appendChild(el('h2', { text: 'Votre rapport est prêt' }));
        box.appendChild(el('p', { class: 'score', text: d.score + ' / 100' }));
        box.appendChild(el('a', { class: 'b', href: data.reportUrl, target: '_blank', rel: 'noopener', text: 'Voir le rapport détaillé' }));
      } else if (d.status === 'error') fail(d.error || 'Audit impossible pour ce site.');
      else if (tries > 60) fail('L’audit prend plus de temps que prévu. Réessayez plus tard.');
      else setTimeout(function () { poll(data, tries + 1); }, 2500);
    }).catch(function () { setTimeout(function () { poll(data, tries + 1); }, 5000); });
  }
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    submit.disabled = true;
    status.className = '';
    status.textContent = 'Analyse en cours… environ 30 secondes.';
    fetch(origin + '/api/widget/' + encodeURIComponent(key) + '/audit', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: urlInput.value, email: mailInput.value }),
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) { if (!res.ok) fail(res.d.error || 'Erreur.'); else poll(res.d, 0); })
      .catch(function () { fail('Connexion impossible. Réessayez.'); });
  });
})();

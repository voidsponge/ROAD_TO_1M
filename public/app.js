// Script du site : aucune dépendance, aucun traceur.
(function () {
  // Attente du résultat d'un audit
  var waiting = document.querySelector('[data-poll]');
  if (waiting) {
    var tick = function () {
      fetch(waiting.getAttribute('data-poll'), { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (d) { if (d.status === 'done' || d.status === 'error') location.reload(); else setTimeout(tick, 2500); })
        .catch(function () { setTimeout(tick, 5000); });
    };
    setTimeout(tick, 2500);
  }
  // Logo -> data URL
  var file = document.querySelector('[data-logo-target]');
  if (file) {
    file.addEventListener('change', function () {
      var target = document.querySelector(file.getAttribute('data-logo-target'));
      var f = file.files[0];
      target.value = '';
      if (!f) return;
      if (f.size > 150 * 1024) { alert('Logo trop lourd : 150 Ko maximum.'); file.value = ''; return; }
      var reader = new FileReader();
      reader.onload = function () { target.value = reader.result; };
      reader.readAsDataURL(f);
    });
  }
  // Copier un extrait de code
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var el = document.querySelector(btn.getAttribute('data-copy'));
      el.select();
      (navigator.clipboard ? navigator.clipboard.writeText(el.value) : Promise.reject()).catch(function () { document.execCommand('copy'); });
      btn.textContent = 'Copié ✓';
    });
  });
  // Confirmation avant action irréversible
  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (ev) { if (!confirm(form.getAttribute('data-confirm'))) ev.preventDefault(); });
  });
})();

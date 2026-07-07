function sitePathPrefix() {
  return document.body.dataset.base || '';
}

async function loadNav() {
  const placeholder = document.getElementById('nav-placeholder');
  if (!placeholder) return;

  const base = sitePathPrefix();
  const res = await fetch(`${base}partials/nav.html`);
  placeholder.innerHTML = await res.text();

  if (base) {
    placeholder.querySelectorAll('a[href]').forEach((link) => {
      link.setAttribute('href', base + link.getAttribute('href'));
    });
  }

  const currentPage = document.body.dataset.page;
  const activeLink = placeholder.querySelector(`a[data-page="${currentPage}"]`);
  if (activeLink) activeLink.classList.add('active');
}

loadNav();

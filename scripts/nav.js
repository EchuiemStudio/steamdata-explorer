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
  // CSS.escape guards against feed.html setting data-page from a raw, unsanitized
  // ?section= URL value — a quote character in it would otherwise break this selector.
  const activeLink = currentPage
    ? placeholder.querySelector(`a[data-page="${CSS.escape(currentPage)}"]`)
    : null;
  if (activeLink) {
    activeLink.classList.add('active');
    // Inside a grouped dropdown (.nav-group), the summary label itself needs the
    // active treatment too, or landing on e.g. Browse gives no indication that
    // "Steam Game Data" is the group you're in.
    const parentGroup = activeLink.closest('.nav-group');
    if (parentGroup) parentGroup.querySelector('summary').classList.add('active');
  }
}

// <details> has no native "close when you click elsewhere" behavior — without this,
// a dropdown opened once stays open until its own summary is clicked again.
function closeNavGroupsOnOutsideClick() {
  document.addEventListener('click', (event) => {
    document.querySelectorAll('.nav-group[open]').forEach((details) => {
      if (!details.contains(event.target)) details.removeAttribute('open');
    });
  });
}

loadNav();
closeNavGroupsOnOutsideClick();

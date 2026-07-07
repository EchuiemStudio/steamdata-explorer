function navigateToSteamGame(appid) {
  const link = document.createElement('a');
  link.href = steamStoreURL(appid);
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.click();
}

function gameClickHandler(getGameAt) {
  return (event, elements) => {
    if (!elements.length) return;
    const game = getGameAt(elements[0].index);
    if (game) navigateToSteamGame(game.appid);
  };
}

// Single reused <dialog> for "expand chart" — created lazily on first use.
// Destroying/recreating the Chart.js instance on each open (and on close)
// avoids the "canvas is already in use" error from reusing a stale instance.
function openChartModal(title, chartConfigFactory, { scrollHeight } = {}) {
  let dialog = document.querySelector('.chart-modal');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.className = 'chart-modal';
    dialog.innerHTML = `
      <div class="chart-modal__inner">
        <div class="chart-modal__header">
          <h3 class="chart-modal__title"></h3>
          <button type="button" class="chart-modal__close" aria-label="Close">&times;</button>
        </div>
        <div class="chart-modal__body">
          <div class="chart-modal__scroll"><canvas class="chart-modal__canvas"></canvas></div>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);
    dialog.querySelector('.chart-modal__close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close(); // click landed on <dialog> itself = backdrop
    });
    dialog.addEventListener('close', () => {
      if (dialog._chart) {
        dialog._chart.destroy();
        dialog._chart = null;
      }
    });
  }

  dialog.querySelector('.chart-modal__title').textContent = title;
  // A tall inner scroll wrapper (rather than resizing the dialog itself) lets a
  // 100-row chart scroll inside a fixed-size modal instead of overflowing the viewport.
  dialog.querySelector('.chart-modal__scroll').style.height = scrollHeight ? `${scrollHeight}px` : '100%';
  if (dialog._chart) {
    dialog._chart.destroy();
    dialog._chart = null;
  }
  dialog.showModal();
  dialog._chart = new Chart(dialog.querySelector('.chart-modal__canvas'), chartConfigFactory());
}

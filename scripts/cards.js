function formatPrice(price) {
  if (price == null) return '—';
  return price === 0 ? 'Free' : `$${price.toFixed(2)}`;
}

function formatReviewSummary(game) {
  if (game.review_score_percent == null) return 'No reviews yet';
  return `${game.review_score_percent}% positive &middot; ${game.review_total.toLocaleString()} reviews`;
}

function steamStoreURL(appid) {
  return `https://store.steampowered.com/app/${appid}/`;
}

function gameCardHTML(game) {
  return `
    <a class="game-card" data-appid="${game.appid}" href="${steamStoreURL(game.appid)}" target="_blank" rel="noopener noreferrer">
      <img class="game-card__image" src="${game.header_image}" alt="${escapeHTML(game.name)}" loading="lazy">
      <div class="game-card__body">
        <h3 class="game-card__title">${escapeHTML(game.name)}</h3>
        <div class="game-card__meta">
          <span class="tier-badge tier-badge--${game.performance_tier}">${game.performance_tier}</span>
          <span class="game-card__price">${formatPrice(game.price_usd)}</span>
        </div>
        <div class="game-card__review">
          ${formatReviewSummary(game)}
        </div>
        <div class="game-card__genres">${escapeHTML(game.genres.join(', '))}</div>
        <div class="game-card__steam-link">View on Steam &#8599;</div>
      </div>
    </a>
  `;
}

function renderGameGrid(container, games) {
  if (games.length === 0) {
    container.innerHTML = '<p class="empty-state">No games match this filter.</p>';
    return;
  }

  const existing = new Map();
  container.querySelectorAll('.game-card').forEach((el) => existing.set(Number(el.dataset.appid), el));

  const frag = document.createDocumentFragment();
  for (const game of games) {
    let card = existing.get(game.appid);
    if (card) {
      existing.delete(game.appid);
    } else {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = gameCardHTML(game);
      card = wrapper.firstElementChild;
    }
    frag.appendChild(card);
  }
  container.replaceChildren(frag);
}

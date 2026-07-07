const PRICE_BUCKETS = [
  { label: 'Free', min: 0, max: 0 },
  { label: '$0.01–5', min: 0.01, max: 5 },
  { label: '$5–10', min: 5.01, max: 10 },
  { label: '$10–15', min: 10.01, max: 15 },
  { label: '$15–30', min: 15.01, max: 30 },
  { label: '$30–50', min: 30.01, max: 50 },
  { label: '$50+', min: 50.01, max: Infinity },
];
// Sequential scale: one hue (brass, matches the accent), dim -> vivid so both ends
// stay visible against a dark chart background (a light->dark scale like the old
// light-theme one would fade into the background at its dark end here).
const PRICE_ORDINAL_SCALE = ['#3d2f14', '#59431a', '#7a5c22', '#9c7629', '#bd9433', '#dab659', '#f0d896'];

function bucketFor(price) {
  return PRICE_BUCKETS.find((b) => price >= b.min && price <= b.max) || PRICE_BUCKETS[PRICE_BUCKETS.length - 1];
}

function createPriceBucketChart({ container, onBucketClick }) {
  let chart = null;
  let currentBucketGames = [];

  return {
    update(games) {
      const pricedGames = games.filter((g) => g.price_usd != null);
      const bucketGames = PRICE_BUCKETS.map((b) => pricedGames.filter((g) => bucketFor(g.price_usd) === b));
      currentBucketGames = bucketGames;
      const counts = bucketGames.map((gs) => gs.length);

      if (chart) {
        chart.data.datasets[0].data = counts;
        chart.update();
        return;
      }

      chart = new Chart(container, {
        type: 'bar',
        data: {
          labels: PRICE_BUCKETS.map((b) => b.label),
          datasets: [{ data: counts, backgroundColor: PRICE_ORDINAL_SCALE, borderRadius: 4 }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          onClick: (event, elements) => {
            if (!elements.length || !onBucketClick) return;
            const idx = elements[0].index;
            onBucketClick(PRICE_BUCKETS[idx].label, currentBucketGames[idx]);
          },
          plugins: {
            legend: { display: false },
            title: { display: true, text: 'Games by price bucket', color: VIZ_TEXT, font: { size: 13, weight: '600' } },
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: VIZ_MUTED } },
            y: { grid: { color: VIZ_GRID }, ticks: { color: VIZ_MUTED, precision: 0 }, beginAtZero: true },
          },
        },
      });
    },
  };
}

const TAG_FREQUENCY_MIN_OCCURRENCES = 3; // avoid noise from tags that appear on only 1-2 games

function createTagFrequencyChart({ container }) {
  let chart = null;
  return {
    update(games) {
      const hitGames = games.filter((g) => g.performance_tier === 'hit');
      const nicheGames = games.filter((g) => g.performance_tier === 'niche');
      const tagCounts = {};
      games.forEach((g) => g.tags.forEach((t) => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));

      const deltas = Object.keys(tagCounts)
        .filter((t) => tagCounts[t] >= TAG_FREQUENCY_MIN_OCCURRENCES)
        .map((tag) => {
          const hitRate = hitGames.length ? hitGames.filter((g) => g.tags.includes(tag)).length / hitGames.length : 0;
          const nicheRate = nicheGames.length ? nicheGames.filter((g) => g.tags.includes(tag)).length / nicheGames.length : 0;
          return { tag, delta: Math.round((hitRate - nicheRate) * 1000) / 10 };
        })
        .sort((a, b) => b.delta - a.delta);

      const top = deltas.slice(0, 10);
      const bottom = deltas.slice(-10).filter((d) => !top.some((t) => t.tag === d.tag));
      const shown = [...top, ...bottom];

      const labels = shown.map((d) => d.tag);
      const values = shown.map((d) => d.delta);
      const colors = values.map((v) => (v >= 0 ? VIZ_PRIMARY : VIZ_DIVERGING_NEGATIVE));

      if (chart) {
        chart.data.labels = labels;
        chart.data.datasets[0].data = values;
        chart.data.datasets[0].backgroundColor = colors;
        chart.update();
        return;
      }

      chart = new Chart(container, {
        type: 'bar',
        data: { labels, datasets: [{ data: values, backgroundColor: colors, borderRadius: 4 }] },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: {
              display: true,
              text: 'Tags skewing toward hits (gold) vs. niche (red)',
              color: VIZ_TEXT,
              font: { size: 13, weight: '600' },
            },
            tooltip: {
              callbacks: {
                label: (item) => `${item.parsed.x > 0 ? '+' : ''}${item.parsed.x}pp hit-rate vs. niche-rate`,
              },
            },
          },
          scales: {
            x: {
              grid: { color: VIZ_GRID },
              ticks: { color: VIZ_MUTED, callback: (v) => `${v}%` },
            },
            y: { grid: { display: false }, ticks: { color: VIZ_TEXT, font: { size: 11 } } },
          },
        },
      });
    },
  };
}

const REVIEW_KEYWORD_MIN_OCCURRENCES = 8; // needs to show up in at least this many reviews to count — avoids noise from one review's odd vocabulary

function createReviewKeywordChart({ container }) {
  let chart = null;
  return {
    update(games) {
      const positiveCounts = {};
      const negativeCounts = {};
      let positiveTotal = 0;
      let negativeTotal = 0;

      for (const g of games) {
        for (const review of g.sample_reviews || []) { // tolerate a null/missing field rather than throwing mid-render
          const words = new Set(extractReviewWords(review.text)); // count each word once per review, not per raw occurrence
          if (review.voted_up) {
            positiveTotal++;
            for (const w of words) positiveCounts[w] = (positiveCounts[w] || 0) + 1;
          } else {
            negativeTotal++;
            for (const w of words) negativeCounts[w] = (negativeCounts[w] || 0) + 1;
          }
        }
      }

      const allWords = new Set([...Object.keys(positiveCounts), ...Object.keys(negativeCounts)]);
      const deltas = [...allWords]
        .filter((w) => (positiveCounts[w] || 0) + (negativeCounts[w] || 0) >= REVIEW_KEYWORD_MIN_OCCURRENCES)
        .map((word) => {
          const posRate = positiveTotal ? (positiveCounts[word] || 0) / positiveTotal : 0;
          const negRate = negativeTotal ? (negativeCounts[word] || 0) / negativeTotal : 0;
          return { word, delta: Math.round((posRate - negRate) * 1000) / 10 };
        })
        .sort((a, b) => b.delta - a.delta);

      const top = deltas.slice(0, 10);
      const bottom = deltas.slice(-10).filter((d) => !top.some((t) => t.word === d.word));
      const shown = [...top, ...bottom];

      const labels = shown.map((d) => d.word);
      const values = shown.map((d) => d.delta);
      const colors = values.map((v) => (v >= 0 ? VIZ_PRIMARY : VIZ_DIVERGING_NEGATIVE));

      if (chart) {
        chart.data.labels = labels;
        chart.data.datasets[0].data = values;
        chart.data.datasets[0].backgroundColor = colors;
        chart.update();
        return;
      }

      chart = new Chart(container, {
        type: 'bar',
        data: { labels, datasets: [{ data: values, backgroundColor: colors, borderRadius: 4 }] },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: {
              display: true,
              text: 'Review words skewing positive (gold) vs. negative (red)',
              color: VIZ_TEXT,
              font: { size: 13, weight: '600' },
            },
            tooltip: {
              callbacks: {
                label: (item) => `${item.parsed.x > 0 ? '+' : ''}${item.parsed.x}pp positive-rate vs. negative-rate`,
              },
            },
          },
          scales: {
            x: {
              grid: { color: VIZ_GRID },
              ticks: { color: VIZ_MUTED, callback: (v) => `${v}%` },
            },
            y: { grid: { display: false }, ticks: { color: VIZ_TEXT, font: { size: 11 } } },
          },
        },
      });
    },
  };
}

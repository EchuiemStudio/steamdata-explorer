const TIER_SCATTER_COLORS = { hit: '#34d399', mid: '#fbbf24', niche: '#94a3b8' }; // matches --tier-hit/mid/niche badges

function boxesOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function pointLabelPlugin(getLabelIdxs) {
  return {
    id: 'pointLabels',
    afterDatasetsDraw(chart) {
      const idxs = getLabelIdxs();
      if (!idxs.length) return;
      const { ctx, chartArea } = chart;
      const meta = chart.getDatasetMeta(0);
      const points = chart.data.datasets[0].data;
      const LINE_HEIGHT = 13;
      ctx.save();
      ctx.font = '11px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = VIZ_TEXT;

      const placedBoxes = [];
      idxs.forEach((idx) => {
        const el = meta.data[idx];
        const p = points[idx];
        if (!el || !p) return;
        const textWidth = ctx.measureText(p.name).width;
        // flip to the left of the point if it would overflow the chart's right edge
        const fitsOnRight = el.x + 7 + textWidth <= chartArea.right;
        const textAlign = fitsOnRight ? 'left' : 'right';
        const x = fitsOnRight ? el.x + 7 : el.x - 7;

        // Nudge down past any already-placed label this one would overlap —
        // only 2-3 labels ever coexist, so a full layout solver would be overkill.
        let y = el.y - 6;
        for (let attempt = 0; attempt < 6; attempt++) {
          const box = {
            left: fitsOnRight ? x : x - textWidth,
            right: fitsOnRight ? x + textWidth : x,
            top: y - LINE_HEIGHT,
            bottom: y,
          };
          const collision = placedBoxes.some((b) => boxesOverlap(box, b));
          if (!collision) {
            placedBoxes.push(box);
            break;
          }
          y += LINE_HEIGHT;
        }

        ctx.textAlign = textAlign;
        ctx.fillText(p.name, x, y);
      });
      ctx.restore();
    },
  };
}

// data/games.json is stored contiguously grouped by performance_tier (all "hit" games
// first, then "mid", then "niche"), an artifact of how the sampling script built it.
// Chart.js animates points by array index (old[i] -> new[i]) on update(), so isolating
// "hit" — already a contiguous prefix of the unfiltered array — produces an identical
// index-for-index mapping and animates nothing; isolating "mid"/"niche" shifts every
// game to a different index and animates a big, inconsistent-looking "rescatter". A
// fresh shuffle on every update() makes index alignment collide by chance rather than
// by data ordering, so all three tiers behave the same way.
function shufflePoints(points) {
  const copy = [...points];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickScatterOutliers(points) {
  if (points.length === 0) return [];
  let highestY = 0;
  let highestX = 0;
  let bestValue = points[0].x > 0 ? 0 : -1;
  for (let i = 1; i < points.length; i++) {
    if (points[i].y > points[highestY].y) highestY = i;
    if (points[i].x > points[highestX].x) highestX = i;
    if (points[i].x > 0) {
      const ratio = points[i].y / points[i].x;
      const bestRatio = bestValue >= 0 ? points[bestValue].y / points[bestValue].x : -Infinity;
      if (ratio > bestRatio) bestValue = i;
    }
  }
  return [...new Set([highestY, highestX, bestValue].filter((i) => i >= 0))];
}

function createScatterChart({
  container, titleText, xLabel, yLabel, xKey, xType, tooltipX, xBeginAtZero, xTicksCallback, xMin, xMax,
  yKey = 'review_score_percent', yType = 'linear', yMin, yMax, tooltipY,
}) {
  let chart = null;
  let currentLabelIdxs = [];
  let currentPoints = [];
  const beginAtZero = xBeginAtZero != null ? xBeginAtZero : xType !== 'logarithmic';
  const formatY = tooltipY || ((y) => `${y}% positive`);

  return {
    update(games) {
      const scored = games.filter((g) => g[yKey] != null && g[xKey] != null);
      const points = shufflePoints(scored.map((g) => ({
        x: g[xKey],
        y: g[yKey],
        name: g.name,
        tier: g.performance_tier,
        appid: g.appid,
      })));
      currentPoints = points;
      currentLabelIdxs = pickScatterOutliers(points);

      if (chart) {
        chart.data.datasets[0].data = points;
        chart.update();
        return;
      }

      chart = new Chart(container, {
        type: 'scatter',
        data: {
          datasets: [{
            data: points,
            backgroundColor: (ctx) => TIER_SCATTER_COLORS[ctx.raw?.tier] || VIZ_PRIMARY,
            borderColor: VIZ_SURFACE,
            borderWidth: 1,
            radius: 5,
            hoverRadius: 7,
          }],
        },
        plugins: [pointLabelPlugin(() => currentLabelIdxs)],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          onClick: gameClickHandler((idx) => currentPoints[idx]),
          plugins: {
            legend: { display: false },
            title: { display: true, text: titleText, color: VIZ_TEXT, font: { size: 13, weight: '600' } },
            tooltip: {
              callbacks: {
                label: (item) => [item.raw.name, `${tooltipX(item.raw.x)} · ${formatY(item.raw.y)} · ${item.raw.tier}`],
              },
            },
          },
          scales: {
            x: {
              type: xType || 'linear',
              title: { display: true, text: xLabel, color: VIZ_MUTED },
              grid: { color: VIZ_GRID },
              ticks: xTicksCallback ? { color: VIZ_MUTED, callback: xTicksCallback } : { color: VIZ_MUTED },
              beginAtZero,
              // Fixed once at chart creation from the FULL unfiltered dataset (not the
              // currently-filtered one) so the axis range never shifts as filters change —
              // update() below only ever replaces the plotted points, never these options,
              // so whatever min/max is passed in here stays fixed for the chart's lifetime.
              ...(xMin != null ? { min: xMin } : {}),
              ...(xMax != null ? { max: xMax } : {}),
            },
            y: {
              type: yType,
              title: { display: true, text: yLabel, color: VIZ_MUTED },
              grid: { color: VIZ_GRID },
              ticks: { color: VIZ_MUTED },
              ...(yMin != null ? { min: yMin } : {}),
              ...(yMax != null ? { max: yMax } : {}),
            },
          },
        },
      });
    },
  };
}

function createPriceScoreScatter({ container, xMin, xMax }) {
  return createScatterChart({
    container,
    titleText: 'Price vs. review score',
    xLabel: 'Price (USD)',
    yLabel: 'Review score %',
    xKey: 'price_usd',
    xType: 'linear',
    xMin,
    xMax,
    tooltipX: (x) => (x === 0 ? 'Free' : `$${x.toFixed(2)}`),
    yKey: 'review_score_percent',
    yMin: 0,
    yMax: 100,
    tooltipY: (y) => `${y}% positive`,
  });
}

function createReviewCountScoreScatter({ container, xMin, xMax }) {
  return createScatterChart({
    container,
    titleText: 'Popularity vs. review score (log scale)',
    xLabel: 'Total reviews (log scale)',
    yLabel: 'Review score %',
    xKey: 'review_total',
    xType: 'logarithmic',
    xMin,
    xMax,
    tooltipX: (x) => `${x.toLocaleString()} reviews`,
    yKey: 'review_score_percent',
    yMin: 0,
    yMax: 100,
    tooltipY: (y) => `${y}% positive`,
  });
}

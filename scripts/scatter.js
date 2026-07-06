const TIER_SCATTER_COLORS = { hit: '#1f9d55', mid: '#b8791a', niche: '#6b6b72' }; // matches --tier-hit/mid/niche badges

function pointLabelPlugin(getLabelIdxs) {
  return {
    id: 'pointLabels',
    afterDatasetsDraw(chart) {
      const idxs = getLabelIdxs();
      if (!idxs.length) return;
      const { ctx, chartArea } = chart;
      const meta = chart.getDatasetMeta(0);
      const points = chart.data.datasets[0].data;
      ctx.save();
      ctx.font = '11px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = VIZ_TEXT;
      idxs.forEach((idx) => {
        const el = meta.data[idx];
        const p = points[idx];
        if (!el || !p) return;
        const textWidth = ctx.measureText(p.name).width;
        // flip to the left of the point if it would overflow the chart's right edge
        const fitsOnRight = el.x + 7 + textWidth <= chartArea.right;
        ctx.textAlign = fitsOnRight ? 'left' : 'right';
        const x = fitsOnRight ? el.x + 7 : el.x - 7;
        ctx.fillText(p.name, x, el.y - 6);
      });
      ctx.restore();
    },
  };
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

function createScatterChart({ container, titleText, xLabel, yLabel, xKey, xType, tooltipX }) {
  let chart = null;
  let currentLabelIdxs = [];

  return {
    update(games) {
      const scored = games.filter((g) => g.review_score_percent != null && g[xKey] != null);
      const points = scored.map((g) => ({
        x: g[xKey],
        y: g.review_score_percent,
        name: g.name,
        tier: g.performance_tier,
      }));
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
          plugins: {
            legend: { display: false },
            title: { display: true, text: titleText, color: VIZ_TEXT, font: { size: 13, weight: '600' } },
            tooltip: {
              callbacks: {
                label: (item) => [item.raw.name, `${tooltipX(item.raw.x)} · ${item.raw.y}% positive`],
              },
            },
          },
          scales: {
            x: {
              type: xType || 'linear',
              title: { display: true, text: xLabel, color: VIZ_MUTED },
              grid: { color: VIZ_GRID },
              ticks: { color: VIZ_MUTED },
              beginAtZero: xType !== 'logarithmic',
            },
            y: {
              title: { display: true, text: yLabel, color: VIZ_MUTED },
              grid: { color: VIZ_GRID },
              ticks: { color: VIZ_MUTED },
              min: 0,
              max: 100,
            },
          },
        },
      });
    },
  };
}

function createPriceScoreScatter({ container }) {
  return createScatterChart({
    container,
    titleText: 'Price vs. review score',
    xLabel: 'Price (USD)',
    yLabel: 'Review score %',
    xKey: 'price_usd',
    xType: 'linear',
    tooltipX: (x) => (x === 0 ? 'Free' : `$${x.toFixed(2)}`),
  });
}

function createReviewCountScoreScatter({ container }) {
  return createScatterChart({
    container,
    titleText: 'Popularity vs. review score (log scale)',
    xLabel: 'Total reviews (log scale)',
    yLabel: 'Review score %',
    xKey: 'review_total',
    xType: 'logarithmic',
    tooltipX: (x) => `${x.toLocaleString()} reviews`,
  });
}

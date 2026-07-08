const TIER_SCATTER_COLORS = { hit: '#5b9dd9', mid: '#c99a56', niche: '#c9754a' }; // matches --tier-hit/mid/niche badges
const SCATTER_POINT_RADIUS = 6;
const SCATTER_POINT_HOVER_RADIUS = 9;

function boxesOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

// Soft emissive halo behind each point, matching the brass/graphite theme's glow motif
// elsewhere (--shadow-glow, the metallic text sheen). Reads el.options.radius rather than
// a fixed size so the glow shrinks/grows in lockstep with the point during the filter
// transition below — when a point's radius animates to 0 its glow fades out with it.
// Dim at rest, brightens on hover (chart.getActiveElements() drives which point that is —
// same interaction Chart.js already uses internally for hoverRadius/tooltips).
function pointGlowPlugin() {
  return {
    id: 'pointGlow',
    beforeDatasetsDraw(chart) {
      const meta = chart.getDatasetMeta(0);
      const points = chart.data.datasets[0].data;
      const { ctx } = chart;
      const activeIdxs = new Set(chart.getActiveElements().map((active) => active.index));
      ctx.save();
      meta.data.forEach((el, i) => {
        const r = el.options?.radius;
        if (!r) return;
        const color = TIER_SCATTER_COLORS[points[i]?.tier] || VIZ_PRIMARY;
        const alpha = activeIdxs.has(i) ? '4d' : '1a';
        const gradient = ctx.createRadialGradient(el.x, el.y, 0, el.x, el.y, r * 2.6);
        gradient.addColorStop(0, `${color}${alpha}`);
        gradient.addColorStop(1, `${color}00`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(el.x, el.y, r * 2.6, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    },
  };
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

function pickScatterOutliers(indexedPoints) {
  if (indexedPoints.length === 0) return [];
  let highestY = 0;
  let highestX = 0;
  let bestValue = indexedPoints[0].point.x > 0 ? 0 : -1;
  for (let i = 1; i < indexedPoints.length; i++) {
    if (indexedPoints[i].point.y > indexedPoints[highestY].point.y) highestY = i;
    if (indexedPoints[i].point.x > indexedPoints[highestX].point.x) highestX = i;
    if (indexedPoints[i].point.x > 0) {
      const ratio = indexedPoints[i].point.y / indexedPoints[i].point.x;
      const bestRatio = bestValue >= 0
        ? indexedPoints[bestValue].point.y / indexedPoints[bestValue].point.x
        : -Infinity;
      if (ratio > bestRatio) bestValue = i;
    }
  }
  return [...new Set([highestY, highestX, bestValue].filter((i) => i >= 0))].map((i) => indexedPoints[i].index);
}

function createScatterChart({
  container, titleText, xLabel, yLabel, xKey, xType, tooltipX, xBeginAtZero, xTicksCallback, xMin, xMax,
  yKey = 'review_score_percent', yType = 'linear', yMin, yMax, tooltipY, yTicksCallback,
}) {
  let chart = null;
  let currentLabelIdxs = [];
  // Points live at a stable, append-only index keyed by appid — filtering never removes
  // or reorders them, it only flips __visible and re-targets radius to 0/full. That way
  // Chart.js's own animation only has to interpolate the points that are actually
  // entering or leaving; a point present before and after a filter change keeps the same
  // index/x/y/radius throughout and never re-animates ("respawns").
  const orderedPoints = [];
  const pointIndexByAppId = new Map();
  const beginAtZero = xBeginAtZero != null ? xBeginAtZero : xType !== 'logarithmic';
  const formatY = tooltipY || ((y) => `${y}% positive`);

  return {
    update(games) {
      const scored = games.filter((g) => g[yKey] != null && g[xKey] != null);
      const wantedIds = new Set(scored.map((g) => g.appid));

      scored.forEach((g) => {
        if (!pointIndexByAppId.has(g.appid)) {
          pointIndexByAppId.set(g.appid, orderedPoints.length);
          orderedPoints.push({
            x: g[xKey], y: g[yKey], name: g.name, tier: g.performance_tier, appid: g.appid, __visible: false,
          });
        }
      });
      orderedPoints.forEach((p) => { p.__visible = wantedIds.has(p.appid); });

      const visibleIndexed = orderedPoints
        .map((point, index) => ({ point, index }))
        .filter((entry) => entry.point.__visible);
      currentLabelIdxs = pickScatterOutliers(visibleIndexed);

      const radii = orderedPoints.map((p) => (p.__visible ? SCATTER_POINT_RADIUS : 0));
      const hoverRadii = orderedPoints.map((p) => (p.__visible ? SCATTER_POINT_HOVER_RADIUS : 0));

      if (chart) {
        const dataset = chart.data.datasets[0];
        dataset.data = orderedPoints;
        dataset.radius = radii;
        dataset.hoverRadius = hoverRadii;
        chart.options.animation = { duration: 280, easing: 'easeOutQuad' };
        chart.update();
        return;
      }

      chart = new Chart(container, {
        type: 'scatter',
        data: {
          datasets: [{
            data: orderedPoints,
            // Dims every point except the hovered one (getActiveElements) a little, so
            // the highlighted point reads as clearly foregrounded rather than just bigger.
            backgroundColor: (ctx) => {
              const color = TIER_SCATTER_COLORS[ctx.raw?.tier] || VIZ_PRIMARY;
              const active = ctx.chart.getActiveElements();
              const isSibling = active.length && !active.some((a) => a.index === ctx.dataIndex);
              return isSibling ? `${color}b3` : color;
            },
            borderWidth: 1,
            borderColor: `${VIZ_SURFACE}66`,
            hoverBorderColor: VIZ_SURFACE,
            hoverBorderWidth: 2,
            radius: radii,
            hoverRadius: hoverRadii,
          }],
        },
        plugins: [pointGlowPlugin(), pointLabelPlugin(() => currentLabelIdxs)],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          onClick: gameClickHandler((idx) => orderedPoints[idx]),
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
              ticks: yTicksCallback ? { color: VIZ_MUTED, callback: yTicksCallback } : { color: VIZ_MUTED },
              ...(yMin != null ? { min: yMin } : {}),
              ...(yMax != null ? { max: yMax } : {}),
            },
          },
        },
      });
    },
    destroy() {
      if (chart) {
        chart.destroy();
        chart = null;
      }
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

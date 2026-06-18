//
// Google Trends — unofficial internal API
// No public API key; requires browser-like headers and session cookies.
// Best-effort: may fail from datacenter IPs (e.g. GitHub Actions).

const GOOGLE_TERMS = {
  warehouse_management: 'Warehouse Management',
  transportation_management: 'Transportation Management',
  order_management: 'Order Management',
  supply_chain_planning: 'Supply Chain Planning',
  yard_management: 'Yard Management',
  manufacturing: 'Manufacturing',
};

const TRENDS_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const REQUEST_DELAY_MS = 2000;
const WIDGET_DELAY_MS = 1000;
const TRENDS_TIME_RANGE = 'today 5-y';
const MAX_RETRIES = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Strip Google's XSSI protection prefix from API responses.
 */
function stripGoogleTrendsPrefix(text) {
  return text.replace(/^\)\]\}',?\n/, '');
}

/**
 * Build browser-like headers for Trends API requests.
 */
function buildTrendsHeaders(keyword, cookieHeader) {
  const headers = {
    'User-Agent': TRENDS_USER_AGENT,
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: `https://trends.google.com/trends/explore?geo=US&q=${encodeURIComponent(keyword)}`,
    Origin: 'https://trends.google.com',
  };

  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }

  return headers;
}

/**
 * Aggregate weekly timeline points into one average value per month.
 */
function aggregateMonthly(timelineData) {
  const byMonth = new Map();

  for (const item of timelineData) {
    const date = new Date(Number(item.time) * 1000).toISOString().slice(0, 7);
    const value = item.value?.[0] ?? 0;

    if (!byMonth.has(date)) {
      byMonth.set(date, { sum: 0, count: 0 });
    }

    const bucket = byMonth.get(date);
    bucket.sum += value;
    bucket.count += 1;
  }

  return Array.from(byMonth.entries())
    .map(([date, { sum, count }]) => ({
      date,
      value: Math.round(sum / count),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Parse a multiline widget response into monthly trend data.
 */
function parseTimelineResponse(text) {
  const timelineJson = JSON.parse(stripGoogleTrendsPrefix(text));
  const timelineData = timelineJson?.default?.timelineData;

  if (!Array.isArray(timelineData)) {
    throw new Error('Trends timeline response missing timelineData');
  }

  return aggregateMonthly(timelineData);
}

/**
 * Warm up a Trends session and return a Cookie header string.
 */
async function warmupTrendsSession(keyword, fetchFn) {
  const res = await fetchFn(
    `https://trends.google.com/trends/explore?geo=US&q=${encodeURIComponent(keyword)}`,
    {
      headers: buildTrendsHeaders(keyword),
      redirect: 'follow',
    },
  );

  const cookies = res.headers.getSetCookie?.() ?? [];
  return cookies.map((c) => c.split(';')[0]).join('; ');
}

/**
 * Fetch 5-year US search interest for a single keyword.
 */
async function fetchGoogleTrend(keyword, { fetchFn = fetch, sleepFn = sleep } = {}) {
  const req = {
    comparisonItem: [{ keyword, geo: 'US', time: TRENDS_TIME_RANGE }],
    category: 0,
    property: '',
  };

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const cookieHeader = await warmupTrendsSession(keyword, fetchFn);
      const headers = buildTrendsHeaders(keyword, cookieHeader);

      const exploreRes = await fetchFn(
        `https://trends.google.com/trends/api/explore?hl=en-US&tz=360&req=${encodeURIComponent(JSON.stringify(req))}`,
        { headers },
      );

      if (!exploreRes.ok) {
        const retryable = exploreRes.status === 429 || exploreRes.status >= 500;
        if (retryable && attempt < MAX_RETRIES) {
          await sleepFn(attempt * REQUEST_DELAY_MS);
          continue;
        }
        throw new Error(`Trends explore failed for "${keyword}": HTTP ${exploreRes.status}`);
      }

      const exploreJson = JSON.parse(stripGoogleTrendsPrefix(await exploreRes.text()));
      const widget = exploreJson.widgets?.find((w) => w.id === 'TIMESERIES');

      if (!widget) {
        throw new Error(`Trends explore failed for "${keyword}": TIMESERIES widget not found`);
      }

      await sleepFn(WIDGET_DELAY_MS);

      const timelineRes = await fetchFn(
        'https://trends.google.com/trends/api/widgetdata/multiline' +
          `?hl=en-US&tz=360` +
          `&req=${encodeURIComponent(JSON.stringify(widget.request))}` +
          `&token=${encodeURIComponent(widget.token)}`,
        { headers },
      );

      if (!timelineRes.ok) {
        const retryable = timelineRes.status === 429 || timelineRes.status >= 500;
        if (retryable && attempt < MAX_RETRIES) {
          await sleepFn(attempt * REQUEST_DELAY_MS);
          continue;
        }
        throw new Error(`Trends timeline failed for "${keyword}": HTTP ${timelineRes.status}`);
      }

      return parseTimelineResponse(await timelineRes.text());
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        throw err;
      }
      await sleepFn(attempt * REQUEST_DELAY_MS);
    }
  }
}

/**
 * Fetch all configured Google Trends terms sequentially.
 */
async function collectSearchTrends({ fetchFn = fetch, sleepFn = sleep } = {}) {
  const result = {};
  let isFirstRequest = true;

  for (const [key, keyword] of Object.entries(GOOGLE_TERMS)) {
    if (!isFirstRequest) {
      await sleepFn(REQUEST_DELAY_MS);
    }

    isFirstRequest = false;

    try {
      result[key] = await fetchGoogleTrend(keyword, { fetchFn, sleepFn });
    } catch (err) {
      console.warn(`Warning: Google Trends failed for ${key} — ${err.message}`);
      result[key] = [];
    }
  }

  return result;
}

module.exports = {
  GOOGLE_TERMS,
  stripGoogleTrendsPrefix,
  buildTrendsHeaders,
  aggregateMonthly,
  parseTimelineResponse,
  fetchGoogleTrend,
  collectSearchTrends,
};

//
// SEC EDGAR Full-Text Search
// Docs: https://www.sec.gov/edgar/search/
// Requires a descriptive User-Agent header (max ~10 req/sec).

const SEC_KEYWORDS = {
  supply_chain_disruption: 'supply chain disruption',
  warehouse_automation: 'warehouse automation',
  supply_chain_technology: 'supply chain technology',
  inventory_management: 'inventory management system',
  robotics_fulfillment: 'robotics fulfillment',
  labor_shortage_warehouse: 'labor shortage warehouse',
};

const SEC_BASE_URL = 'https://efts.sec.gov/LATEST/search-index';
const REQUEST_DELAY_MS = 1500;
const SEARCH_YEARS = [2024, 2025, 2026];
const MAX_RETRIES = 5;

function getUserAgent() {
  const email = process.env.SEC_EDGAR_USER_AGENT_EMAIL || 'contact@supplychainresearch.com';
  return `SCR/1.0 ${email}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatEndDate(year) {
  if (year === new Date().getFullYear()) {
    return new Date().toISOString().slice(0, 10);
  }

  return `${year}-12-31`;
}

/**
 * Fetch filing count for a keyword within a date range.
 */
async function fetchKeywordYearCount(keyword, year) {
  const startdt = `${year}-01-01`;
  const enddt = formatEndDate(year);
  const query = `"${keyword}"`;

  const url = `${SEC_BASE_URL}?q=${encodeURIComponent(query)}&dateRange=custom&startdt=${startdt}&enddt=${enddt}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': getUserAgent(),
          Accept: 'application/json',
          Referer: 'https://www.sec.gov/',
        },
      });

      if (!res.ok) {
        const isRetryable = res.status === 429 || res.status >= 500;
        if (!isRetryable || attempt === MAX_RETRIES) {
          return { year, count: 0 };
        }
        await sleep(attempt * 2000);
        continue;
      }

      const json = await res.json();
      if (typeof json?.hits?.total?.value === 'number') {
        return { year, count: json.hits.total.value };
      }
      if (typeof json?.hits?.total === 'number') {
        return { year, count: json.hits.total };
      }
      return { year, count: 0 };
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        return { year, count: 0 };
      }
      await sleep(attempt * 2000);
    }
  }
}

/**
 * Fetch annual filing counts for all keywords.
 */
async function collectCorporateFilings() {
  const result = {};
  let isFirstRequest = true;

  for (const [key, keyword] of Object.entries(SEC_KEYWORDS)) {
    result[key] = [];

    for (const year of SEARCH_YEARS) {
      if (!isFirstRequest) {
        await sleep(REQUEST_DELAY_MS);
      }

      isFirstRequest = false;
      const entry = await fetchKeywordYearCount(keyword, year);
      result[key].push(entry);
    }
  }

  return result;
}

module.exports = { collectCorporateFilings, SEC_KEYWORDS };

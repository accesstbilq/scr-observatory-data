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
const REQUEST_DELAY_MS = 150;
const SEARCH_YEARS = [2024, 2025, 2026];

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

  const res = await fetch(url, {
    headers: {
      'User-Agent': getUserAgent(),
    },
  });

  if (!res.ok) {
    throw new Error(`SEC EDGAR request failed for "${keyword}" (${year}): HTTP ${res.status} (${url})`);
  }

  const json = await res.json();
  const count = json?.hits?.total?.value ?? 0;

  return { year, count };
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

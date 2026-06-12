//
// World Bank Logistics Performance Index (LPI)
// Docs: https://lpi.worldbank.org/
// No API key needed.

const LPI_INDICATORS = {
  overall: 'LP.LPI.OVRL.XQ',
  customs: 'LP.LPI.CUST.XQ',
  infrastructure: 'LP.LPI.INFR.XQ',
  tracking: 'LP.LPI.TRAC.XQ',
  timeliness: 'LP.LPI.TIME.XQ',
};

const WORLD_BANK_BASE_URL = 'https://api.worldbank.org/v2/country';
const LPI_COUNTRIES = 'USA;CHN;DEU;JPN;NLD;SGP;GBR;KOR;FRA;IND';
const LPI_DATE = '2023';

/**
 * Fetch LPI scores for a single indicator across selected countries.
 */
async function fetchLpiIndicator(indicatorId) {
  const url = `${WORLD_BANK_BASE_URL}/${LPI_COUNTRIES}/indicator/${indicatorId}?format=json&date=${LPI_DATE}&per_page=50`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`World Bank request failed for ${indicatorId}: HTTP ${res.status} (${url})`);
  }

  const json = await res.json();
  const dataArray = Array.isArray(json) ? json[1] : null;

  if (!dataArray) {
    throw new Error(`World Bank request failed for ${indicatorId}: unexpected response (${url})`);
  }

  return dataArray
    .filter((entry) => entry.value !== null)
    .map((entry) => ({
      country: entry.country.value,
      iso: entry.countryiso3code,
      score: entry.value,
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Fetch all LPI indicators.
 */
async function collectLogisticsPerformance() {
  const result = {};

  for (const [key, indicatorId] of Object.entries(LPI_INDICATORS)) {
    result[key] = await fetchLpiIndicator(indicatorId);
  }

  return result;
}

module.exports = { collectLogisticsPerformance, LPI_INDICATORS };

//
// Bureau of Labor Statistics (BLS) Public API v1
// Docs: https://www.bls.gov/developers/
// No API key needed for v1 (25 requests/day limit).

const BLS_SERIES = {
  warehouse_employment: 'CES4349300001',
  warehouse_hourly_wage: 'CES4349300003',
  truck_employment: 'CES4348400001',
  transport_job_openings: 'JTS480099000000000JOL',
  transport_quits_rate: 'JTS480099000000000QUR',
};

const BLS_BASE_URL = 'https://api.bls.gov/publicAPI/v1/timeseries/data';

/**
 * Fetch a single BLS series and return cleaned data points.
 * Output is newest-first, last 24 months (matches BLS's natural order).
 */
async function fetchBlsSeries(seriesId) {
  const url = `${BLS_BASE_URL}/${seriesId}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`BLS request failed for ${seriesId}: HTTP ${res.status} (${url})`);
  }

  const json = await res.json();

  if (json.status !== 'REQUEST_SUCCEEDED') {
    throw new Error(`BLS request failed for ${seriesId}: ${json.message || json.status} (${url})`);
  }

  const rawData = json.Results.series[0].data;

  return rawData
    .filter((item) => item.period !== 'M13') // M13 = annual average, not a real month
    .map((item) => ({
      date: `${item.year}-${item.period.replace('M', '')}`, // e.g. "2026-05"
      value: parseFloat(item.value),
    }))
    .slice(0, 24); // keep last 24 months (newest-first)
}

/**
 * Fetch all BLS series and return the "labor_market" block.
 */
async function collectLaborMarket() {
  const result = {};

  for (const [key, seriesId] of Object.entries(BLS_SERIES)) {
    result[key] = await fetchBlsSeries(seriesId);
  }

  return result;
}

module.exports = { collectLaborMarket, fetchBlsSeries, BLS_SERIES };

//
// Federal Reserve Economic Data (FRED) - public CSV endpoint
// Docs: https://fred.stlouisfed.org/docs/api/
// No API key needed for the fredgraph.csv endpoint.

const FRED_SERIES = {
  transport_services_index: 'TSIFRGHT',
  inventory_sales_ratio: 'ISRATIO',
  industrial_production_mfg: 'IPMAN',
  producer_price_warehousing: 'PCU493493',
  diesel_fuel_price: 'GASDESW',
};

const FRED_BASE_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv';

/**
 * Fetch a single FRED series as CSV and return cleaned data points.
 * Output is oldest-first, last 36 months.
 */
async function fetchFredSeries(seriesId) {
  const url = `${FRED_BASE_URL}?id=${seriesId}&cosd=2022-01-01`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`FRED request failed for ${seriesId}: HTTP ${res.status} (${url})`);
  }

  const csvText = await res.text();
  const lines = csvText.trim().split('\n');
  const rows = lines.slice(1); // skip header row (observation_date,SERIES_ID)

  const data = [];

  for (const line of rows) {
    const [date, value] = line.split(',');

    if (!date || value === undefined || value.trim() === '.') {
      continue; // skip missing values
    }

    data.push({
      date: date.slice(0, 7), // "YYYY-MM-DD" -> "YYYY-MM"
      value: parseFloat(value),
    });
  }

  return data.slice(-36); // last 36 months (oldest-first)
}

/**
 * Fetch all FRED series and return the "economic_indices" block.
 */
async function collectEconomicIndices() {
  const result = {};

  for (const [key, seriesId] of Object.entries(FRED_SERIES)) {
    result[key] = await fetchFredSeries(seriesId);
  }

  return result;
}

module.exports = { collectEconomicIndices, fetchFredSeries, FRED_SERIES };

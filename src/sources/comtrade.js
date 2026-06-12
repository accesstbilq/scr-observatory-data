//
// UN Comtrade - public preview API
// Docs: https://comtradeapi.un.org/
// No API key needed for preview endpoint.

const COMTRADE_HS_CODES = {
  lifting_handling_machinery: '8428',
  individual_function_machines: '8479',
};

const COMTRADE_BASE_URL = 'https://comtradeapi.un.org/public/v1/preview/C/A/HS';
const COMTRADE_YEARS = [2020, 2021, 2022, 2023];
const REPORTER_CODE = '842'; // USA
const PARTNER_CODE = '0'; // World
const FLOW_CODE = 'M'; // Imports

/**
 * Fetch import trade value for a single HS code and year.
 * Returns null if no data is available for that year.
 */
async function fetchComtradeYear(hsCode, year) {
  const params = new URLSearchParams({
    reporterCode: REPORTER_CODE,
    period: String(year),
    partnerCode: PARTNER_CODE,
    flowCode: FLOW_CODE,
    cmdCode: hsCode,
    maxRecords: '1',
  });

  const url = `${COMTRADE_BASE_URL}?${params.toString()}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`UN Comtrade request failed for HS ${hsCode} (${year}): HTTP ${res.status} (${url})`);
  }

  const json = await res.json();

  if (!json.data || json.data.length === 0) {
    return null;
  }

  return {
    year,
    value: json.data[0].primaryValue,
  };
}

/**
 * Fetch import trade flows for all HS codes.
 */
async function collectTradeFlows() {
  const result = {};

  for (const [key, hsCode] of Object.entries(COMTRADE_HS_CODES)) {
    result[key] = [];

    for (const year of COMTRADE_YEARS) {
      const entry = await fetchComtradeYear(hsCode, year);

      if (entry) {
        result[key].push(entry);
      }
    }
  }

  return result;
}

module.exports = { collectTradeFlows, COMTRADE_HS_CODES };

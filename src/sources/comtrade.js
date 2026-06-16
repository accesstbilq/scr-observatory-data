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
const MAX_RETRIES = 3;
const REQUEST_DELAY_MS = 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch import trade value for a single HS code and year.
 * Returns a value object; on transient failures it falls back to 0.
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
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const isRetryable = res.status === 429 || res.status >= 500;
        if (!isRetryable || attempt === MAX_RETRIES) {
          return { year, value: 0 };
        }
        await sleep(REQUEST_DELAY_MS * attempt);
        continue;
      }

      const json = await res.json();
      const value = json?.data?.[0]?.primaryValue;
      return { year, value: typeof value === 'number' ? value : 0 };
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        return { year, value: 0 };
      }
      await sleep(REQUEST_DELAY_MS * attempt);
    }
  }
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
      result[key].push(entry);
    }
  }

  return result;
}

module.exports = { collectTradeFlows, COMTRADE_HS_CODES };

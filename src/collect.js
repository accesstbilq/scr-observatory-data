//
// Main entry point. Runs all data collectors and writes observatory.json.
//
// Usage:
//   node src/collect.js
//   npm run collect
//
// Requires Node.js >= 18 (uses built-in fetch).

const fs = require('fs');
const path = require('path');

const { collectLaborMarket } = require('./sources/bls');
const { collectEconomicIndices } = require('./sources/fred');
const { collectResearchTrends } = require('./sources/openalex');
const { collectCorporateFilings } = require('./sources/secEdgar');
const { collectTradeFlows } = require('./sources/comtrade');
const { collectLogisticsPerformance } = require('./sources/worldBank');
const { collectSearchTrends } = require('./sources/googleTrends');

const SOURCES_META = {
  bls: {
    name: 'Bureau of Labor Statistics',
    url: 'https://www.bls.gov',
    update_freq: 'monthly',
  },
  fred: {
    name: 'Federal Reserve Economic Data',
    url: 'https://fred.stlouisfed.org',
    update_freq: 'monthly',
  },
  openalex: {
    name: 'OpenAlex',
    url: 'https://openalex.org',
    update_freq: 'weekly',
  },
  sec_edgar: {
    name: 'SEC EDGAR',
    url: 'https://www.sec.gov/edgar',
    update_freq: 'daily',
  },
  un_comtrade: {
    name: 'UN Comtrade',
    url: 'https://comtradeapi.un.org',
    update_freq: 'annual',
  },
  world_bank: {
    name: 'World Bank',
    url: 'https://lpi.worldbank.org',
    update_freq: 'biennial',
  },
  google_trends: {
    name: 'Google Trends',
    url: 'https://trends.google.com',
    update_freq: 'weekly',
  },
};

const COLLECTORS = [
  { name: 'BLS', key: 'labor_market', collect: collectLaborMarket, fallback: {} },
  { name: 'FRED', key: 'economic_indices', collect: collectEconomicIndices, fallback: {} },
  { name: 'OpenAlex', key: 'research_trends', collect: collectResearchTrends, fallback: {} },
  { name: 'SEC EDGAR', key: 'corporate_filings', collect: collectCorporateFilings, fallback: {} },
  { name: 'UN Comtrade', key: 'trade_flows', collect: collectTradeFlows, fallback: {} },
  { name: 'World Bank', key: 'logistics_performance', collect: collectLogisticsPerformance, fallback: {} },
];

/**
 * Run a single collector, logging progress and isolating failures.
 */
async function runCollector({ name, key, collect, fallback }) {
  console.log(`Collecting ${name}...`);

  try {
    const data = await collect();
    console.log(`Done ${name}`);
    return { key, data, ok: true };
  } catch (err) {
    console.warn(`Warning: ${name} collection failed — ${err.message}`);
    return { key, data: fallback, ok: false };
  }
}

async function main() {
  console.log('Supply Chain Observatory — starting collection\n');

  const parallelResults = await Promise.all(COLLECTORS.map(runCollector));
  const trendsResult = await runCollector({
    name: 'Google Trends',
    key: 'search_trends',
    collect: collectSearchTrends,
    fallback: {},
  });
  const results = [...parallelResults, trendsResult];

  const sections = {};
  const summary = { succeeded: [], failed: [] };

  for (const { key, data, ok } of results) {
    sections[key] = data;

    if (ok) {
      summary.succeeded.push(key);
    } else {
      summary.failed.push(key);
    }
  }

  const observatory = {
    generated_at: new Date().toISOString(),
    sources: SOURCES_META,
    labor_market: sections.labor_market,
    economic_indices: sections.economic_indices,
    research_trends: sections.research_trends,
    corporate_filings: sections.corporate_filings,
    trade_flows: sections.trade_flows,
    logistics_performance: sections.logistics_performance,
    search_trends: sections.search_trends,
  };

  const outPath = path.join(__dirname, '..', 'observatory.json');
  fs.writeFileSync(outPath, JSON.stringify(observatory, null, 2));

  console.log('\n--- Summary ---');
  console.log(`Succeeded: ${summary.succeeded.length}/${COLLECTORS.length + 1}`);
  if (summary.succeeded.length > 0) {
    console.log(`  ${summary.succeeded.join(', ')}`);
  }
  if (summary.failed.length > 0) {
    console.log(`Failed: ${summary.failed.join(', ')}`);
  }
  console.log(`\nDone. Wrote ${outPath}`);
}

main().catch((err) => {
  console.error('Collection failed:', err);
  process.exit(1);
});

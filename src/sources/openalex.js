//
// OpenAlex - open scholarly catalog
// Docs: https://docs.openalex.org/
// No API key needed; optional mailto for polite pool.

const OPENALEX_TOPICS = {
  sustainable_supply_chain: 'T10539',
  outsourcing_scm: 'T11912',
  inventory_management: 'T10328',
  supply_chain_resilience: 'T11864',
  quality_supply_mgmt: 'T10164',
};

const OPENALEX_BASE_URL = 'https://api.openalex.org/works';
const TOP_INSTITUTIONS_TOPIC_ID = 'T10539';

function buildOpenAlexUrl(params) {
  const mailto = process.env.OPENALEX_MAILTO;
  const searchParams = new URLSearchParams(params);

  if (mailto) {
    searchParams.set('mailto', mailto);
  }

  return `${OPENALEX_BASE_URL}?${searchParams.toString()}`;
}

/**
 * Fetch publication counts by year for a single topic.
 */
async function fetchTopicPublicationCounts(topicId) {
  const url = buildOpenAlexUrl({
    filter: `topics.id:${topicId}`,
    group_by: 'publication_year',
  });

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`OpenAlex request failed for topic ${topicId}: HTTP ${res.status} (${url})`);
  }

  const json = await res.json();

  return (json.group_by || [])
    .filter((entry) => /^\d+$/.test(entry.key))
    .filter((entry) => {
      const year = Number(entry.key);
      return year >= 2015 && year <= 2026;
    })
    .map((entry) => ({
      year: Number(entry.key),
      count: entry.count,
    }))
    .sort((a, b) => a.year - b.year);
}

/**
 * Fetch top institutions publishing on sustainable supply chain.
 */
async function fetchTopInstitutions() {
  const url = buildOpenAlexUrl({
    filter: `topics.id:${TOP_INSTITUTIONS_TOPIC_ID}`,
    group_by: 'authorships.institutions.lineage',
    per_page: '10',
  });

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`OpenAlex request failed for top institutions: HTTP ${res.status} (${url})`);
  }

  const json = await res.json();

  return (json.group_by || [])
    .slice(0, 10)
    .map((entry) => ({
      name: entry.key_display_name,
      count: entry.count,
    }));
}

/**
 * Fetch all OpenAlex research trend data.
 */
async function collectResearchTrends() {
  const result = {};

  for (const [key, topicId] of Object.entries(OPENALEX_TOPICS)) {
    result[key] = await fetchTopicPublicationCounts(topicId);
  }

  result.top_institutions = await fetchTopInstitutions();

  return result;
}

module.exports = { collectResearchTrends, OPENALEX_TOPICS };

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  GOOGLE_TERMS,
  stripGoogleTrendsPrefix,
  buildTrendsHeaders,
  aggregateMonthly,
  parseTimelineResponse,
  fetchGoogleTrend,
  collectSearchTrends,
} = require('../src/sources/googleTrends');

const exploreFixture = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'trends-explore.json'),
  'utf8',
);
const timelineFixture = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'trends-timeline.json'),
  'utf8',
);

describe('stripGoogleTrendsPrefix', () => {
  test('removes XSSI prefix with newline', () => {
    const input = ")]}',\n{\"widgets\":[]}";
    assert.equal(stripGoogleTrendsPrefix(input), '{"widgets":[]}');
  });

  test('passes through plain JSON', () => {
    const input = '{"widgets":[]}';
    assert.equal(stripGoogleTrendsPrefix(input), input);
  });
});

describe('buildTrendsHeaders', () => {
  test('includes referer with encoded keyword', () => {
    const headers = buildTrendsHeaders('Warehouse Management');
    assert.match(headers.Referer, /Warehouse%20Management/);
    assert.equal(headers.Origin, 'https://trends.google.com');
    assert.match(headers['User-Agent'], /Chrome/);
  });

  test('adds cookie header when provided', () => {
    const headers = buildTrendsHeaders('test', 'NID=abc');
    assert.equal(headers.Cookie, 'NID=abc');
  });
});

describe('aggregateMonthly', () => {
  test('averages multiple weekly points within the same month', () => {
    const timelineData = [
      { time: '1622505600', value: [10] },
      { time: '1623110400', value: [20] },
      { time: '1627776000', value: [40] },
    ];

    const result = aggregateMonthly(timelineData);

    assert.equal(result.length, 2);
    assert.deepEqual(result[0], { date: '2021-06', value: 15 });
    assert.deepEqual(result[1], { date: '2021-08', value: 40 });
  });

  test('sorts months chronologically', () => {
    const timelineData = [
      { time: '1640995200', value: [50] },
      { time: '1622505600', value: [10] },
    ];

    const result = aggregateMonthly(timelineData);
    assert.equal(result[0].date, '2021-06');
    assert.equal(result[1].date, '2022-01');
  });
});

describe('parseTimelineResponse', () => {
  test('parses XSSI-wrapped fixture into monthly data', () => {
    const wrapped = `)]}',\n${timelineFixture}`;
    const result = parseTimelineResponse(wrapped);

    assert.ok(result.length > 0);
    assert.ok(result.every((row) => /^\d{4}-\d{2}$/.test(row.date)));
    assert.ok(result.every((row) => typeof row.value === 'number'));
  });
});

describe('fetchGoogleTrend', () => {
  test('follows warmup → explore → timeline flow with mocked fetch', async () => {
    const calls = [];

    const mockFetch = async (url, options = {}) => {
      calls.push(url);

      if (url.includes('/trends/explore?geo=US')) {
        return {
          headers: {
            getSetCookie: () => ['NID=test-cookie; Path=/'],
          },
        };
      }

      if (url.includes('/trends/api/explore')) {
        return {
          ok: true,
          text: async () => `)]}',\n${exploreFixture}`,
        };
      }

      if (url.includes('/trends/api/widgetdata/multiline')) {
        return {
          ok: true,
          text: async () => `)]}',\n${timelineFixture}`,
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const result = await fetchGoogleTrend('Warehouse Management', {
      fetchFn: mockFetch,
      sleepFn: async () => {},
    });

    assert.ok(result.length > 0);
    assert.equal(calls.filter((u) => u.includes('/trends/explore?geo=US')).length, 1);
    assert.equal(calls.filter((u) => u.includes('/trends/api/explore')).length, 1);
    assert.equal(calls.filter((u) => u.includes('/widgetdata/multiline')).length, 1);
  });

  test('throws on explore HTTP error', async () => {
    const mockFetch = async (url) => {
      if (url.includes('/trends/explore?geo=US')) {
        return { headers: { getSetCookie: () => [] } };
      }

      return {
        ok: false,
        status: 429,
        text: async () => '<html>blocked</html>',
      };
    };

    await assert.rejects(
      () => fetchGoogleTrend('test', { fetchFn: mockFetch, sleepFn: async () => {} }),
      /HTTP 429/,
    );
  });
});

describe('collectSearchTrends', () => {
  test('collects all configured keywords', async () => {
    const mockFetch = async (url) => {
      if (url.includes('/trends/explore?geo=US')) {
        return { headers: { getSetCookie: () => [] } };
      }

      if (url.includes('/trends/api/explore')) {
        return { ok: true, text: async () => `)]}',\n${exploreFixture}` };
      }

      if (url.includes('/widgetdata/multiline')) {
        return { ok: true, text: async () => `)]}',\n${timelineFixture}` };
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const result = await collectSearchTrends({
      fetchFn: mockFetch,
      sleepFn: async () => {},
    });

    assert.equal(Object.keys(result).length, Object.keys(GOOGLE_TERMS).length);
    assert.deepEqual(Object.keys(result).sort(), Object.keys(GOOGLE_TERMS).sort());

    for (const key of Object.keys(GOOGLE_TERMS)) {
      assert.ok(Array.isArray(result[key]), `${key} should be an array`);
    }
  });

  test('continues collecting when a single keyword fails', async () => {
    let callCount = 0;

    const mockFetch = async (url) => {
      if (url.includes('/trends/explore?geo=US')) {
        return { headers: { getSetCookie: () => [] } };
      }

      if (url.includes('/trends/api/explore')) {
        callCount += 1;
        if (callCount === 2) {
          return { ok: false, status: 429, text: async () => '<html>blocked</html>' };
        }
        return { ok: true, text: async () => `)]}',\n${exploreFixture}` };
      }

      if (url.includes('/widgetdata/multiline')) {
        return { ok: true, text: async () => `)]}',\n${timelineFixture}` };
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const result = await collectSearchTrends({
      fetchFn: mockFetch,
      sleepFn: async () => {},
    });

    const emptyKeys = Object.entries(result).filter(([, rows]) => rows.length === 0);
    const filledKeys = Object.entries(result).filter(([, rows]) => rows.length > 0);

    assert.equal(emptyKeys.length + filledKeys.length, Object.keys(GOOGLE_TERMS).length);
    assert.ok(filledKeys.length > 0);
  });
});

describe('GOOGLE_TERMS', () => {
  test('includes all requested keywords', () => {
    assert.equal(GOOGLE_TERMS.warehouse_management, 'Warehouse Management');
    assert.equal(GOOGLE_TERMS.transportation_management, 'Transportation Management');
    assert.equal(GOOGLE_TERMS.order_management, 'Order Management');
    assert.equal(GOOGLE_TERMS.supply_chain_planning, 'Supply Chain Planning');
    assert.equal(GOOGLE_TERMS.yard_management, 'Yard Management');
    assert.equal(GOOGLE_TERMS.manufacturing, 'Manufacturing');
  });
});

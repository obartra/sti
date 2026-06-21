/**
 * A tiny Prometheus-text scraper for the load lab. It reads the blind metrics
 * endpoint the throwaway server exposes on loopback (doc 12 §5) and gives the
 * assertions the few series they need: a gauge or counter by name, a counter by
 * full series string, and a sum across a counter's whole label set. It parses, it
 * does not interpret. Each value is keyed by its full `name{sorted,labels}` string
 * exactly as the server renders it (labels are emitted alphabetically; see
 * server/internal/metrics/metrics.go renderLabels).
 */

export interface Scrape {
  /** Exact value for a full series string (`name` or `name{labels}`), or undefined. */
  value(series: string): number | undefined;
  /** An unlabeled gauge/counter value (the series is just its name); 0 if absent. */
  gauge(name: string): number;
  /** Sum of every series sharing `name`, across all label sets; 0 if none. */
  sum(name: string): number;
  /** Every distinct bare metric name present in the scrape. */
  names(): string[];
  /** Every full series string present (`name` or `name{labels}`). */
  series(): string[];
}

const VALUE_LINE = /^(\S+?)(\{.*\})?\s+(\S+)$/;

function metricName(series: string): string {
  const brace = series.indexOf("{");
  return brace === -1 ? series : series.slice(0, brace);
}

function parse(text: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const m = VALUE_LINE.exec(line);
    if (m === null) continue;
    const [, name, labels, val] = m;
    if (name === undefined || val === undefined) continue;
    out.set(labels === undefined ? name : name + labels, Number(val));
  }
  return out;
}

function toScrape(map: Map<string, number>): Scrape {
  return {
    value: (series) => map.get(series),
    gauge: (name) => map.get(name) ?? 0,
    sum: (name) => {
      let total = 0;
      for (const [series, v] of map) {
        if (metricName(series) === name) total += v;
      }
      return total;
    },
    names: () => [...new Set([...map.keys()].map(metricName))],
    series: () => [...map.keys()],
  };
}

/** Scrape `${url}/metrics`, retrying briefly while the loopback listener warms up. */
export async function scrapeMetrics(
  url: string,
  attempts = 20,
): Promise<Scrape> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url + "/metrics");
      if (res.ok) return toScrape(parse(await res.text()));
    } catch {
      // listener not up yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`metrics endpoint at ${url} never responded`);
}

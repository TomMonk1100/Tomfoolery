import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

interface FeedItem {
  title: string;
  link: string;
  pubDate: Date;
  description: string;
  category: string;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function summarizeMarkdown(body: string | undefined, fallback: string): string {
  if (!body) return fallback;
  const plain = body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_>#~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return fallback;
  return plain.length > 260 ? `${plain.slice(0, 257).trimEnd()}…` : plain;
}

export const GET: APIRoute = async ({ site, url }) => {
  const origin = site ?? new URL(url.origin);
  const [nowEntries, pokemonEntries, projectEntries, blogEntries] = await Promise.all([
    getCollection('now'),
    getCollection('pokemon'),
    getCollection('projects'),
    getCollection('pastBlog'),
  ]);

  // Never include `/family` in the public RSS feed.
  const items: FeedItem[] = [
    ...nowEntries.map((entry) => ({
      title: entry.data.title,
      link: new URL(`/now/${entry.id}`, origin).toString(),
      pubDate: entry.data.date,
      description: summarizeMarkdown(entry.body, entry.data.title),
      category: 'Now',
    })),
    ...pokemonEntries
      .filter((entry) => Boolean(entry.data.datePublished ?? entry.data.dateAcquired))
      .map((entry) => ({
        title: entry.data.title,
        link: new URL(`/pokemon/${entry.id}`, origin).toString(),
        pubDate: (entry.data.datePublished ?? entry.data.dateAcquired) as Date,
        description: summarizeMarkdown(entry.body, entry.data.title),
        category: 'Pokémon',
      })),
    ...projectEntries.map((entry) => ({
      title: entry.data.title,
      link: new URL(`/projects/${entry.id}`, origin).toString(),
      pubDate: entry.data.date,
      description: entry.data.summary,
      category: 'Projects',
    })),
    ...blogEntries.map((entry) => ({
      title: entry.data.title,
      link: new URL(`/archive/blog/${entry.id}`, origin).toString(),
      pubDate: entry.data.date,
      description: summarizeMarkdown(entry.body, entry.data.title),
      category: 'Archive',
    })),
  ].sort((a, b) => {
    const diff = b.pubDate.valueOf() - a.pubDate.valueOf();
    return diff !== 0 ? diff : a.link.localeCompare(b.link);
  });

  const feedUrl = new URL('/rss.xml', origin).toString();
  const siteUrl = new URL('/', origin).toString();
  const lastBuildDate = items[0]?.pubDate ?? new Date();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Tomfoolery</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>Things Tom makes, collects, notices, and keeps — from Breckenridge, Texas.</description>
    <language>en-us</language>
    <lastBuildDate>${escapeXml(lastBuildDate.toUTCString())}</lastBuildDate>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
${items
  .map(
    (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="true">${escapeXml(item.link)}</guid>
      <pubDate>${escapeXml(item.pubDate.toUTCString())}</pubDate>
      <category>${escapeXml(item.category)}</category>
      <description>${escapeXml(item.description)}</description>
    </item>`,
  )
  .join('\n')}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
};

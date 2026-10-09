import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = (await getCollection('research')).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );

  return rss({
    title: 'KILSERV — Security Research',
    description: 'CVE disclosures, offensive research, and technical write-ups by Guilherme Mury.',
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description,
      link: `/research/${post.slug}/`,
      categories: post.data.tags,
    })),
    customData: '<language>en</language>',
  });
}

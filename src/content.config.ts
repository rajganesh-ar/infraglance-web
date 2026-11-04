import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

import { insightCategories } from './data/insight-categories';
import { nb } from './data/helpers';

/**
 * Insights articles (MDX). Inside the body these components are available
 * without importing them:
 *   <Figure img="photo-key" alt="..." caption="..." />   photo keys: docs/media-shotlist.md
 *   <Callout title="..." tone="info|warn">markdown</Callout>
 */
const insights = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/insights' }),
  schema: z.object({
    /** Spaced dashes in title and description are bound to the word before (nb), wherever they render. */
    title: z.string().transform(nb),
    /** Shorter <title> for search results and share cards (at most ~46 characters, so the full title with " | Infraglance" stays within 60). */
    seoTitle: z.string().max(46).optional(),
    /** Meta description and hero lead: at most ~155 characters. */
    description: z.string().transform(nb),
    date: z.coerce.date(),
    category: z.enum(insightCategories),
    hero: z.string(),
    heroAlt: z.string(),
    author: z.string().default('Infraglance Engineering'),
    tags: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
  }),
});

export const collections = { insights };

import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const pokemon = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pokemon' }),
  schema: z.object({
    title: z.string(),
    set: z.string().optional(),
    grade: z.string().optional(),
    dateAcquired: z.coerce.date().optional(),
    image: z.string().optional(),
  }),
});

// "Now" is a lifestyle blog: coffee, retreats, collecting, whatever's
// current. Replaces the old separate coffee/photos/retreats collections.
const now = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/now' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    tag: z.string().optional(),
    location: z.string().optional(),
    image: z.string().optional(),
  }),
});

const art = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/art' }),
  schema: z.object({
    title: z.string(),
    category: z.enum(['coffee-art', 'hand-drawn', 'ai-art']),
    date: z.coerce.date().optional(),
    image: z.string().optional(),
  }),
});

const pastBlog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pastBlog' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
  }),
});

export const collections = { now, pokemon, art, pastBlog };

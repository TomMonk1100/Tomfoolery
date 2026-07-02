import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const coffee = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/coffee' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    roaster: z.string().optional(),
    origin: z.string().optional(),
    rating: z.number().min(1).max(5).optional(),
    image: z.string().optional(),
  }),
});

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

const photos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/photos' }),
  schema: z.object({
    title: z.string(),
    location: z.string().optional(),
    date: z.coerce.date().optional(),
    image: z.string().optional(),
  }),
});

const retreats = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/retreats' }),
  schema: z.object({
    title: z.string(),
    location: z.string().optional(),
    date: z.coerce.date().optional(),
    status: z.enum(['planning', 'upcoming', 'past']).default('planning'),
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

export const collections = { coffee, pokemon, photos, retreats, art, pastBlog };

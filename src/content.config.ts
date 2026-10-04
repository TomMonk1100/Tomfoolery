import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const pokemon = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pokemon' }),
  schema: z.object({
    title: z.string(),
    set: z.string().optional(),
    grade: z.string().optional(),
    dateAcquired: z.coerce.date().optional(),
    datePublished: z.coerce.date().optional(),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
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

// "Projects" is the workshop: small interactive toys, simulations, and games
// built by Pip (the AI that helps Tom tend this site). Each entry points at a
// self-contained HTML file served from /public/projects and iframed on its
// detail page.
const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    kind: z.enum(['simulation', 'game', 'toy', 'generative']),
    summary: z.string(),
    file: z.string(),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
  }),
});

export const collections = { now, pokemon, art, pastBlog, projects };

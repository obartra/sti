import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { SECTION_IDS } from "./data/sections.ts";

// Outbound source links rendered as the quiet "sources" block on a page. Always
// public health agencies ("based on", never "reviewed by").
const sources = z
  .array(z.object({ label: z.string(), href: z.string().url() }))
  .optional();

// The condition explainers (doc 34). One markdown file per condition under
// content/conditions/{id}.md; the filename is the URL slug (info.sti.care/{id}).
// Frontmatter carries the display name, the status label and its tone (which
// drives the chip color, always paired with the word so it reads in grayscale),
// the sort order on the index, the one-line "how to test", the intro, and the
// source links. The body is the question-and-answer copy.
const conditions = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/conditions" }),
  schema: z.object({
    name: z.string(),
    label: z.string(),
    tone: z.enum(["clear", "treat", "none"]),
    order: z.number(),
    test: z.string(),
    intro: z.string(),
    sources,
    related: z
      .array(z.object({ label: z.string(), href: z.string() }))
      .optional(),
  }),
});

// The guides: practical how-to reading (getting tested, symptoms, protection,
// the conversations). One markdown file per guide under content/guides/{id}.md;
// the filename is the URL slug, flat at the root like the conditions.
// Frontmatter carries the page title, the topic section it lives in (ids from
// data/sections.ts), the one-line card sub for the index, the icon on its index
// card, the sort order within its topic, an optional extra aside action, the
// intro, and the source links. The body is plain markdown sections.
const guides = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/guides" }),
  schema: z.object({
    title: z.string(),
    topic: z.enum(SECTION_IDS),
    tag: z.string(),
    icon: z.enum([
      "stethoscope",
      "shield",
      "eye",
      "mail",
      "clock",
      "heart",
      "circles",
      "shieldPlus",
      "care",
      "users",
      "calendar",
    ]),
    order: z.number(),
    cta: z.enum(["prep", "condoms"]).optional(),
    intro: z.string(),
    sources,
  }),
});

export const collections = { conditions, guides };

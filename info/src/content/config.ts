import { defineCollection, z } from "astro:content";

// The condition explainers (doc 34). One markdown file per condition under
// content/conditions/{id}.md; the filename is the URL slug (info.sti.care/{id}).
// Frontmatter carries the display name, the status label and its tone (which
// drives the chip color, always paired with the word so it reads in grayscale),
// the sort order on the index, the one-line "how to test", and the intro. The
// body is the question-and-answer copy.
const conditions = defineCollection({
  type: "content",
  schema: z.object({
    name: z.string(),
    label: z.string(),
    tone: z.enum(["clear", "treat", "none"]),
    order: z.number(),
    test: z.string(),
    intro: z.string(),
  }),
});

export const collections = { conditions };

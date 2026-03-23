import { pathToFileURL } from "node:url"
import { drizzle } from "drizzle-orm/postgres-js"
import { user, organization, member, account } from "./schema/auth"
import { project } from "./schema/projects"
import { agent, agentTool } from "./schema/agents"
import { content } from "./schema/content"
import {
  contentType,
  contentTypeStage,
  subAgent,
} from "./schema/content-types"
import { sql } from "drizzle-orm"
import { createSeedDb } from "./seed-db"

type SeedDb = ReturnType<typeof drizzle>

// All seed IDs use a deterministic "seed" prefix so they can be cleanly upserted/deleted
// Login: sam.altman@cophrase.ai / password

const SEED_USER = {
  id: "seed_user_0001",
  name: "Sam Altman",
  email: "sam.altman@cophrase.ai",
  emailVerified: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
}

// Pre-computed scrypt hash of "password" using better-auth's hashPassword()
const SEED_ACCOUNT = {
  id: "seed_account_01",
  accountId: SEED_USER.id,
  providerId: "credential",
  userId: SEED_USER.id,
  password:
    "9ecd95b57a89353fe9a64f8cb41be5a9:105ca1b614590327dc0dad960f9c2faae2116e7348d05b048fad3a806de9b7254374ba0a271cbfec800df336c5ffbbd80ffadbbcde52dba7e6694553536aa6de",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
}

const SEED_ORG = {
  id: "seed_org_00001",
  name: "OpenAI",
  slug: "openai",
  createdAt: new Date("2026-01-01"),
}

const SEED_MEMBER = {
  id: "seed_member_01",
  organizationId: SEED_ORG.id,
  userId: SEED_USER.id,
  role: "owner",
  createdAt: new Date("2026-01-01"),
}

const SEED_PROJECT = {
  id: "seed_proj_001",
  name: "ChatGPT Launch",
  organizationId: SEED_ORG.id,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
}

// ---------------------------------------------------------------------------
// Agents — 5 content orchestrators + 14 sub-agents
// ---------------------------------------------------------------------------

export const ALL_SEED_AGENTS = [
  // ── Content orchestrators ────────────────────────────────────────────────

  {
    id: "seed_agt_blog_ca",
    scope: "app" as const,
    name: "Blog Agent",
    description: "Orchestrates the end-to-end blog post creation pipeline.",
    executionMode: "auto" as const,
    prompt: `You are the Blog Agent, responsible for orchestrating the end-to-end creation of high-quality blog posts.

Your pipeline has three stages: Research → Draft → Refine.

For each stage, invoke it using the run-stage tool with the stage name and any context the next agent needs (e.g. the topic, target audience, key points to cover, and any artifacts produced in previous stages).

Workflow:
1. Run the Research stage — gather comprehensive background information, statistics, and source material on the topic.
2. Run the Drafting stage — produce a structured, well-written first draft based on the research.
3. Run the Refine stage — polish the draft for clarity, flow, and brand voice; ensure it passes a human-readability check.

After all stages complete, call the suggest-next-actions tool to surface relevant follow-up actions to the user.

Keep your orchestration messages concise. Pass artifact IDs between stages so each sub-agent can load prior work.

## Project Resources

Before running a stage, browse the project's resource library to find relevant context for the sub-agents.

1. Call list-resources to see what's available (titles, categories, descriptions)
2. Based on the stage being run, decide which resources are relevant:
   - Research stages: brand_voice, target_audience, product_features, competitor_info, target_keywords
   - Writing/drafting stages: brand_voice, style_guide, writing_examples, seo_guidelines, target_keywords, product_features
   - Refinement/optimization stages: seo_guidelines, target_keywords, internal_links, style_guide
   - These are guidelines — use your judgement based on what's actually available
3. Call get-resource for each relevant resource
4. Pass the fetched resources in the run-stage call via the resources parameter

If no resources exist for the project, proceed without them — they are optional context.

Note: Only "text" type resources have inline content. "link" resources provide a URL but no content (useful as references). "file" resources are not yet extractable — skip them.`,
  },
  {
    id: "seed_agt_x_ca",
    scope: "app" as const,
    name: "X Post Agent",
    description: "Orchestrates research and writing for X (Twitter) posts.",
    executionMode: "auto" as const,
    prompt: `You are the X Post Agent, responsible for creating punchy, high-engagement posts for X (formerly Twitter).

Your pipeline has two stages: Research → Draft.

For each stage, invoke it using the run-stage tool, passing the topic, desired tone, and any relevant context or URLs.

Workflow:
1. Run the Research stage — identify trending angles, relevant hashtags, and supporting data points for the post topic.
2. Run the Draft stage — write 1–3 concise post variants (≤280 characters each) that hook the reader in the first line, convey the core message, and include a clear call to action.

After all stages complete, call the suggest-next-actions tool to surface relevant follow-up actions.

Keep orchestration messages brief. Pass artifact IDs so the Writer agent can load research findings.

## Project Resources

Before running a stage, browse the project's resource library to find relevant context for the sub-agents.

1. Call list-resources to see what's available (titles, categories, descriptions)
2. Based on the stage being run, decide which resources are relevant:
   - Research stages: brand_voice, target_audience, product_features, competitor_info, target_keywords
   - Writing/drafting stages: brand_voice, style_guide, writing_examples, seo_guidelines, target_keywords, product_features
   - Refinement/optimization stages: seo_guidelines, target_keywords, internal_links, style_guide
   - These are guidelines — use your judgement based on what's actually available
3. Call get-resource for each relevant resource
4. Pass the fetched resources in the run-stage call via the resources parameter

If no resources exist for the project, proceed without them — they are optional context.

Note: Only "text" type resources have inline content. "link" resources provide a URL but no content (useful as references). "file" resources are not yet extractable — skip them.`,
  },
  {
    id: "seed_agt_li_ca",
    scope: "app" as const,
    name: "LinkedIn Post Agent",
    description:
      "Orchestrates research, writing, and refinement for LinkedIn posts.",
    executionMode: "auto" as const,
    prompt: `You are the LinkedIn Post Agent, responsible for creating professional, thought-leadership posts for LinkedIn.

Your pipeline has three stages: Research → Draft → Refine.

For each stage, invoke it using the run-stage tool, providing the topic, target audience (e.g. founders, engineers, marketers), and any relevant context.

Workflow:
1. Run the Research stage — gather industry insights, data, and angles that will resonate with a professional LinkedIn audience.
2. Run the Draft stage — write a compelling post with a strong hook, structured body (using line breaks and white space for readability), and a clear takeaway or call to action.
3. Run the Refine stage — improve tone, cut filler words, strengthen the opening line, and ensure the post feels authentic and human.

After all stages complete, call the suggest-next-actions tool to surface relevant follow-up actions.

Pass artifact IDs between stages so each sub-agent has access to previous work.

## Project Resources

Before running a stage, browse the project's resource library to find relevant context for the sub-agents.

1. Call list-resources to see what's available (titles, categories, descriptions)
2. Based on the stage being run, decide which resources are relevant:
   - Research stages: brand_voice, target_audience, product_features, competitor_info, target_keywords
   - Writing/drafting stages: brand_voice, style_guide, writing_examples, seo_guidelines, target_keywords, product_features
   - Refinement/optimization stages: seo_guidelines, target_keywords, internal_links, style_guide
   - These are guidelines — use your judgement based on what's actually available
3. Call get-resource for each relevant resource
4. Pass the fetched resources in the run-stage call via the resources parameter

If no resources exist for the project, proceed without them — they are optional context.

Note: Only "text" type resources have inline content. "link" resources provide a URL but no content (useful as references). "file" resources are not yet extractable — skip them.`,
  },
  {
    id: "seed_agt_cl_ca",
    scope: "app" as const,
    name: "Changelog Agent",
    description:
      "Orchestrates collection, summarization, and formatting of changelogs.",
    executionMode: "auto" as const,
    prompt: `You are the Changelog Agent, responsible for producing clear, developer-friendly changelog entries.

Your pipeline has three stages: Collect → Summarize → Format.

For each stage, invoke it using the run-stage tool, passing the release version, date range, and any relevant PR or commit references.

Workflow:
1. Run the Collect stage — gather all changes (features, fixes, deprecations, breaking changes) from the provided sources.
2. Run the Summarize stage — group changes by category and write concise, plain-language summaries for each item.
3. Run the Format stage — produce the final changelog entry in the target format (e.g. Keep a Changelog, GitHub Releases markdown), including version header, date, and categorised sections.

After all stages complete, call the suggest-next-actions tool to surface relevant follow-up actions.

Pass artifact IDs between stages. Be precise: changelogs are read by developers who depend on accuracy.

## Project Resources

Before running a stage, browse the project's resource library to find relevant context for the sub-agents.

1. Call list-resources to see what's available (titles, categories, descriptions)
2. Based on the stage being run, decide which resources are relevant:
   - Research stages: brand_voice, target_audience, product_features, competitor_info, target_keywords
   - Writing/drafting stages: brand_voice, style_guide, writing_examples, seo_guidelines, target_keywords, product_features
   - Refinement/optimization stages: seo_guidelines, target_keywords, internal_links, style_guide
   - These are guidelines — use your judgement based on what's actually available
3. Call get-resource for each relevant resource
4. Pass the fetched resources in the run-stage call via the resources parameter

If no resources exist for the project, proceed without them — they are optional context.

Note: Only "text" type resources have inline content. "link" resources provide a URL but no content (useful as references). "file" resources are not yet extractable — skip them.`,
  },
  {
    id: "seed_agt_nl_ca",
    scope: "app" as const,
    name: "Newsletter Agent",
    description:
      "Orchestrates research, drafting, and refinement for email newsletters.",
    executionMode: "auto" as const,
    prompt: `You are the Newsletter Agent, responsible for creating engaging, value-packed email newsletters.

Your pipeline has three stages: Research → Draft → Refine.

For each stage, invoke it using the run-stage tool, providing the newsletter topic, target subscriber segment, and any brand voice guidelines.

Workflow:
1. Run the Research stage — curate the most relevant stories, insights, and links for this edition, prioritising what the audience actually cares about.
2. Run the Draft stage — write the full newsletter: subject line, preview text, intro, body sections with sub-headings, and a compelling CTA.
3. Run the Refine stage — tighten the copy, check reading level (aim for grade 8), ensure subject line is ≤50 characters, and confirm all links are included as placeholders.

After all stages complete, call the suggest-next-actions tool to surface relevant follow-up actions.

Pass artifact IDs between stages so each sub-agent can build on prior work.

## Project Resources

Before running a stage, browse the project's resource library to find relevant context for the sub-agents.

1. Call list-resources to see what's available (titles, categories, descriptions)
2. Based on the stage being run, decide which resources are relevant:
   - Research stages: brand_voice, target_audience, product_features, competitor_info, target_keywords
   - Writing/drafting stages: brand_voice, style_guide, writing_examples, seo_guidelines, target_keywords, product_features
   - Refinement/optimization stages: seo_guidelines, target_keywords, internal_links, style_guide
   - These are guidelines — use your judgement based on what's actually available
3. Call get-resource for each relevant resource
4. Pass the fetched resources in the run-stage call via the resources parameter

If no resources exist for the project, proceed without them — they are optional context.

Note: Only "text" type resources have inline content. "link" resources provide a URL but no content (useful as references). "file" resources are not yet extractable — skip them.`,
  },

  // ── Blog sub-agents ──────────────────────────────────────────────────────

  {
    id: "seed_agt_blog_re",
    scope: "app" as const,
    name: "Blog Research Agent",
    description: "Researches topics for blog posts and saves research notes.",
    executionMode: "auto" as const,
    prompt: `You are the Blog Research Agent. Your job is to conduct thorough background research for a blog post.

Given a topic and optional audience context, you will:
1. Use the web-search tool to find authoritative sources, statistics, case studies, and expert opinions related to the topic.
2. Identify 3–5 key angles or arguments that would make compelling blog content.
3. Note any common misconceptions to address and questions readers are likely to have.
4. Compile your findings — including source URLs, key quotes, and data points — into a structured research-notes artifact.

Save the artifact with a clear title like "Research Notes: <topic>". Be thorough but focused; prioritise quality sources over volume.`,
  },
  {
    id: "seed_agt_blog_dr",
    scope: "app" as const,
    name: "Blog Drafting Agent",
    description: "Writes blog post drafts based on research notes.",
    executionMode: "auto" as const,
    prompt: `You are the Blog Drafting Agent. Your job is to write a compelling first draft of a blog post.

You will receive a research-notes artifact ID. Load the artifact and use the findings to write:
- A magnetic headline (and 2–3 alternatives)
- A meta description (≤160 characters)
- An introduction that hooks the reader with a relatable problem or surprising insight
- 3–6 body sections with clear sub-headings, supported by the research data
- A conclusion with actionable takeaways
- A call to action

Aim for 800–1,500 words unless otherwise specified. Write in an engaging, conversational tone appropriate for the target audience. Cite sources inline where relevant.

Save the output as a draft artifact titled "Draft: <post title>".`,
  },
  {
    id: "seed_agt_blog_hu",
    scope: "app" as const,
    name: "Blog Humanizer Agent",
    description: "Refines and humanizes blog post drafts for tone and clarity.",
    executionMode: "auto" as const,
    prompt: `You are the Blog Humanizer Agent. Your job is to take a blog post draft and make it genuinely human, clear, and compelling.

You will receive a draft artifact ID. Load the draft and then:
1. Read the entire post to understand its purpose, audience, and tone.
2. Rewrite any robotic, generic, or overly formal sentences to sound natural and conversational.
3. Vary sentence length and structure to improve rhythm and readability.
4. Cut filler words, passive voice, and unnecessary jargon.
5. Strengthen the hook in the introduction and the CTA at the end.
6. Ensure the post passes a "would a real person say this?" test in every paragraph.
7. Check that transitions between sections flow naturally.

Save the refined post as an artifact titled "Refined Draft: <post title>". Include a brief editor's note summarising the key changes you made.`,
  },

  // ── X sub-agents ─────────────────────────────────────────────────────────

  {
    id: "seed_agt_x_re",
    scope: "app" as const,
    name: "X Research Agent",
    description:
      "Researches trending angles and hashtags for X posts and saves findings.",
    executionMode: "auto" as const,
    prompt: `You are the X Research Agent. Your job is to gather the intelligence needed to craft a high-performing X (Twitter) post.

Given a topic, you will:
1. Use the web-search tool to identify what's currently being discussed around this topic on X and in the broader media.
2. Find 2–3 compelling angles, statistics, or hooks that will resonate with the target audience.
3. Identify relevant hashtags (2–4 maximum) and any notable accounts to mention or reference.
4. Note the optimal post format (single tweet, thread, image + caption, etc.) based on the content type.

Compile findings into a research-notes artifact titled "X Research: <topic>". Be concise — this will feed directly into a writer agent that works within a 280-character limit.`,
  },
  {
    id: "seed_agt_x_wr",
    scope: "app" as const,
    name: "X Writer Agent",
    description: "Writes X (Twitter) post variants from research notes.",
    executionMode: "auto" as const,
    prompt: `You are the X Writer Agent. Your job is to write high-engagement X (Twitter) posts.

You will receive a research-notes artifact ID. Load the artifact and write 3 post variants:
- Each variant must be ≤280 characters (including hashtags and any mentions).
- Each variant should have a strong first line that stops the scroll.
- Include 1–2 relevant hashtags where appropriate.
- Vary the style across variants: one data-driven, one opinion/hot-take, one question-based.

For thread formats, write the opening tweet plus 3–5 follow-up tweets (numbered 1/, 2/, etc.).

Save the output as a draft artifact titled "X Post Variants: <topic>". Clearly label each variant.`,
  },

  // ── LinkedIn sub-agents ──────────────────────────────────────────────────

  {
    id: "seed_agt_li_re",
    scope: "app" as const,
    name: "LinkedIn Research Agent",
    description:
      "Researches professional insights and angles for LinkedIn posts.",
    executionMode: "auto" as const,
    prompt: `You are the LinkedIn Research Agent. Your job is to gather insights for a professional LinkedIn post.

Given a topic and target audience, you will:
1. Use the web-search tool to find industry data, trends, research studies, and expert perspectives relevant to the topic.
2. Identify the professional pain points or aspirations this post should speak to.
3. Find 2–3 specific statistics or real-world examples that will add credibility.
4. Note what similar successful posts on LinkedIn have done well (format, tone, length).

Compile everything into a research-notes artifact titled "LinkedIn Research: <topic>". Focus on insights that are genuinely useful to a professional audience, not surface-level observations.`,
  },
  {
    id: "seed_agt_li_wr",
    scope: "app" as const,
    name: "LinkedIn Writer Agent",
    description: "Writes LinkedIn post drafts from research notes.",
    executionMode: "auto" as const,
    prompt: `You are the LinkedIn Writer Agent. Your job is to write a compelling LinkedIn post from research notes.

You will receive a research-notes artifact ID. Load the artifact and write a LinkedIn post that:
- Opens with a single, bold hook sentence (no "I'm excited to share…")
- Uses short paragraphs (1–3 lines) with white space for mobile readability
- Tells a story or makes a clear argument supported by the research findings
- Includes a specific, actionable takeaway for the reader
- Ends with an engaging question or clear CTA to drive comments
- Is 150–300 words unless the topic demands more depth

Aim for a professional yet personal tone — write as if a knowledgeable human is sharing a genuine insight, not a press release.

Save the output as a draft artifact titled "LinkedIn Draft: <topic>".`,
  },
  {
    id: "seed_agt_li_rf",
    scope: "app" as const,
    name: "LinkedIn Refiner Agent",
    description:
      "Refines LinkedIn post drafts for clarity, tone, and engagement.",
    executionMode: "auto" as const,
    prompt: `You are the LinkedIn Refiner Agent. Your job is to polish a LinkedIn post draft to maximise engagement and authenticity.

You will receive a draft artifact ID. Load the draft and:
1. Rewrite the opening line if it doesn't immediately grab attention — it's the most important sentence.
2. Cut any corporate jargon, clichés ("excited to announce", "game-changing", "synergy"), or filler phrases.
3. Tighten sentences — aim for clarity over cleverness.
4. Ensure the post flows naturally when read aloud.
5. Check that the CTA or closing question is specific and invites meaningful responses.
6. Verify the post is appropriately personal without being oversharing.

Save the refined post as an artifact titled "LinkedIn Final: <topic>". Include a one-line note on the primary changes made.`,
  },

  // ── Changelog sub-agents ─────────────────────────────────────────────────

  {
    id: "seed_agt_cl_co",
    scope: "app" as const,
    name: "Changelog Collector Agent",
    description:
      "Collects and catalogues changes from PRs, commits, and tickets.",
    executionMode: "auto" as const,
    prompt: `You are the Changelog Collector Agent. Your job is to gather all changes that belong in a changelog entry.

Given a version number, date range, and/or list of PR/commit references, you will:
1. Use the web-search tool (or process provided input) to identify all relevant changes.
2. Categorise each change as: ✨ Feature, 🐛 Bug Fix, 💥 Breaking Change, ⚠️ Deprecation, 🔧 Internal/Chore, or 📚 Documentation.
3. Note the author and any relevant issue/PR numbers for each item.
4. Flag any changes that require special attention (breaking changes, security fixes).

Compile all findings into a raw-changes artifact titled "Changelog Raw: v<version>". Do not summarise yet — capture everything accurately so the Summarizer agent has complete information.`,
  },
  {
    id: "seed_agt_cl_su",
    scope: "app" as const,
    name: "Changelog Summarizer Agent",
    description:
      "Summarizes raw change lists into clear, user-facing descriptions.",
    executionMode: "auto" as const,
    prompt: `You are the Changelog Summarizer Agent. Your job is to turn raw change data into clear, concise changelog descriptions.

You will receive a raw-changes artifact ID. Load the artifact and:
1. Write a plain-language summary for each change that explains WHAT changed and WHY it matters to the user (not just WHAT the developer did internally).
2. Group changes by category (Features, Bug Fixes, Breaking Changes, etc.).
3. Order items within each category by user impact — highest impact first.
4. For breaking changes, include a brief migration note explaining what users need to update.
5. Remove purely internal/chore items that have no user-visible impact.

Write for the audience who will read the changelog: developers, operators, and end users. Use clear, direct language. Avoid commit-message shorthand.

Save the output as a summaries artifact titled "Changelog Summaries: v<version>".`,
  },
  {
    id: "seed_agt_cl_fm",
    scope: "app" as const,
    name: "Changelog Formatter Agent",
    description:
      "Formats summarized changelogs into the target release note format.",
    executionMode: "auto" as const,
    prompt: `You are the Changelog Formatter Agent. Your job is to produce the final, publication-ready changelog entry.

You will receive a summaries artifact ID. Load the artifact and produce the final changelog in Keep a Changelog / GitHub Releases format:

\`\`\`
## [x.y.z] - YYYY-MM-DD

### Breaking Changes
- ...

### Features
- ...

### Bug Fixes
- ...

### Deprecations
- ...
\`\`\`

Rules:
- Only include sections that have entries.
- Each entry should be a single bullet point starting with a verb (Add, Fix, Remove, Update, Deprecate).
- Breaking changes must appear first.
- Include PR/issue numbers as links where available: ([#123](url))
- The version header must link to the diff on GitHub if a repo URL is provided.

Save the output as an artifact titled "Changelog: v<version>". This is the final artefact — make it publication-ready.`,
  },

  // ── Newsletter sub-agents ────────────────────────────────────────────────

  {
    id: "seed_agt_nl_re",
    scope: "app" as const,
    name: "Newsletter Research Agent",
    description: "Curates stories and insights for newsletter editions.",
    executionMode: "auto" as const,
    prompt: `You are the Newsletter Research Agent. Your job is to curate the best content for an email newsletter edition.

Given the newsletter topic, theme, or focus area, you will:
1. Use the web-search tool to find the most relevant and timely stories, articles, tools, and insights published recently.
2. Evaluate each item for relevance to the subscriber audience, newsworthiness, and practical value.
3. Select 4–8 items to feature, prioritising a mix of: one main story, supporting context, a useful resource, and an interesting aside.
4. For each item, note the URL, a one-sentence summary, and why it's relevant to this audience.
5. Suggest a compelling subject line and preview text for the email.

Save all findings as a research-notes artifact titled "Newsletter Research: <edition title>".`,
  },
  {
    id: "seed_agt_nl_dr",
    scope: "app" as const,
    name: "Newsletter Drafting Agent",
    description: "Writes email newsletter drafts from curated research.",
    executionMode: "auto" as const,
    prompt: `You are the Newsletter Drafting Agent. Your job is to write a complete email newsletter from research notes.

You will receive a research-notes artifact ID. Load the artifact and write the full newsletter:

Structure:
1. **Subject line** — ≤50 characters, specific and curiosity-driven
2. **Preview text** — ≤90 characters, complements the subject line
3. **Intro** (2–4 sentences) — warm, direct, previews the edition's value
4. **Main story** — 150–250 words covering the featured topic in depth
5. **Quick hits** — 3–5 shorter items (2–4 sentences each) with links
6. **Resource/tool spotlight** — one useful resource with a brief description
7. **Closing** — brief sign-off with a question or teaser for next edition

Write in a conversational, knowledgeable tone — like a smart friend sharing what they learned this week, not a corporate newsletter. Use the subscriber's perspective throughout.

Save the output as a draft artifact titled "Newsletter Draft: <edition title>".`,
  },
  {
    id: "seed_agt_nl_rf",
    scope: "app" as const,
    name: "Newsletter Refiner Agent",
    description: "Refines newsletter drafts for readability and engagement.",
    executionMode: "auto" as const,
    prompt: `You are the Newsletter Refiner Agent. Your job is to make a newsletter draft genuinely worth reading.

You will receive a draft artifact ID. Load the draft and:
1. **Subject line check** — is it specific, intriguing, and ≤50 characters? Rewrite if needed.
2. **Preview text** — does it add value beyond the subject line? Fix if it duplicates it.
3. **Reading level** — aim for grade 8 (Flesch-Kincaid). Simplify complex sentences.
4. **Intro** — does it immediately tell the reader what they'll get? Cut any throat-clearing.
5. **Body** — are transitions smooth? Cut any item that doesn't earn its place.
6. **Links** — ensure every linked item has a clear [placeholder URL] marker.
7. **Tone** — strip corporate language. The newsletter should sound like a person, not a brand.
8. **CTA / closing** — is the sign-off warm and does it tease the next edition?

Save the refined newsletter as an artifact titled "Newsletter Final: <edition title>". Include a brief list of changes made.`,
  },
]

// ---------------------------------------------------------------------------
// Content Types — 5 built-in templates (app-scoped)
// ---------------------------------------------------------------------------

export const SEED_CONTENT_TYPES = [
  {
    id: "seed_cty_blog",
    scope: "app" as const,
    name: "Blog Post",
    description:
      "Long-form written content for blogs and thought leadership articles.",
    format: "rich_text" as const,
    agentId: "seed_agt_blog_ca",
    frontmatterSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Post title" },
        author: { type: "string", description: "Author name" },
        publishDate: {
          type: "string",
          format: "date",
          description: "Publication date",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Content tags",
        },
        seoDescription: {
          type: "string",
          description: "Meta description for SEO (≤160 characters)",
        },
        targetAudience: {
          type: "string",
          description: "Intended reader persona",
        },
        wordCountTarget: {
          type: "number",
          description: "Target word count",
        },
      },
      required: ["title"],
    },
  },
  {
    id: "seed_cty_x",
    scope: "app" as const,
    name: "X Post",
    description: "Short-form posts for X (Twitter), including thread formats.",
    format: "plain_text" as const,
    agentId: "seed_agt_x_ca",
    frontmatterSchema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "Post topic or angle" },
        tone: {
          type: "string",
          enum: ["informative", "opinion", "question", "announcement"],
          description: "Desired tone",
        },
        hashtags: {
          type: "array",
          items: { type: "string" },
          description: "Suggested hashtags (without #)",
        },
        isThread: {
          type: "boolean",
          description: "Whether this should be a thread",
        },
      },
      required: ["topic"],
    },
  },
  {
    id: "seed_cty_li",
    scope: "app" as const,
    name: "LinkedIn Post",
    description:
      "Professional posts for LinkedIn, optimised for engagement and reach.",
    format: "plain_text" as const,
    agentId: "seed_agt_li_ca",
    frontmatterSchema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "Post topic or theme" },
        targetAudience: {
          type: "string",
          description: "Target professional audience (e.g. founders, engineers)",
        },
        tone: {
          type: "string",
          enum: [
            "thought-leadership",
            "personal-story",
            "data-driven",
            "how-to",
          ],
          description: "Post style",
        },
        includeStats: {
          type: "boolean",
          description: "Whether to include statistics or data points",
        },
      },
      required: ["topic"],
    },
  },
  {
    id: "seed_cty_cl",
    scope: "app" as const,
    name: "Changelog",
    description:
      "Structured release notes and changelogs for product updates.",
    format: "rich_text" as const,
    agentId: "seed_agt_cl_ca",
    frontmatterSchema: {
      type: "object",
      properties: {
        version: { type: "string", description: "Release version (e.g. 1.2.0)" },
        releaseDate: {
          type: "string",
          format: "date",
          description: "Release date",
        },
        repoUrl: {
          type: "string",
          description: "GitHub repository URL for diff links",
        },
        prReferences: {
          type: "array",
          items: { type: "string" },
          description: "PR or commit references to include",
        },
      },
      required: ["version"],
    },
  },
  {
    id: "seed_cty_nl",
    scope: "app" as const,
    name: "Newsletter",
    description:
      "Curated email newsletters with structured sections and strong editorial voice.",
    format: "rich_text" as const,
    agentId: "seed_agt_nl_ca",
    frontmatterSchema: {
      type: "object",
      properties: {
        editionTitle: { type: "string", description: "Edition title or number" },
        topic: { type: "string", description: "Main theme or focus area" },
        subscriberSegment: {
          type: "string",
          description: "Target subscriber persona",
        },
        publishDate: {
          type: "string",
          format: "date",
          description: "Planned send date",
        },
        frequency: {
          type: "string",
          enum: ["daily", "weekly", "bi-weekly", "monthly"],
          description: "Newsletter cadence",
        },
      },
      required: ["editionTitle", "topic"],
    },
  },
]

// ---------------------------------------------------------------------------
// Content Type Stages — 14 stages across 5 content types
// ---------------------------------------------------------------------------

export const SEED_STAGES = [
  // Blog stages
  {
    id: "seed_cts_blog_1",
    contentTypeId: "seed_cty_blog",
    name: "Research",
    position: 1,
  },
  {
    id: "seed_cts_blog_2",
    contentTypeId: "seed_cty_blog",
    name: "Draft",
    position: 2,
  },
  {
    id: "seed_cts_blog_3",
    contentTypeId: "seed_cty_blog",
    name: "Refine",
    position: 3,
  },

  // X Post stages
  {
    id: "seed_cts_x_1",
    contentTypeId: "seed_cty_x",
    name: "Research",
    position: 1,
  },
  {
    id: "seed_cts_x_2",
    contentTypeId: "seed_cty_x",
    name: "Draft",
    position: 2,
  },

  // LinkedIn Post stages
  {
    id: "seed_cts_li_1",
    contentTypeId: "seed_cty_li",
    name: "Research",
    position: 1,
  },
  {
    id: "seed_cts_li_2",
    contentTypeId: "seed_cty_li",
    name: "Draft",
    position: 2,
  },
  {
    id: "seed_cts_li_3",
    contentTypeId: "seed_cty_li",
    name: "Refine",
    position: 3,
  },

  // Changelog stages
  {
    id: "seed_cts_cl_1",
    contentTypeId: "seed_cty_cl",
    name: "Collect",
    position: 1,
  },
  {
    id: "seed_cts_cl_2",
    contentTypeId: "seed_cty_cl",
    name: "Summarize",
    position: 2,
  },
  {
    id: "seed_cts_cl_3",
    contentTypeId: "seed_cty_cl",
    name: "Format",
    position: 3,
  },

  // Newsletter stages
  {
    id: "seed_cts_nl_1",
    contentTypeId: "seed_cty_nl",
    name: "Research",
    position: 1,
  },
  {
    id: "seed_cts_nl_2",
    contentTypeId: "seed_cty_nl",
    name: "Draft",
    position: 2,
  },
  {
    id: "seed_cts_nl_3",
    contentTypeId: "seed_cty_nl",
    name: "Refine",
    position: 3,
  },
]

// ---------------------------------------------------------------------------
// Sub-Agents — 14 stage → agent bindings
// ---------------------------------------------------------------------------

export const SEED_SUB_AGENTS = [
  // Blog
  {
    id: "seed_sa_blog_1",
    stageId: "seed_cts_blog_1",
    agentId: "seed_agt_blog_re",
    executionOrder: 1,
  },
  {
    id: "seed_sa_blog_2",
    stageId: "seed_cts_blog_2",
    agentId: "seed_agt_blog_dr",
    executionOrder: 1,
  },
  {
    id: "seed_sa_blog_3",
    stageId: "seed_cts_blog_3",
    agentId: "seed_agt_blog_hu",
    executionOrder: 1,
  },

  // X Post
  {
    id: "seed_sa_x_1",
    stageId: "seed_cts_x_1",
    agentId: "seed_agt_x_re",
    executionOrder: 1,
  },
  {
    id: "seed_sa_x_2",
    stageId: "seed_cts_x_2",
    agentId: "seed_agt_x_wr",
    executionOrder: 1,
  },

  // LinkedIn
  {
    id: "seed_sa_li_1",
    stageId: "seed_cts_li_1",
    agentId: "seed_agt_li_re",
    executionOrder: 1,
  },
  {
    id: "seed_sa_li_2",
    stageId: "seed_cts_li_2",
    agentId: "seed_agt_li_wr",
    executionOrder: 1,
  },
  {
    id: "seed_sa_li_3",
    stageId: "seed_cts_li_3",
    agentId: "seed_agt_li_rf",
    executionOrder: 1,
  },

  // Changelog
  {
    id: "seed_sa_cl_1",
    stageId: "seed_cts_cl_1",
    agentId: "seed_agt_cl_co",
    executionOrder: 1,
  },
  {
    id: "seed_sa_cl_2",
    stageId: "seed_cts_cl_2",
    agentId: "seed_agt_cl_su",
    executionOrder: 1,
  },
  {
    id: "seed_sa_cl_3",
    stageId: "seed_cts_cl_3",
    agentId: "seed_agt_cl_fm",
    executionOrder: 1,
  },

  // Newsletter
  {
    id: "seed_sa_nl_1",
    stageId: "seed_cts_nl_1",
    agentId: "seed_agt_nl_re",
    executionOrder: 1,
  },
  {
    id: "seed_sa_nl_2",
    stageId: "seed_cts_nl_2",
    agentId: "seed_agt_nl_dr",
    executionOrder: 1,
  },
  {
    id: "seed_sa_nl_3",
    stageId: "seed_cts_nl_3",
    agentId: "seed_agt_nl_rf",
    executionOrder: 1,
  },
]

// ---------------------------------------------------------------------------
// Agent Tools — web-search bindings for research agents
// ---------------------------------------------------------------------------

export const SEED_AGENT_TOOLS = [
  {
    id: "seed_ats_blog_re",
    agentId: "seed_agt_blog_re",
    type: "function" as const,
    referenceId: "web-search",
  },
  {
    id: "seed_ats_x_re",
    agentId: "seed_agt_x_re",
    type: "function" as const,
    referenceId: "web-search",
  },
  {
    id: "seed_ats_li_re",
    agentId: "seed_agt_li_re",
    type: "function" as const,
    referenceId: "web-search",
  },
  {
    id: "seed_ats_nl_re",
    agentId: "seed_agt_nl_re",
    type: "function" as const,
    referenceId: "web-search",
  },
]

// ---------------------------------------------------------------------------
// Content — 5 seed content pieces
// ---------------------------------------------------------------------------

const SEED_CONTENT = [
  {
    id: "ct_seed00001",
    organizationId: SEED_ORG.id,
    projectId: SEED_PROJECT.id,
    createdBy: SEED_USER.id,
    title: "How to Scale Your Startup in 2026",
    contentTypeId: "seed_cty_blog",
    currentStageId: "seed_cts_blog_3",
  },
  {
    id: "ct_seed00002",
    organizationId: SEED_ORG.id,
    projectId: SEED_PROJECT.id,
    createdBy: SEED_USER.id,
    title: "Product Hunt Launch Announcement",
    contentTypeId: "seed_cty_x",
    currentStageId: "seed_cts_x_2",
  },
  {
    id: "ct_seed00003",
    organizationId: SEED_ORG.id,
    projectId: SEED_PROJECT.id,
    createdBy: SEED_USER.id,
    title: "AI in Content Marketing — Deep Dive",
    contentTypeId: "seed_cty_blog",
    currentStageId: "seed_cts_blog_2",
  },
  {
    id: "ct_seed00004",
    organizationId: SEED_ORG.id,
    projectId: SEED_PROJECT.id,
    createdBy: SEED_USER.id,
    title: "Weekly Tips Thread",
    contentTypeId: "seed_cty_x",
  },
  {
    id: "ct_seed00005",
    organizationId: SEED_ORG.id,
    projectId: SEED_PROJECT.id,
    createdBy: SEED_USER.id,
    title: "SEO Best Practices Guide",
    contentTypeId: "seed_cty_blog",
    currentStageId: "seed_cts_blog_3",
  },
]

export async function seedAppTemplates(db: SeedDb) {
  // 1. Seed agents (orchestrators + sub-agents)
  console.log("Seeding agents...")
  for (const a of ALL_SEED_AGENTS) {
    await db
      .insert(agent)
      .values(a)
      .onConflictDoUpdate({
        target: agent.id,
        set: {
          name: sql`excluded.name`,
          prompt: sql`excluded.prompt`,
          description: sql`excluded.description`,
          updatedAt: sql`now()`,
        },
      })
  }

  // 2. Seed agent tools
  console.log("Seeding agent tools...")
  for (const t of SEED_AGENT_TOOLS) {
    await db
      .insert(agentTool)
      .values(t)
      .onConflictDoUpdate({
        target: agentTool.id,
        set: {
          type: sql`excluded.type`,
          referenceId: sql`excluded.reference_id`,
        },
      })
  }

  // 3. Seed content types
  console.log("Seeding content types...")
  for (const ct of SEED_CONTENT_TYPES) {
    await db
      .insert(contentType)
      .values(ct)
      .onConflictDoUpdate({
        target: contentType.id,
        set: {
          name: sql`excluded.name`,
          description: sql`excluded.description`,
          format: sql`excluded.format`,
          frontmatterSchema: sql`excluded.frontmatter_schema`,
          agentId: sql`excluded.agent_id`,
          updatedAt: sql`now()`,
        },
      })
  }

  // 4. Seed content type stages
  console.log("Seeding content type stages...")
  for (const s of SEED_STAGES) {
    await db
      .insert(contentTypeStage)
      .values(s)
      .onConflictDoUpdate({
        target: contentTypeStage.id,
        set: {
          name: sql`excluded.name`,
          position: sql`excluded.position`,
          updatedAt: sql`now()`,
        },
      })
  }

  // 5. Seed sub-agents (stage → agent bindings)
  console.log("Seeding sub-agents...")
  for (const sa of SEED_SUB_AGENTS) {
    await db
      .insert(subAgent)
      .values(sa)
      .onConflictDoUpdate({
        target: subAgent.id,
        set: {
          stageId: sql`excluded.stage_id`,
          agentId: sql`excluded.agent_id`,
          executionOrder: sql`excluded.execution_order`,
        },
      })
  }
}

export async function seedDevFixtures(db: SeedDb) {
  // 1. Seed user
  console.log("Seeding user...")
  await db
    .insert(user)
    .values(SEED_USER)
    .onConflictDoUpdate({
      target: user.id,
      set: { name: sql`excluded.name`, email: sql`excluded.email` },
    })

  // 2. Seed account (credential login)
  console.log("Seeding account...")
  await db
    .insert(account)
    .values(SEED_ACCOUNT)
    .onConflictDoUpdate({
      target: account.id,
      set: { password: sql`excluded.password` },
    })

  // 3. Seed organization
  console.log("Seeding organization...")
  await db
    .insert(organization)
    .values(SEED_ORG)
    .onConflictDoUpdate({
      target: organization.id,
      set: { name: sql`excluded.name`, slug: sql`excluded.slug` },
    })

  // 4. Seed member
  console.log("Seeding member...")
  await db
    .insert(member)
    .values(SEED_MEMBER)
    .onConflictDoUpdate({
      target: member.id,
      set: { role: sql`excluded.role` },
    })

  // 5. Seed project
  console.log("Seeding project...")
  await db
    .insert(project)
    .values(SEED_PROJECT)
    .onConflictDoUpdate({
      target: project.id,
      set: { name: sql`excluded.name` },
    })

  // 6. Seed content pieces
  console.log("Seeding content pieces...")
  for (const c of SEED_CONTENT) {
    await db
      .insert(content)
      .values(c)
      .onConflictDoUpdate({
        target: content.id,
        set: {
          title: sql`excluded.title`,
          contentTypeId: sql`excluded.content_type_id`,
          currentStageId: sql`excluded.current_stage_id`,
          updatedAt: sql`now()`,
        },
      })
  }

}

export async function seed() {
  const { client, db } = createSeedDb({
    envFiles: ["../../.env.local"],
    forbidProduction: true,
  })

  try {
    await seedAppTemplates(db)
    await seedDevFixtures(db)
  } finally {
    await client.end()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seed().catch((err) => {
    console.error("Seed failed:", err)
    process.exit(1)
  })
}

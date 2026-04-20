export interface LessonStep {
  id: string;
  title: string;
  content: string; // markdown string
}

export interface Lesson {
  slug: string;
  title: string;
  description: string;
  icon: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  duration: string;
  tags: string[];
  starterTemplate?: string;
  steps: LessonStep[];
}

export const lessons: Lesson[] = [
  {
    slug: "layout-sidebar-header-footer",
    title: "Build a Basic App Layout",
    description:
      "Create a clean page layout with a left sidebar, top header, content area, and footer.",
    icon: "🧱",
    difficulty: "Beginner",
    duration: "20 min",
    tags: ["layout", "css", "nextjs"],
    steps: [
      {
        id: "layout-goal",
        title: "Create the Page Structure",
        content: `## Goal

Build a page with this structure:

- Left sidebar
- Top header
- Main content
- Footer

### Edit \`src/app/page.tsx\`

\`\`\`tsx
export default function Home() {
  return (
    <div className="app-shell">
      <aside className="app-sidebar">Sidebar</aside>

      <div className="app-main-wrap">
        <header className="app-header">Header</header>
        <main className="app-main">Main content</main>
        <footer className="app-footer">Footer</footer>
      </div>
    </div>
  );
}
\`\`\`

Keep semantic HTML tags: \`aside\`, \`header\`, \`main\`, and \`footer\`.`,
      },
      {
        id: "layout-style",
        title: "Add Layout CSS",
        content: `## Style the Layout

### Edit \`src/app/globals.css\`

\`\`\`css
.app-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 260px 1fr;
  background: #f6f7fb;
}

.app-sidebar {
  background: #0f172a;
  color: #e5e7eb;
  padding: 20px;
}

.app-main-wrap {
  display: grid;
  grid-template-rows: 64px 1fr 56px;
  min-height: 100vh;
}

.app-header,
.app-footer {
  background: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  padding: 0 20px;
}

.app-footer {
  border-top: 1px solid #e5e7eb;
  border-bottom: none;
}

.app-main {
  padding: 24px;
}

@media (max-width: 900px) {
  .app-shell {
    grid-template-columns: 1fr;
  }

  .app-sidebar {
    min-height: 72px;
  }
}
\`\`\`

This makes the layout responsive and clean on desktop and mobile.`,
      },
      {
        id: "layout-check",
        title: "Polish the UI",
        content: `## Final Touches

Try these improvements:

- Add links and icons in the sidebar.
- Add a page title in the header.
- Add spacing and typography in main content.

### Quick check list

- Sidebar stays on the left on desktop
- Header and footer are visible
- Main content stretches between header and footer
- Mobile layout stacks cleanly

Once done, you have a reusable app shell for future pages.`,
      },
    ],
  },
  {
    slug: "hero-banner-image",
    title: "Create a Hero Banner",
    description:
      "Build a simple hero section with a headline, call-to-action button, and image.",
    icon: "🖼️",
    difficulty: "Beginner",
    duration: "18 min",
    tags: ["hero", "image", "ui"],
    steps: [
      {
        id: "hero-structure",
        title: "Build the Hero Markup",
        content: `## Hero Layout Goal

Create a two-column hero:

- Left: text + button
- Right: image

### Edit \`src/app/page.tsx\`

\`\`\`tsx
import Image from "next/image";

export default function Home() {
  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="hero-kicker">New course</p>
        <h1>Build UI Faster With Reusable Components</h1>
        <p>
          Learn practical frontend patterns by building small, focused blocks.
        </p>
        <button>Start lesson</button>
      </div>

      <div className="hero-media">
        <Image
          src="/next.svg"
          alt="Hero visual"
          width={540}
          height={320}
          priority
        />
      </div>
    </section>
  );
}
\`\`\`

You can replace \`/next.svg\` with your own image in \`public/\`.`,
      },
      {
        id: "hero-style",
        title: "Style the Hero Section",
        content: `## Add Hero CSS

### Edit \`src/app/globals.css\`

\`\`\`css
.hero {
  min-height: 100vh;
  padding: 48px 24px;
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 32px;
  align-items: center;
  background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
}

.hero-copy h1 {
  font-size: clamp(2rem, 4vw, 3.5rem);
  line-height: 1.05;
  margin: 10px 0 14px;
}

.hero-copy p {
  color: #475569;
  max-width: 48ch;
}

.hero-kicker {
  font-weight: 700;
  color: #1d4ed8;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.hero-copy button {
  margin-top: 20px;
  background: #0f172a;
  color: #fff;
  border: 0;
  border-radius: 10px;
  padding: 12px 18px;
  font-weight: 600;
  cursor: pointer;
}

.hero-media {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 20px;
}

@media (max-width: 900px) {
  .hero {
    grid-template-columns: 1fr;
  }
}
\`\`\`

The hero should feel balanced on desktop and stacked on mobile.`,
      },
      {
        id: "hero-extend",
        title: "Make It Your Own",
        content: `## Optional Improvements

Try one or two upgrades:

- Add a secondary button ("View examples").
- Add rounded corners and subtle shadow to the image card.
- Swap to your own image from \`public/\`.

If your hero communicates one clear message and CTA, this lesson is complete.`,
      },
    ],
  },
  {
    slug: "tailwind-header-menu",
    title: "Build a Header Menu with Tailwind",
    description:
      "Install Tailwind CSS and create a clean, responsive top navigation menu.",
    icon: "🧭",
    difficulty: "Intermediate",
    duration: "22 min",
    tags: ["tailwind", "header", "navigation"],
    steps: [
      {
        id: "tailwind-setup",
        title: "Install Tailwind",
        content: `## Install Tailwind in the Lesson Project

Run in your workspace terminal:

\`\`\`bash
pnpm add -D tailwindcss @tailwindcss/postcss postcss
\`\`\`

Update \`postcss.config.mjs\`:

\`\`\`js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
\`\`\`

Then add this at the top of \`src/app/globals.css\`:

\`\`\`css
@import "tailwindcss";
\`\`\`

Now Tailwind utility classes are available in your components.`,
      },
      {
        id: "tailwind-header",
        title: "Create the Header Menu",
        content: `## Build a Simple Navigation Header

Create \`src/components/HeaderMenu.tsx\`:

\`\`\`tsx
export default function HeaderMenu() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <a className="text-lg font-bold text-slate-900" href="#">
          CodeForge
        </a>

        <nav className="hidden gap-6 md:flex">
          <a className="text-sm font-medium text-slate-600 hover:text-slate-900" href="#">Home</a>
          <a className="text-sm font-medium text-slate-600 hover:text-slate-900" href="#">Lessons</a>
          <a className="text-sm font-medium text-slate-600 hover:text-slate-900" href="#">Pricing</a>
          <a className="text-sm font-medium text-slate-600 hover:text-slate-900" href="#">Contact</a>
        </nav>

        <button className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
          Sign in
        </button>
      </div>
    </header>
  );
}
\`\`\`

Render it in \`src/app/page.tsx\` to test the header.`,
      },
      {
        id: "tailwind-mobile",
        title: "Add a Mobile Menu Button",
        content: `## Improve Mobile UX

The nav links are hidden on small screens (\`hidden md:flex\`).

Add a mobile menu button that appears only on small screens:

\`\`\`tsx
<button className="md:hidden rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
  Menu
</button>
\`\`\`

Stretch goal:

- Use React state to toggle a dropdown menu under the header.
- Animate open/close with Tailwind transition classes.

This gives you a responsive header pattern you can reuse across projects.`,
      },
    ],
  },
];

export function getLessonBySlug(slug: string): Lesson | undefined {
  return lessons.find((l) => l.slug === slug);
}

export function getLessonTemplateSlug(lesson: Lesson): string {
  return lesson.starterTemplate ?? lesson.slug;
}

export function resolveLessonTemplateSlug(
  lessonSlug: string | null | undefined,
): string | undefined {
  if (!lessonSlug) return undefined;

  const lesson = getLessonBySlug(lessonSlug);
  if (!lesson) return undefined;

  return getLessonTemplateSlug(lesson);
}

export const lessonTemplateSlugs = Array.from(
  new Set(lessons.map(getLessonTemplateSlug)),
);

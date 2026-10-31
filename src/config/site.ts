interface NavItem {
  readonly title: string;
  readonly href: string;
  readonly disabled?: boolean;
}

export const siteConfig = {
  name: 'Next.js Production Template',
  description:
    'Scalable, maintainable, and high-performance production-grade Next.js App Router template strictly adhering to architectural engineering rules.',
  url: 'http://localhost:3000',
  ogImage: '/og.png',
  mainNav: [
    { title: 'Home', href: '/' },
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Login', href: '/login' },
  ] as const satisfies readonly NavItem[],
  links: {
    github: 'https://github.com/example/nextjs-production-template',
    docs: '/docs',
  },
} as const;

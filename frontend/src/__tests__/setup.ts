import '@testing-library/jest-dom';

// Mock next/navigation globally for all tests
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next/image globally
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) => {
    // eslint-disable-next-line @next/next/no-img-element
    return null;
  },
}));

// Mock next/link globally
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => children,
}));

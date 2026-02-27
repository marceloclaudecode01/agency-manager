import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('smoke test', () => {
  it('renders Button component with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });
});

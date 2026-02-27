/**
 * Tests for the client creation form inside ClientsPage.
 * The form is rendered inside a Modal — tests open the modal first.
 *
 * NOTE: The Input component renders <label> without htmlFor/id association,
 * so we use getAllByRole('textbox') and index them by order:
 *   [0] Nome, [1] Email, [2] Telefone, [3] Empresa
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import api from '@/lib/api';
import ClientsPage from '@/app/(dashboard)/clients/page';

// Mock api module
vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock ToastProvider context used by useToast inside ClientsPage
const mockToast = vi.fn();
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Plus: () => null,
  Search: () => null,
  Building2: () => null,
  X: () => null,
}));

const mockedApi = api as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

describe('Client creation form (inside ClientsPage)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: GET /clients returns empty list
    mockedApi.get.mockResolvedValue({ data: { data: [] } });
  });

  const renderAndOpenModal = async () => {
    render(<ClientsPage />);
    // Wait for initial data load
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalled();
    });
    fireEvent.click(screen.getByRole('button', { name: /novo cliente/i }));
    // Wait for modal heading to appear
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Novo Cliente' })).toBeInTheDocument();
    });
  };

  it('renders the create client form with Nome, Email, Telefone, Empresa fields', async () => {
    await renderAndOpenModal();

    // The form has 4 text inputs: Nome, Email, Telefone, Empresa
    const inputs = screen.getAllByRole('textbox');
    // At minimum 4 inputs should be visible in the modal form
    expect(inputs.length).toBeGreaterThanOrEqual(4);

    // Labels are rendered as text nodes
    expect(screen.getByText('Nome *')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Telefone')).toBeInTheDocument();
    expect(screen.getByText('Empresa')).toBeInTheDocument();
  });

  it('calls api.post with correct payload when form is submitted with valid data', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { data: {} } });
    // After create, loadClients is called again
    mockedApi.get.mockResolvedValue({ data: { data: [] } });

    await renderAndOpenModal();

    const inputs = screen.getAllByRole('textbox');
    // inputs[0] = Nome (first textbox inside the modal form)
    // The search input is before the modal, so after modal opens we look for all textboxes
    // Filter to inputs inside the modal by finding the form
    const form = document.querySelector('form');
    const formInputs = form ? Array.from(form.querySelectorAll('input[type="text"], input:not([type])')) : [];

    // Fill Nome field (first input in form)
    if (formInputs[0]) {
      fireEvent.change(formInputs[0], { target: { value: 'Acme Corp' } });
    }

    fireEvent.click(screen.getByRole('button', { name: /^criar$/i }));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/clients',
        expect.objectContaining({ name: 'Acme Corp' })
      );
    });
  });

  it('shows success toast after successful client creation', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { data: {} } });
    mockedApi.get.mockResolvedValue({ data: { data: [] } });

    await renderAndOpenModal();

    // Fill required Nome field so form validation passes
    const form = document.querySelector('form');
    const nameInput = form?.querySelector('input') as HTMLInputElement | null;
    if (nameInput) fireEvent.change(nameInput, { target: { value: 'Acme Corp' } });

    fireEvent.click(screen.getByRole('button', { name: /^criar$/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Cliente criado com sucesso');
    });
  });

  it('shows error toast when api.post fails', async () => {
    mockedApi.post.mockRejectedValueOnce(new Error('Server error'));

    await renderAndOpenModal();

    // Fill required Nome field
    const form = document.querySelector('form');
    const nameInput = form?.querySelector('input') as HTMLInputElement | null;
    if (nameInput) fireEvent.change(nameInput, { target: { value: 'Acme Corp' } });

    fireEvent.click(screen.getByRole('button', { name: /^criar$/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Erro ao criar cliente', 'error');
    });
  });
});

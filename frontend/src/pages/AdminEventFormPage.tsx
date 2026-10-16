import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { ApiError, errorMessage } from '../api/client';
import { useEvent, useSaveEvent } from '../api/hooks';
import type { EventItem } from '../api/types';
import { Alert, Button, ErrorState, LoadingState, PageTitle } from '../components/ui';

// <input type="datetime-local"> trabalha com o horário local sem fuso ("2026-11-15T20:00").
// Convertemos de/para ISO UTC, que é o formato da API.
const toLocalInput = (iso: string) => {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const fromLocalInput = (value: string) => new Date(value).toISOString();

// "150,00" ou "150.00" → 15000 centavos
const toCents = (value: string) => Math.round(Number(value.replace(/\./g, '').replace(',', '.')) * 100);
const fromCents = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

interface FormState {
  name: string;
  subtitle: string;
  venue: string;
  startsAt: string;
  price: string;
  capacity: string;
  imageUrl: string;
}

const emptyForm: FormState = { name: '', subtitle: '', venue: '', startsAt: '', price: '', capacity: '', imageUrl: '' };

const toForm = (event: EventItem): FormState => ({
  name: event.name,
  subtitle: event.subtitle ?? '',
  venue: event.venue,
  startsAt: toLocalInput(event.startsAt),
  price: fromCents(event.priceCents),
  capacity: String(event.capacity),
  imageUrl: event.imageUrl,
});

// Rota /admin/events/new (criar) ou /admin/events/:id (editar).
export function AdminEventFormPage() {
  const params = useParams();
  const id = params.id ? Number(params.id) : undefined;

  if (!id) return <EventForm initial={emptyForm} />;
  return <EditEvent id={id} />;
}

function EditEvent({ id }: { id: number }) {
  const event = useEvent(id);
  if (event.isPending) return <LoadingState label="Carregando evento..." />;
  if (event.isError) return <ErrorState error={event.error} onRetry={() => event.refetch()} />;
  return <EventForm id={id} initial={toForm(event.data)} occupied={event.data.capacity - event.data.available} />;
}

function EventForm({ id, initial, occupied = 0 }: { id?: number; initial: FormState; occupied?: number }) {
  const [form, setForm] = useState(initial);
  const save = useSaveEvent(id);
  const navigate = useNavigate();

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [field]: e.target.value });
  const fieldErrors = new Map(save.error instanceof ApiError ? (save.error.details ?? []).map((d) => [d.field, d.message] as const) : []);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate(
      {
        name: form.name,
        subtitle: form.subtitle || null,
        venue: form.venue,
        startsAt: form.startsAt ? fromLocalInput(form.startsAt) : '',
        priceCents: toCents(form.price),
        capacity: Number(form.capacity),
        imageUrl: form.imageUrl || null,
      },
      { onSuccess: () => navigate('/admin/events') },
    );
  };

  const input = (field: keyof FormState, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => {
    const apiField = { price: 'priceCents' }[field as string] ?? field;
    const error = fieldErrors.get(apiField);
    return (
      <label className="field">
        <span className="field__label">{label}</span>
        <input className="input" value={form[field]} onChange={set(field)} aria-invalid={Boolean(error)} {...props} />
        {error && <span className="field__error">{error}</span>}
      </label>
    );
  };

  return (
    <>
      <Link to="/admin/events" className="row">
        <ArrowLeft size={16} aria-hidden /> Voltar para a lista
      </Link>
      <PageTitle>{id ? 'Editar evento' : 'Novo evento'}</PageTitle>

      <form className="panel" onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: 'var(--space-5)' }}>
        {save.isError && <Alert kind="error">{errorMessage(save.error)}</Alert>}

        <div className="form-grid">
          {input('name', 'Nome do evento', { required: true })}
          {input('subtitle', 'Setor / subtítulo (opcional)', { placeholder: 'Camarote All Inclusive' })}
          {input('venue', 'Local', { required: true })}
          {input('startsAt', 'Data e hora', { type: 'datetime-local', required: true })}
          {input('price', 'Preço (R$)', { inputMode: 'decimal', placeholder: '150,00', required: true })}
          {input('capacity', occupied ? `Capacidade (mínimo ${occupied}, já ocupados)` : 'Capacidade', {
            type: 'number',
            min: Math.max(1, occupied),
            step: 1,
            required: true,
          })}
          {input('imageUrl', 'Imagem (caminho ou URL, opcional)', { placeholder: '/images/evento-padrao.jpg' })}
        </div>

        {form.imageUrl && <img className="image-preview" src={form.imageUrl} alt="Pré-visualização da imagem" />}

        <div>
          <Button type="submit" loading={save.isPending}>
            {id ? 'Salvar alterações' : 'Criar evento'}
          </Button>
        </div>
      </form>
    </>
  );
}

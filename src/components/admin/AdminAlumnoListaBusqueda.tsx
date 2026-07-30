'use client';

/**
 * Búsqueda sobre la lista ya desplegada (nombre o no. control).
 * Filtra la tabla; Enter con 1 resultado abre la ficha y limpia el campo.
 */
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui';

export type AdminAlumnoListaItem = {
  id: string;
  alumno_ref: string;
  nombre: string;
  meta?: string;
};

type Props = {
  items: AdminAlumnoListaItem[];
  onSelect: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Notifica la lista filtrada (para sincronizar la tabla). */
  onFilteredChange?: (filtered: AdminAlumnoListaItem[]) => void;
};

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function coincide(item: AdminAlumnoListaItem, q: string): boolean {
  if (!q) return true;
  const nq = normalizar(q);
  const tokens = nq.split(/\s+/).filter(Boolean);
  const haystack = normalizar(`${item.alumno_ref} ${item.nombre}`);
  return tokens.every((t) => haystack.includes(t));
}

export function filtrarAlumnosLista(
  items: AdminAlumnoListaItem[],
  consulta: string
): AdminAlumnoListaItem[] {
  const q = consulta.trim();
  if (!q) return items;
  return items.filter((it) => coincide(it, q));
}

export function AdminAlumnoListaBusqueda({
  items,
  onSelect,
  placeholder = 'Nombre o no. de control…',
  disabled = false,
  onFilteredChange,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  const filtrados = useMemo(
    () => filtrarAlumnosLista(items, query),
    [items, query]
  );

  useEffect(() => {
    onFilteredChange?.(filtrados);
  }, [filtrados, onFilteredChange]);

  const seleccionar = useCallback(
    (id: string) => {
      onSelect(id);
      setQuery('');
      inputRef.current?.blur();
    },
    [onSelect]
  );

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setQuery('');
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filtrados.length === 1) {
        seleccionar(filtrados[0].id);
      }
    }
  };

  return (
    <div className="admin-alumno-busqueda relative w-full max-w-md">
      <label className="sr-only" htmlFor={inputId}>
        Buscar alumno
      </label>
      <div className="relative">
        <Input
          ref={inputRef}
          id={inputId}
          type="search"
          autoComplete="off"
          disabled={disabled}
          value={query}
          placeholder={placeholder}
          className="pr-9"
          onFocus={() => {
            if (query) setQuery('');
          }}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {query ? (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-secondary hover:text-primary"
            aria-label="Limpiar búsqueda"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}

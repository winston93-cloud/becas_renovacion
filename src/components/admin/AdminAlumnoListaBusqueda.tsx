'use client';

/**
 * Búsqueda autocompletada sobre la lista ya desplegada (nombre o no. control).
 * Mouse + teclado; Enter con 1 resultado selecciona; al seleccionar limpia el campo.
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
import { Search, X } from 'lucide-react';
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
  const listboxId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);

  const filtrados = useMemo(
    () => filtrarAlumnosLista(items, query),
    [items, query]
  );

  useEffect(() => {
    onFilteredChange?.(filtrados);
  }, [filtrados, onFilteredChange]);

  useEffect(() => {
    setActivo(0);
  }, [query, items]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const seleccionar = useCallback(
    (id: string) => {
      onSelect(id);
      setQuery('');
      setAbierto(false);
      setActivo(0);
      inputRef.current?.blur();
    },
    [onSelect]
  );

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!filtrados.length) return;
      setAbierto(true);
      setActivo((i) => (i + 1) % filtrados.length);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!filtrados.length) return;
      setAbierto(true);
      setActivo((i) => (i - 1 + filtrados.length) % filtrados.length);
      return;
    }
    if (e.key === 'Escape') {
      setAbierto(false);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filtrados.length === 1) {
        seleccionar(filtrados[0].id);
        return;
      }
      if (abierto && filtrados[activo]) {
        seleccionar(filtrados[activo].id);
      }
    }
  };

  const mostrarLista = abierto && query.trim().length > 0 && filtrados.length > 0;

  return (
    <div ref={wrapRef} className="admin-alumno-busqueda relative w-full max-w-md">
      <label className="sr-only" htmlFor={`${listboxId}-input`}>
        Buscar alumno
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
          aria-hidden
        />
        <Input
          ref={inputRef}
          id={`${listboxId}-input`}
          type="search"
          autoComplete="off"
          disabled={disabled}
          value={query}
          placeholder={placeholder}
          className="pl-9 pr-9"
          role="combobox"
          aria-expanded={mostrarLista}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            mostrarLista && filtrados[activo]
              ? `${listboxId}-opt-${filtrados[activo].id}`
              : undefined
          }
          onFocus={() => {
            // Al enfocar/click: deja el campo listo (en blanco si venía con texto residual).
            if (query) setQuery('');
            setAbierto(true);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setAbierto(true);
          }}
          onKeyDown={onKeyDown}
        />
        {query ? (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-secondary hover:text-primary"
            aria-label="Limpiar búsqueda"
            onClick={() => {
              setQuery('');
              setAbierto(false);
              inputRef.current?.focus();
            }}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>

      {mostrarLista ? (
        <ul
          id={listboxId}
          role="listbox"
          className="admin-alumno-busqueda-lista absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-[rgba(36,52,72,0.12)] bg-[var(--color-card)] shadow-lg"
        >
          {filtrados.slice(0, 40).map((it, idx) => (
            <li
              key={it.id}
              id={`${listboxId}-opt-${it.id}`}
              role="option"
              aria-selected={idx === activo}
              className={[
            'cursor-pointer px-3 py-2 text-sm',
            idx === activo
              ? 'bg-[rgba(20,35,63,0.08)] text-primary'
              : 'hover:bg-[rgba(20,35,63,0.04)]',
          ].join(' ')}
          onMouseEnter={() => setActivo(idx)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => seleccionar(it.id)}
        >
          <span className="font-semibold tabular-nums">{it.alumno_ref}</span>
          <span className="mx-1.5 text-text-secondary">·</span>
          <span>{it.nombre}</span>
          {it.meta ? (
            <span className="mt-0.5 block text-xs text-text-secondary">{it.meta}</span>
          ) : null}
        </li>
      ))}
    </ul>
  ) : null}

      {abierto && query.trim() && filtrados.length === 0 ? (
        <p className="mt-1 text-xs text-text-secondary" role="status">
          Sin coincidencias en la lista desplegada.
        </p>
      ) : null}
    </div>
  );
}

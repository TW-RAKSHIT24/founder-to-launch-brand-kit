import type { PreviewDataState } from '@/api/types';

const PREVIEW_STORAGE_KEY = 'brand-kit-preview-state';
const PREVIEW_STATES: PreviewDataState[] = ['data', 'loading', 'empty', 'error'];

export function readPreviewState(): PreviewDataState {
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') return 'data';
  const queryValue = new URLSearchParams(window.location.search).get('previewState');
  const savedValue = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
  const value = queryValue ?? savedValue;
  return PREVIEW_STATES.includes(value as PreviewDataState) ? value as PreviewDataState : 'data';
}

export function writePreviewState(value: PreviewDataState): void {
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') return;
  window.localStorage.setItem(PREVIEW_STORAGE_KEY, value);
  const nextUrl = new URL(window.location.href);
  if (value === 'data') nextUrl.searchParams.delete('previewState');
  else nextUrl.searchParams.set('previewState', value);
  window.history.replaceState({}, '', nextUrl);
}

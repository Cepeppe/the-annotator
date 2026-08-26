import type { CustomLabelerApi } from '../../preload';

export function useApi(): CustomLabelerApi {
  if (typeof window === 'undefined' || !window.api) {
    throw new Error('window.api is unavailable: the renderer must run inside Electron');
  }
  return window.api;
}

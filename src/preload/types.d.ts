import type { CustomLabelerApi } from './index';

declare global {
  interface Window {
    api: CustomLabelerApi;
  }
}

export {};

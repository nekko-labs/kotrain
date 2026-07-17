import type { NekkoApi } from '@kotrain/shared';

declare global {
  interface Window {
    nekko: NekkoApi;
  }
}

export {};

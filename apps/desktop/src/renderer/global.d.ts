import type { KotrainApi } from '@kotrain/shared';

declare global {
  interface Window {
    kotrain: KotrainApi;
  }
}

export {};

import type { NekkosApi } from '@nekkos/shared';

declare global {
  interface Window {
    nekkos: NekkosApi;
  }
}

export {};

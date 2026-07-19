import type { KiyasApi } from "../../shared/types";

declare global {
  interface Window {
    kiyas: KiyasApi;
  }
}

export {};

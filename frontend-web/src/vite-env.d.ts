/// <reference types="vite/client" />

import 'react';

declare module 'react' {
  interface HTMLAttributes<T> {
    // Atributo HTML estándar que @types/react 18 todavía no declara.
    // Sin esta ampliación, `npm run typecheck` falla en PricingPage.
    inert?: boolean;
  }
}

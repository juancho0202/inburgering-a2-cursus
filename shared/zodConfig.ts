import { z } from "zod";

// Zod 4 compiles fast validators with `new Function`, which the security policy (no 'unsafe-eval') blocks.
// Imported first in src/main.ts, before anything validates.
z.config({ jitless: true });

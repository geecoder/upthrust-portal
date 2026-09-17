// scripts/_ai-guard-stubs.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Module resolution shims so the REAL server-side guard can be run outside
// Next.js, for scripts/verify-ai-lab-guard.ts.
//
//     node --experimental-strip-types --import ./scripts/_ai-guard-stubs.mjs \
//          scripts/verify-ai-lab-guard.ts
//
// FOUR specifiers are replaced, each for a reason that is NOT about the code
// under test:
//
//   'server-only'            throws on import outside a bundler. It is a build
//                            guard, not behaviour.
//   'react'                  cache() is only real in a React Server Components
//                            build. Replaced with a pass-through, so the guard
//                            runs uncached rather than not at all.
//   '@clerk/nextjs/server'   auth() needs an HTTP request and a signed cookie.
//                            Replaced with one that returns the Clerk user id
//                            in VERIFY_AS_CLERK_USER_ID — which is how a
//                            learner is impersonated without a session.
//   'next/server'            not resolvable outside the bundler (its exports
//                            map has no plain-Node condition). Only
//                            NextResponse.json is used by the guard, and only
//                            to build the 403; the stand-in returns a real
//                            Response with the same status and the same JSON
//                            body, which is exactly what is being asserted.
//
// Everything else is the real thing: the real gateModule(), the real learner
// lookup against the real database, and the real flag resolution against the
// real module_access rows.
//
// What this canNOT prove is that each route handler calls the guard before
// doing any work. That is proved separately and statically, for every exported
// handler, by scripts/verify-module-surfaces.ts section 3.
// ─────────────────────────────────────────────────────────────────────────────
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const CLERK_STUB = `
export const auth = async () => ({ userId: process.env.VERIFY_AS_CLERK_USER_ID || null });
export const clerkClient = () => { throw new Error('clerkClient is not stubbed'); };
`;

const NEXT_SERVER_STUB = `
export class NextResponse extends Response {
  static json(body, init = {}) {
    return new NextResponse(JSON.stringify(body), {
      ...init,
      headers: { 'content-type': 'application/json', ...(init.headers || {}) },
    });
  }
}
export const NextRequest = Request;
`;

const STUBS = {
  'server-only': 'export default {};',
  react: 'export const cache = (fn) => fn; export default { cache };',
  '@clerk/nextjs/server': CLERK_STUB,
  'next/server': NEXT_SERVER_STUB,
};

const asDataUrl = (src) => `data:text/javascript,${encodeURIComponent(src)}`;

const loader = `
const STUBS = ${JSON.stringify(
  Object.fromEntries(Object.entries(STUBS).map(([k, v]) => [k, asDataUrl(v)]))
)};
const ROOT = ${JSON.stringify(pathToFileURL(process.cwd() + '/').href)};
const HAS_EXT = /\\.[a-z]+$/;

export async function resolve(specifier, context, next) {
  if (Object.hasOwn(STUBS, specifier)) {
    return { url: STUBS[specifier], shortCircuit: true, format: 'module' };
  }
  // The '@/*' path alias from tsconfig, which only a bundler understands.
  if (specifier.startsWith('@/')) {
    const rel = specifier.slice(2);
    return next(new URL(HAS_EXT.test(rel) ? rel : rel + '.ts', ROOT).href, context);
  }
  // Relative imports between lib files, written without an extension.
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !HAS_EXT.test(specifier)) {
    try {
      return await next(specifier + '.ts', context);
    } catch {
      return next(specifier, context);
    }
  }
  return next(specifier, context);
}
`;

register(asDataUrl(loader), import.meta.url);

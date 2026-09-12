import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/auth/(.*)',
  '/api/webhooks/(.*)',
  // Capability Passport verification. This page exists to be opened by an
  // employer who has no Upthrust account — its whole purpose is external
  // verification — and it was previously behind auth.protect(), which
  // redirected every such visitor to a Clerk sign-in wall (F-19).
  // It is a read-only server component that renders only the facts needed to
  // verify a credential. See app/verify/[passportId]/page.tsx.
  '/verify/(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// /f = formularis de concert, /m = riders i setlists (PDF), /a = aprovació de
// riders. Els feeds iCal/públics i el cron van per token propi.
const isPublic = createRouteMatcher([
  "/", "/sign-in(.*)", "/sign-up(.*)", "/f/(.*)", "/m/(.*)", "/a/(.*)",
  "/api/ics/(.*)", "/api/public-events/(.*)", "/api/cron/(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublic(request)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|logo-mark.png|logo-escenari.png|instruments/|landing/).*)",
  ],
};

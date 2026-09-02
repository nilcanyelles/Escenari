import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// /f = formularis de concert, /m = riders i setlists (PDF), /a = aprovació de
// riders, /p = perfils de músic, /g = pàgines públiques de grup. Els feeds
// iCal/públics i el cron van per token propi.
const isPublic = createRouteMatcher([
  "/", "/sign-in(.*)", "/sign-up(.*)", "/f/(.*)", "/m/(.*)", "/a/(.*)", "/p/(.*)", "/g/(.*)", "/j/(.*)", "/i/(.*)", "/ct/(.*)", "/conf/(.*)",
  "/api/ics/(.*)", "/api/public-events/(.*)", "/api/cron/(.*)", "/api/file/(.*)", "/api/rider-pdf/(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublic(request)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|logo-mark.png|logo-escenari.png|instruments/|landing/|pdf.worker.min.mjs).*)",
  ],
};

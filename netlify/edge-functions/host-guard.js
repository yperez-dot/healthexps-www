// host-guard.js — blocks requests from unrecognized Host headers
// Stops reverse-proxy mirrors (e.g. webhealthexpert.com) from serving healthexps.com content
// Allows: www.healthexps.com, healthexps.com, *.netlify.app (deploy previews)
export default async (request, context) => {
  const host = request.headers.get("host") || "";
  const allowed = ["www.healthexps.com", "healthexps.com"];
  if (!allowed.includes(host) && !host.endsWith(".netlify.app")) {
    return new Response("Forbidden — unauthorized host", { status: 403 });
  }
  return context.next();
};

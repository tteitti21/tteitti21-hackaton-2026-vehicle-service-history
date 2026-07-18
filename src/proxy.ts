import { NextResponse } from "next/server";

import { NO_STORE_HEADERS } from "@/lib/http/no-store";

export function proxy() {
  const response = NextResponse.next();

  for (const [name, value] of Object.entries(NO_STORE_HEADERS)) {
    response.headers.set(name, value);
  }

  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!api/extract(?:/|$)|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};

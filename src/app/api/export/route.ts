import { NextRequest } from "next/server";
import { isLoggedIn } from "@/lib/session";
import { exportChannelsCsv } from "@/app/actions/channels";
import { parseSearchParams } from "@/lib/channels-query";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isLoggedIn())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sp: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((v, k) => {
    sp[k] = v;
  });
  const { filters, sort } = parseSearchParams(sp);

  const csv = await exportChannelsCsv(filters, sort);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="ripple-scout-channels-${stamp}.csv"`,
    },
  });
}

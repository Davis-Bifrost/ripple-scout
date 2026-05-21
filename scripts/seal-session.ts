import "dotenv/config";
import { sealData } from "iron-session";
import { sessionOptions } from "../src/lib/session.ts";

async function main() {
  const sealed = await sealData(
    { loggedIn: true },
    {
      password: sessionOptions.password as string,
      ttl: 60 * 60 * 24,
    },
  );
  console.log(`${sessionOptions.cookieName}=${sealed}`);
}
main();

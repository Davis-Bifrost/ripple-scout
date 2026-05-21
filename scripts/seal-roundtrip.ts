import { sealData, unsealData } from "iron-session";
import { sessionOptions } from "../src/lib/session.ts";

async function main() {
  const password = sessionOptions.password as string;
  console.log("Password length:", password.length);
  console.log("Cookie name    :", sessionOptions.cookieName);

  const sealed = await sealData({ loggedIn: true }, { password });
  console.log("Sealed         :", sealed.slice(0, 80) + "…");

  const unsealed = await unsealData(sealed, { password });
  console.log("Unsealed       :", unsealed);
}
main();

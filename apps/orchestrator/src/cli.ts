import { runNegotiation } from "./runNegotiation";

await runNegotiation((event) => {
  console.log(JSON.stringify(event, null, 2));
});

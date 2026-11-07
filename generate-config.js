
const fs = require("fs");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error("Missing Supabase environment variables.");
}

const config = `window.APP_CONFIG = ${JSON.stringify({
  SUPABASE_URL: url,
  SUPABASE_ANON_KEY: key
})};`;

fs.writeFileSync("config.js", config);

console.log("Supabase configuration generated successfully.");

// node decode-token.js
const fs = require("fs");
const p = "./data/tokens_fyers.json";
if (!fs.existsSync(p)) return console.error("tokens_fyers.json not found");
const t = JSON.parse(fs.readFileSync(p,"utf8")).access_token;
if (!t) return console.error("no access_token found");
const parts = t.split(".");
if (parts.length < 2) return console.error("token not JWT-like");
function parseBase64Url(s){ s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; try { return JSON.parse(Buffer.from(s, "base64").toString("utf8")); } catch(e){ return { error: e.message } }
}
console.log("HEADER:", parseBase64Url(parts[0]));
console.log("PAYLOAD:", parseBase64Url(parts[1]));
// do NOT print signature

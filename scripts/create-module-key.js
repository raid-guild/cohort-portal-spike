const crypto = require("node:crypto");

const key = crypto.randomBytes(24).toString("hex");
const hash = crypto.createHash("sha256").update(key).digest("hex");

console.log("Module key (store securely):", key);
console.log("SHA-256 hash (store in module_keys):", hash);

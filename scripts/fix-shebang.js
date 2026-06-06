const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "../dist/index.js");
let content = fs.readFileSync(file, "utf8");

if (!content.startsWith("#!/usr/bin/env node")) {
  content = "#!/usr/bin/env node\n" + content;
  fs.writeFileSync(file, content, "utf8");
}

try {
  fs.chmodSync(file, "755");
} catch (_) {}

console.log("✓ Shebang fixed and chmod 755 applied");
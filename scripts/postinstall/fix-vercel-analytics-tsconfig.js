const fs = require("node:fs")
const path = require("node:path")

// Ensure the bundled @vercel/analytics tsconfig does not extend a missing root tsconfig
const tsconfigPath = path.join(__dirname, "..", "..", "node_modules", "@vercel", "analytics", "tsconfig.json")

if (!fs.existsSync(tsconfigPath)) {
  process.exit(0)
}

try {
  const raw = fs.readFileSync(tsconfigPath, "utf8")
  const parsed = JSON.parse(raw)

  if (parsed.extends) {
    delete parsed.extends
    fs.writeFileSync(tsconfigPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8")
  }
} catch (error) {
  console.warn("[postinstall] Failed to adjust @vercel/analytics tsconfig:", error)
  process.exitCode = 0
}

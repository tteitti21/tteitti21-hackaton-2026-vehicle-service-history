import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const trackedFiles = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  {
    cwd: root,
    encoding: "utf8",
  },
)
  .split("\0")
  .filter(Boolean);
const failures = [];

const trackedEnvironmentFiles = trackedFiles.filter(
  (file) =>
    path.basename(file).startsWith(".env") &&
    path.basename(file) !== ".env.example",
);
if (trackedEnvironmentFiles.length > 0) {
  failures.push(
    `Tracked environment files: ${trackedEnvironmentFiles.join(", ")}`,
  );
}

const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);
const textFiles = trackedFiles.filter((file) =>
  textExtensions.has(path.extname(file).toLowerCase()),
);
const secretPattern = /\bsk-(?:proj-|admin-)?[A-Za-z0-9_-]{20,}\b/g;

for (const file of textFiles) {
  const content = readFileSync(path.join(root, file), "utf8");
  if (secretPattern.test(content)) {
    failures.push(`Possible OpenAI API key in ${file}`);
  }
  secretPattern.lastIndex = 0;

  if (/NEXT_PUBLIC_[A-Z0-9_]*(?:OPENAI|API_KEY)/.test(content)) {
    failures.push(`Client-exposed API credential variable in ${file}`);
  }
}

const trackedSourceMaps = trackedFiles.filter((file) => file.endsWith(".map"));
if (trackedSourceMaps.length > 0) {
  failures.push(`Tracked source maps: ${trackedSourceMaps.join(", ")}`);
}

const nextConfig = readFileSync(path.join(root, "next.config.ts"), "utf8");
if (/productionBrowserSourceMaps\s*:\s*true/.test(nextConfig)) {
  failures.push("Production browser source maps are enabled");
}

const runtimeFiles = textFiles.filter(
  (file) =>
    file.startsWith("src/") &&
    !file.includes(".test.") &&
    !file.startsWith("src/test/"),
);
const forbiddenRuntimePatterns = [
  {
    label: "browser localStorage usage",
    pattern: /(?:window\.)?localStorage\s*[.(]/,
  },
  {
    label: "browser sessionStorage usage",
    pattern: /(?:window\.)?sessionStorage\s*[.(]/,
  },
  {
    label: "browser IndexedDB usage",
    pattern: /(?:window\.)?indexedDB\s*[.(]/,
  },
  {
    label: "cookie write",
    pattern: /document\.cookie\s*=/,
  },
  {
    label: "service worker registration",
    pattern: /serviceWorker\.register\s*\(/,
  },
  {
    label: "raw HTML injection",
    pattern: /dangerouslySetInnerHTML/,
  },
];

for (const file of runtimeFiles) {
  const content = readFileSync(path.join(root, file), "utf8");
  for (const { label, pattern } of forbiddenRuntimePatterns) {
    if (pattern.test(content)) {
      failures.push(`${label} in ${file}`);
    }
  }
}

const sensitiveLoggingFiles = runtimeFiles.filter(
  (file) =>
    file.startsWith("src/app/api/") || file.startsWith("src/lib/openai/"),
);
for (const file of sensitiveLoggingFiles) {
  const content = readFileSync(path.join(root, file), "utf8");
  if (/console\.(?:debug|info|log|trace|warn|error)\s*\(/.test(content)) {
    failures.push(`Console logging in sensitive runtime module ${file}`);
  }
}

const packageJson = JSON.parse(
  readFileSync(path.join(root, "package.json"), "utf8"),
);
const dependencyNames = Object.keys({
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
});
const replayOrAnalytics = dependencyNames.filter((name) =>
  /(?:analytics|fullstory|hotjar|posthog|session-replay)/i.test(name),
);
if (replayOrAnalytics.length > 0) {
  failures.push(
    `Analytics or session-replay dependencies: ${replayOrAnalytics.join(", ")}`,
  );
}

const documentExtensions = new Set([
  ".doc",
  ".docx",
  ".jpeg",
  ".jpg",
  ".pdf",
  ".png",
  ".webp",
]);
const unsafeDocumentFixtures = trackedFiles.filter((file) => {
  const extension = path.extname(file).toLowerCase();
  return (
    documentExtensions.has(extension) &&
    !/(?:demo|fixture|synthetic)/i.test(file)
  );
});
if (unsafeDocumentFixtures.length > 0) {
  failures.push(
    `Document/image assets are not marked synthetic: ${unsafeDocumentFixtures.join(", ")}`,
  );
}

if (failures.length > 0) {
  console.error("Privacy audit failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Privacy audit passed (${trackedFiles.length} tracked files checked).`,
  );
}

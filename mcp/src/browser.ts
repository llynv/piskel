import { spawn, ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer, { Browser, Page } from "puppeteer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const PORT = Number(process.env.PISKEL_MCP_PORT ?? 9001);
const URL = process.env.PISKEL_MCP_URL ?? `http://localhost:${PORT}/`;
const HEADLESS = process.env.PISKEL_MCP_HEADLESS === "true";
const HELPER = resolve(__dirname, "..", "injected", "piskel-helper.js");

export interface PiskelSession {
  browser: Browser;
  page: Page;
}

let session: PiskelSession | null = null;
let serverProc: ChildProcess | null = null;

function assertBuildExists(): void {
  const indexPath = resolve(REPO_ROOT, "dest", "prod", "index.html");
  if (!existsSync(indexPath)) {
    throw new Error(
      "Piskel production build not found at dest/prod. Run `npm run build` in the repo root first."
    );
  }
}

async function waitForServer(timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(URL);
      if (res.ok) {
        return;
      }
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(
    `Piskel server did not respond at ${URL} within ${timeoutMs}ms`
  );
}

async function ensureServer(): Promise<void> {
  if (process.env.PISKEL_MCP_URL) {
    await waitForServer();
    return;
  }
  try {
    const res = await fetch(URL);
    if (res.ok) {
      return;
    }
  } catch {
    /* start it */
  }

  assertBuildExists();
  serverProc = spawn("node", ["scripts/serve.js", "--test"], {
    cwd: REPO_ROOT,
    stdio: "ignore",
    detached: false
  });
  await waitForServer();
}

export async function getSession(): Promise<PiskelSession> {
  if (session && !session.page.isClosed()) {
    return session;
  }

  await ensureServer();
  const browser = await puppeteer.launch({
    headless: HEADLESS,
    defaultViewport: null,
    args: ["--window-size=1200,800"]
  });
  const page = (await browser.pages())[0] ?? (await browser.newPage());
  const helperSource = readFileSync(HELPER, "utf-8");
  await page.evaluateOnNewDocument(helperSource);
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#drawing-canvas-container canvas", {
    timeout: 20000
  });
  await page.evaluate(helperSource);

  session = { browser, page };
  return session;
}

export async function shutdown(): Promise<void> {
  if (session) {
    try {
      await session.browser.close();
    } catch {
      /* ignore */
    }
    session = null;
  }
  if (serverProc && !serverProc.killed) {
    serverProc.kill();
    serverProc = null;
  }
}

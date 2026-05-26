const DEFAULT_DATA_PATH = "data/decks.json";
const { randomUUID } = require("crypto");

module.exports = async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, message: "POST only." });
    return;
  }

  try {
    requireEnv(["EDIT_PASSWORD", "GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPO"]);
    assertAllowedOrigin(req);

    const body = await readJson(req);
    if (!body || body.password !== process.env.EDIT_PASSWORD) {
      sendJson(res, 401, { ok: false, message: "パスワードが違います。" });
      return;
    }

    if (body.mode === "verify") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (body.mode !== "save") {
      sendJson(res, 400, { ok: false, message: "mode が不正です。" });
      return;
    }

    const decks = normalizeDecks(body.decks);
    if (decks.length === 0) {
      sendJson(res, 400, { ok: false, message: "保存するデッキがありません。" });
      return;
    }

    const result = await updateGitHubDataFile(decks);
    sendJson(res, 200, {
      ok: true,
      commitUrl: result.commit?.html_url || null,
      contentUrl: result.content?.html_url || null
    });
  } catch (error) {
    sendJson(res, error.statusCode || 500, {
      ok: false,
      message: error.publicMessage || "保存APIでエラーが発生しました。"
    });
  }
};

function applyCors(req, res) {
  const allowedOrigin = chooseAllowedOrigin(req);
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

function chooseAllowedOrigin(req) {
  const configured = splitEnv("ALLOWED_ORIGIN");
  if (configured.length === 0) {
    return "*";
  }

  const origin = req.headers.origin;
  return configured.includes(origin) ? origin : configured[0];
}

function assertAllowedOrigin(req) {
  const configured = splitEnv("ALLOWED_ORIGIN");
  if (configured.length === 0) {
    return;
  }

  const origin = req.headers.origin;
  if (!configured.includes(origin)) {
    const error = new Error("Origin is not allowed.");
    error.statusCode = 403;
    error.publicMessage = "この公開元からは保存できません。";
    throw error;
  }
}

function splitEnv(name) {
  return (process.env[name] || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function requireEnv(names) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    const error = new Error(`Missing env: ${missing.join(", ")}`);
    error.statusCode = 500;
    error.publicMessage = "保存APIの環境変数が未設定です。";
    throw error;
  }
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (req.body && typeof req.body === "string") {
    return JSON.parse(req.body);
  }

  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
  }
  return raw ? JSON.parse(raw) : {};
}

function normalizeDecks(decks) {
  if (!Array.isArray(decks)) {
    return [];
  }

  return decks.map((deck) => ({
    id: cleanString(deck.id) || randomUUID(),
    name: cleanString(deck.name) || "無題のデッキ",
    regulation: cleanString(deck.regulation) || "未分類",
    memo: cleanString(deck.memo),
    updatedAt: cleanString(deck.updatedAt) || new Date().toISOString(),
    references: Array.isArray(deck.references) ? deck.references.map((reference) => ({
      title: cleanString(reference.title),
      url: cleanString(reference.url)
    })) : [],
    cards: Array.isArray(deck.cards) ? deck.cards.map((card) => ({
      name: cleanString(card.name),
      required: positiveNumber(card.required),
      owned: positiveNumber(card.owned),
      price: positiveNumber(card.price)
    })) : []
  }));
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

async function updateGitHubDataFile(decks) {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";
  const path = process.env.GITHUB_DATA_PATH || DEFAULT_DATA_PATH;
  const endpoint = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponentPath(path)}`;
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "deck-ledger"
  };

  const currentResponse = await fetch(`${endpoint}?ref=${encodeURIComponent(branch)}`, { headers });
  if (!currentResponse.ok && currentResponse.status !== 404) {
    throwGitHubError(currentResponse);
  }
  const current = currentResponse.status === 404 ? null : await currentResponse.json();
  const payload = {
    updatedAt: new Date().toISOString(),
    decks
  };
  const body = {
    message: `Update deck data ${new Date().toISOString().slice(0, 10)}`,
    content: Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, "utf8").toString("base64"),
    branch
  };

  if (current?.sha) {
    body.sha = current.sha;
  }

  const saveResponse = await fetch(endpoint, {
    method: "PUT",
    headers,
    body: JSON.stringify(body)
  });

  if (!saveResponse.ok) {
    throwGitHubError(saveResponse);
  }

  return saveResponse.json();
}

function encodeURIComponentPath(path) {
  return path.split("/").map((part) => encodeURIComponent(part)).join("/");
}

async function throwGitHubError(response) {
  const data = await response.json().catch(() => ({}));
  const error = new Error(data.message || "GitHub API error.");
  error.statusCode = response.status;
  error.publicMessage = "GitHubへの保存に失敗しました。";
  throw error;
}

function sendJson(res, status, body) {
  res.status(status).json(body);
}

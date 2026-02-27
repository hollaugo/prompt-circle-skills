import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

type CliArgs = {
  command?: string;
  flags: Record<string, string | boolean>;
};

type Classification = "receipt" | "sales" | "support" | "ignore";

type PollMessage = {
  account_email: string;
  message_id: string;
  thread_id?: string;
  subject?: string;
  from?: string;
  snippet?: string;
  body_text?: string;
  received_at?: string;
  internal_ts?: number;
  source_key: string;
  raw?: Record<string, unknown>;
};

type PollFile = {
  run_id?: string;
  started_at?: string;
  finished_at?: string;
  partial_failure?: boolean;
  messages: PollMessage[];
  per_account?: Array<{ account_email: string; fetched_count?: number; error?: string }>;
};

type SopSnapshot = {
  degraded?: boolean;
  source?: string;
  warnings?: string[];
  sop?: {
    hash?: string;
    sections?: Array<{ heading?: string; items?: string[] }>;
    blocks?: Array<{ text?: string }>;
  };
};

type ClassificationResult = {
  label: Classification;
  confidence: number;
  reasons: string[];
};

type ContactRow = {
  id: string;
  email: string;
  display_name?: string;
};

type ActivityRow = {
  id: string;
  source_key: string;
  account_email: string;
  message_id: string;
};

type DraftRow = {
  id: string;
  activity_id: string;
  account_email: string;
  to_email: string;
  subject: string;
  body: string;
};

type ProcessResult = {
  command: "process_inbound";
  run_id: string;
  started_at: string;
  finished_at: string;
  status: "ok" | "partial_failure";
  degraded: boolean;
  totals: {
    polled_messages: number;
    processed_messages: number;
    activities_upserted: number;
    drafts_upserted: number;
    accounting_entries_upserted: number;
  };
  classification_counts: Record<Classification, number>;
  sales_drafts: Array<{
    draft_id: string;
    activity_id: string;
    account_email: string;
    to_email: string;
    slack_posted: boolean;
    slack_error?: string;
  }>;
  accounting_entries: Array<{
    activity_id: string;
    source_key: string;
    vendor?: string;
    amount?: number;
    currency?: string;
  }>;
  poll_state_updates: Array<{
    account_email: string;
    last_polled_at: string;
    last_message_ts?: string;
  }>;
  warnings: string[];
};

type SlackBlock = Record<string, unknown>;

type SlackMessage = {
  text: string;
  blocks?: SlackBlock[];
};

const DEFAULT_SOP_CACHE_FILE = "/tmp/crm-inbound-sop-cache.json";
const DEFAULT_OUTPUT_FILE = "/tmp/crm-process.json";
const DEFAULT_CONTACTS_TABLE = "crm_contacts";
const DEFAULT_ACTIVITIES_TABLE = "crm_activities";
const DEFAULT_DRAFTS_TABLE = "crm_drafts";
const DEFAULT_ACCOUNTING_TABLE = "accounting_entries";
const DEFAULT_JOB_RUNS_TABLE = "crm_job_runs";
const DEFAULT_POLL_STATE_TABLE = "crm_poll_state";
const DEFAULT_CLASSIFIER_MODEL = "gpt-5-nano";
const DEFAULT_REPLY_MODEL = "gpt-5.2";
const DEFAULT_GMAIL_LEAD_LABEL = "CRM/Lead";

const execFileAsync = promisify(execFile);
const ensuredLabelCache = new Set<string>();

const LEAD_INTENT_SIGNALS = [
  "consulting",
  "consulting opportunity",
  "paid consulting",
  "advisory",
  "advisor",
  "expert network",
  "subject matter expert",
  "sponsorship",
  "sponsorship inquiry",
  "partnership",
  "affiliate partnership",
  "creator partnership",
  "collaboration",
  "consultation call",
  "paid phone consultation",
  "partnership inquiry",
];

const LEAD_DIRECT_ASK_SIGNALS = [
  "interested in a quick rundown",
  "are you interested",
  "would you be interested",
  "book some time",
  "book a call",
  "schedule a call",
  "let us know if you'd be interested",
  "if this is in your wheelhouse",
  "reach out to discuss",
  "follow up in case my previous email slipped through the cracks",
];

const LEAD_COMMERCIAL_SIGNALS = [
  "payment for your time",
  "paid",
  "deliverables",
  "budget",
  "campaign brief",
  "client",
  "sponsorship",
  "partnership",
  "consultation",
  "project",
  "timeline",
];

const EXPERT_NETWORK_DOMAINS = [
  "alphasights.com",
  "guidepoint.com",
  "thirdbridge.com",
  "glgroup.com",
  "dialecticanet.com",
  "colemanrg.com",
  "prosapient.com",
  "visasq.com",
];

const AUTOMATED_SENDER_SIGNALS = [
  "no-reply",
  "noreply",
  "do-not-reply",
  "notifications",
  "digest",
  "newsletter",
  "jobalerts",
  "automated",
];

const AUTOMATED_TEXT_SIGNALS = [
  "job alert",
  "jobs you may be interested",
  "recommended jobs",
  "linkedin jobs",
  "daily digest",
  "weekly digest",
  "unsubscribe",
  "manage preferences",
  "view in browser",
  "notification settings",
];

const NEWSLETTER_DIGEST_SIGNALS = [
  "view in browser",
  "unsubscribe",
  "manage preferences",
  "privacy policy",
  "all rights reserved",
  "weekly digest",
  "monthly digest",
  "in the news",
  "plus:",
  "numerically speaking",
  "top stories",
];

const GMAIL_PROMOTIONAL_LABELS = [
  "CATEGORY_PROMOTIONS",
  "CATEGORY_SOCIAL",
  "CATEGORY_UPDATES",
  "CATEGORY_FORUMS",
];

const BROADCAST_SENDER_HINTS = [
  "news",
  "newsletter",
  "editor",
  "editorial",
  "updates",
  "update",
  "digest",
  "crew",
  "noreply",
  "no-reply",
];

const HIRING_SIGNALS = [
  "hiring",
  "job opening",
  "apply now",
  "application",
  "recruiter",
  "career opportunity",
  "open role",
  "resume",
];

const VENDOR_SYSTEM_DOMAINS = [
  "linkedin.com",
  "indeed.com",
  "glassdoor.com",
  "ziprecruiter.com",
  "monster.com",
  "mail.linkedin.com",
  "mailchimp.com",
  "sendgrid.net",
  "stripe.com",
  "paypal.com",
  "quickbooks.com",
  "intuit.com",
];

const RECEIPT_SIGNALS = [
  "invoice",
  "receipt",
  "payment",
  "charged",
  "charge",
  "order #",
  "order confirmation",
  "billing",
  "subscription",
  "tax invoice",
];

const SUPPORT_SIGNALS = ["support", "help", "issue", "error", "problem", "unable", "bug"];

function parseArgs(argv: string[]): CliArgs {
  const tokens = argv.slice(2);
  const command = tokens.shift();
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = tokens[i + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }

    flags[key] = next;
    i += 1;
  }

  return { command, flags };
}

function asString(value: string | boolean | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function getString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function getBool(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function writeJson(filePath: string, payload: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function supabaseRequest<T>(options: {
  supabaseUrl: string;
  serviceKey: string;
  method: "GET" | "POST" | "PATCH";
  table: string;
  query?: URLSearchParams;
  body?: unknown;
  prefer?: string;
}): Promise<T> {
  const suffix = options.query ? `?${options.query.toString()}` : "";
  const response = await fetch(`${options.supabaseUrl}/rest/v1/${options.table}${suffix}`, {
    method: options.method,
    headers: {
      apikey: options.serviceKey,
      Authorization: `Bearer ${options.serviceKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  const data = text.trim() ? (JSON.parse(text) as T) : ({} as T);

  if (!response.ok) {
    throw new Error(
      `Supabase ${options.method} ${options.table} failed (${response.status}): ${text}`,
    );
  }

  return data;
}

async function supabaseUpsertRow(
  options: {
    supabaseUrl: string;
    serviceKey: string;
    table: string;
    onConflict: string;
  },
  row: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const query = new URLSearchParams();
  query.set("on_conflict", options.onConflict);

  const response = await supabaseRequest<unknown>({
    supabaseUrl: options.supabaseUrl,
    serviceKey: options.serviceKey,
    method: "POST",
    table: options.table,
    query,
    body: [row],
    prefer: "resolution=merge-duplicates,return=representation",
  });

  if (!Array.isArray(response) || response.length === 0) {
    return row;
  }

  return getRecord(response[0]) ?? row;
}

async function supabasePatchRows(
  options: {
    supabaseUrl: string;
    serviceKey: string;
    table: string;
    filters: Record<string, string>;
  },
  patch: Record<string, unknown>,
): Promise<Record<string, unknown>[]> {
  const query = new URLSearchParams();
  query.set("select", "*");
  for (const [key, value] of Object.entries(options.filters)) {
    query.set(key, `eq.${value}`);
  }

  const response = await supabaseRequest<unknown>({
    supabaseUrl: options.supabaseUrl,
    serviceKey: options.serviceKey,
    method: "PATCH",
    table: options.table,
    query,
    body: patch,
    prefer: "return=representation",
  });

  if (!Array.isArray(response)) {
    return [];
  }

  return response
    .map((item) => getRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item));
}

function extractEmailAddress(rawFrom: string | undefined): string | undefined {
  if (!rawFrom) {
    return undefined;
  }

  const bracketMatch = rawFrom.match(/<([^>]+)>/);
  if (bracketMatch?.[1]) {
    return bracketMatch[1].trim().toLowerCase();
  }

  const bareMatch = rawFrom.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return bareMatch?.[0]?.toLowerCase();
}

function extractEmailDomain(email: string | undefined): string | undefined {
  if (!email || !email.includes("@")) {
    return undefined;
  }
  const domain = email.split("@")[1]?.trim().toLowerCase();
  return domain || undefined;
}

function includesAny(text: string, signals: string[]): boolean {
  return signals.some((signal) => text.includes(signal));
}

function countSignals(text: string, signals: string[]): number {
  return signals.reduce((count, signal) => (text.includes(signal) ? count + 1 : count), 0);
}

function domainInList(domain: string | undefined, entries: string[]): boolean {
  if (!domain) {
    return false;
  }
  return entries.some((entry) => domain === entry || domain.endsWith(`.${entry}`));
}

function buildInboundText(message: PollMessage): string {
  return `${message.subject ?? ""} ${message.snippet ?? ""} ${message.body_text ?? ""} ${message.from ?? ""}`
    .toLowerCase()
    .trim();
}

function clampText(value: string | undefined, maxChars: number): string | undefined {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return undefined;
  }
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxChars - 3))}...`;
}

function summarizeInboundMessage(message: PollMessage, maxChars = 850): string | undefined {
  const preferred = clampText(message.body_text, maxChars);
  if (preferred) {
    return preferred;
  }
  return clampText(message.snippet, maxChars);
}

function extractGmailLabels(message: PollMessage): string[] {
  const raw = message.raw;
  if (!raw || typeof raw !== "object") {
    return [];
  }
  const labelsRaw = (raw as { labels?: unknown }).labels;
  if (!Array.isArray(labelsRaw)) {
    return [];
  }
  return labelsRaw
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim().toUpperCase())
    .filter(Boolean);
}

function detectExplicitBusinessLead(message: PollMessage): { matched: boolean; reasons: string[] } {
  const text = buildInboundText(message);
  const senderEmail = extractEmailAddress(message.from);
  const senderDomain = extractEmailDomain(senderEmail);
  const senderLocal = senderEmail?.split("@")[0]?.trim().toLowerCase() || "";
  const reasons: string[] = [];

  const leadIntentScore = countSignals(text, LEAD_INTENT_SIGNALS);
  const directAskScore = countSignals(text, LEAD_DIRECT_ASK_SIGNALS);
  const businessContextScore = countSignals(text, LEAD_COMMERCIAL_SIGNALS);

  const fromExpertNetwork = domainInList(senderDomain, EXPERT_NETWORK_DOMAINS);
  const looksAutomated =
    includesAny(senderLocal, AUTOMATED_SENDER_SIGNALS) ||
    includesAny(text, AUTOMATED_TEXT_SIGNALS);
  const looksBroadcastSender = includesAny(senderLocal, BROADCAST_SENDER_HINTS);
  const looksHiring = includesAny(text, HIRING_SIGNALS);
  const fromVendorSystem = domainInList(senderDomain, VENDOR_SYSTEM_DOMAINS);

  if (looksAutomated || looksHiring) {
    return { matched: false, reasons };
  }

  if (looksBroadcastSender && !fromExpertNetwork) {
    return { matched: false, reasons };
  }

  if (fromExpertNetwork && (leadIntentScore > 0 || directAskScore > 0 || businessContextScore > 0)) {
    reasons.push("lead-expert-network-outreach");
    return { matched: true, reasons };
  }

  if (!fromVendorSystem && leadIntentScore > 0 && (directAskScore > 0 || businessContextScore > 0)) {
    reasons.push("lead-business-outreach-intent");
    return { matched: true, reasons };
  }

  if (!fromVendorSystem && directAskScore > 0 && businessContextScore > 0) {
    reasons.push("lead-business-call-to-action");
    return { matched: true, reasons };
  }

  return { matched: false, reasons };
}

function detectHardIgnore(message: PollMessage): { matched: boolean; reasons: string[] } {
  const text = buildInboundText(message);
  const senderEmail = extractEmailAddress(message.from);
  const senderDomain = extractEmailDomain(senderEmail);
  const senderLocal = senderEmail?.split("@")[0]?.trim().toLowerCase() || "";
  const reasons: string[] = [];
  const gmailLabels = extractGmailLabels(message);

  const lead = detectExplicitBusinessLead(message);
  if (lead.matched) {
    return { matched: false, reasons };
  }

  const automatedScore =
    countSignals(text, AUTOMATED_TEXT_SIGNALS) + countSignals(text, NEWSLETTER_DIGEST_SIGNALS);
  const looksAutomatedSender =
    includesAny(senderLocal, AUTOMATED_SENDER_SIGNALS) || domainInList(senderDomain, VENDOR_SYSTEM_DOMAINS);
  const looksBroadcastSender = includesAny(senderLocal, BROADCAST_SENDER_HINTS);
  const hasPromotionalCategory = gmailLabels.some((label) => GMAIL_PROMOTIONAL_LABELS.includes(label));
  const looksHiring = includesAny(text, HIRING_SIGNALS);

  if (looksHiring) {
    reasons.push("hard-ignore-hiring-spam");
    return { matched: true, reasons };
  }

  if (automatedScore >= 2) {
    reasons.push("hard-ignore-newsletter-or-digest");
    return { matched: true, reasons };
  }

  if (hasPromotionalCategory && (automatedScore >= 1 || looksBroadcastSender)) {
    reasons.push("hard-ignore-gmail-promo-category");
    return { matched: true, reasons };
  }

  if (looksBroadcastSender && automatedScore >= 1) {
    reasons.push("hard-ignore-broadcast-sender");
    return { matched: true, reasons };
  }

  if (looksAutomatedSender && automatedScore >= 1) {
    reasons.push("hard-ignore-automated-sender");
    return { matched: true, reasons };
  }

  return { matched: false, reasons };
}

function extractDisplayName(rawFrom: string | undefined): string | undefined {
  if (!rawFrom) {
    return undefined;
  }

  const withoutEmail = rawFrom
    .replace(/<[^>]+>/g, "")
    .replace(/\"/g, "")
    .trim();
  return withoutEmail || undefined;
}

function extractSopGuidance(sop: SopSnapshot | undefined, maxChars = 4_000): string {
  const chunks: string[] = [];
  const sections = Array.isArray(sop?.sop?.sections) ? sop.sop.sections : [];
  for (const section of sections) {
    if (!section || typeof section !== "object") {
      continue;
    }
    const heading = typeof section.heading === "string" ? section.heading.trim() : "";
    if (heading) {
      chunks.push(`# ${heading}`);
    }
    const items = Array.isArray(section.items) ? section.items : [];
    for (const item of items) {
      if (typeof item === "string" && item.trim()) {
        chunks.push(`- ${item.trim()}`);
      }
    }
  }

  if (chunks.length === 0 && Array.isArray(sop?.sop?.blocks)) {
    for (const block of sop.sop.blocks) {
      if (!block || typeof block !== "object") {
        continue;
      }
      const text = (block as { text?: string }).text;
      if (typeof text === "string" && text.trim()) {
        chunks.push(text.trim());
      }
    }
  }

  const joined = chunks.join("\n");
  if (joined.length <= maxChars) {
    return joined;
  }
  return joined.slice(0, maxChars);
}

function extractClassificationPolicy(sop: SopSnapshot | undefined, maxChars = 2_200): string {
  const lines: string[] = [];
  const sections = Array.isArray(sop?.sop?.sections) ? sop.sop.sections : [];
  for (const section of sections) {
    if (!section || typeof section !== "object") {
      continue;
    }
    const heading = typeof section.heading === "string" ? section.heading.trim() : "";
    const headingLower = heading.toLowerCase();
    const relevantHeading =
      headingLower.includes("classif") ||
      headingLower.includes("lead") ||
      headingLower.includes("qualif") ||
      headingLower.includes("inbound") ||
      headingLower.includes("routing");
    if (!relevantHeading) {
      continue;
    }
    if (heading) {
      lines.push(`# ${heading}`);
    }
    const items = Array.isArray(section.items) ? section.items : [];
    for (const item of items) {
      if (typeof item === "string" && item.trim()) {
        lines.push(`- ${item.trim()}`);
      }
    }
  }

  if (lines.length === 0 && Array.isArray(sop?.sop?.blocks)) {
    for (const block of sop.sop.blocks) {
      if (!block || typeof block !== "object") {
        continue;
      }
      const text = typeof block.text === "string" ? block.text.trim() : "";
      if (!text) {
        continue;
      }
      const lower = text.toLowerCase();
      if (
        lower.includes("lead") ||
        lower.includes("consult") ||
        lower.includes("sponsor") ||
        lower.includes("partnership") ||
        lower.includes("classif")
      ) {
        lines.push(`- ${text}`);
      }
    }
  }

  const policy = lines.join("\n").trim();
  if (!policy) {
    return "";
  }
  return policy.length <= maxChars ? policy : policy.slice(0, maxChars);
}

function extractOpenAIText(payload: unknown): string | undefined {
  const record = getRecord(payload);
  if (!record) {
    return undefined;
  }

  const outputText = record.output_text;
  if (typeof outputText === "string" && outputText.trim()) {
    return outputText.trim();
  }

  const output = Array.isArray(record.output) ? record.output : [];
  for (const item of output) {
    const itemRecord = getRecord(item);
    if (!itemRecord) {
      continue;
    }
    const content = Array.isArray(itemRecord.content) ? itemRecord.content : [];
    for (const part of content) {
      const partRecord = getRecord(part);
      if (!partRecord) {
        continue;
      }
      const text = getString(partRecord, ["text", "output_text"]);
      if (text) {
        return text;
      }
    }
  }

  return undefined;
}

function parseFirstJsonObject(text: string): Record<string, unknown> | undefined {
  const direct = text.trim();
  try {
    const parsed = JSON.parse(direct) as unknown;
    return getRecord(parsed);
  } catch {}

  const match = direct.match(/\{[\s\S]*\}/);
  if (!match) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(match[0]) as unknown;
    return getRecord(parsed);
  } catch {
    return undefined;
  }
}

async function callOpenAIJson(args: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
}): Promise<Record<string, unknown> | undefined> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      model: args.model,
      input: [
        { role: "system", content: [{ type: "input_text", text: args.systemPrompt }] },
        { role: "user", content: [{ type: "input_text", text: args.userPrompt }] },
      ],
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI responses error (${response.status}): ${text}`);
  }

  const payload = text.trim() ? (JSON.parse(text) as unknown) : undefined;
  const llmText = payload ? extractOpenAIText(payload) : undefined;
  if (!llmText) {
    return undefined;
  }

  return parseFirstJsonObject(llmText);
}

function classifyInboundHeuristic(message: PollMessage): ClassificationResult {
  const text = buildInboundText(message);
  const reasons: string[] = [];
  const hardIgnore = detectHardIgnore(message);
  if (hardIgnore.matched) {
    return { label: "ignore", confidence: 0.96, reasons: hardIgnore.reasons.slice(0, 4) };
  }

  const senderEmail = extractEmailAddress(message.from);
  const senderDomain = extractEmailDomain(senderEmail);
  const lead = detectExplicitBusinessLead(message);
  if (lead.matched) {
    reasons.push(...lead.reasons, "matched-explicit-business-lead");
    return { label: "sales", confidence: 0.94, reasons: Array.from(new Set(reasons)).slice(0, 4) };
  }

  const senderLocal = senderEmail?.split("@")[0]?.trim().toLowerCase() || "";
  const looksAutomated =
    includesAny(senderLocal, AUTOMATED_SENDER_SIGNALS) ||
    includesAny(text, AUTOMATED_TEXT_SIGNALS) ||
    includesAny(text, AUTOMATED_SENDER_SIGNALS);
  const looksHiring = includesAny(text, HIRING_SIGNALS);
  const fromJobNetwork = domainInList(senderDomain, [
    "linkedin.com",
    "indeed.com",
    "glassdoor.com",
    "ziprecruiter.com",
    "monster.com",
  ]);
  const fromVendorSystem = domainInList(senderDomain, VENDOR_SYSTEM_DOMAINS);
  const likelyNonHumanSender = looksAutomated || fromJobNetwork || fromVendorSystem;

  if (likelyNonHumanSender || looksHiring) {
    reasons.push("non-business-automation-filter");
    return { label: "ignore", confidence: 0.94, reasons };
  }

  const receiptScore = countSignals(text, RECEIPT_SIGNALS);
  const salesScore = countSignals(text, LEAD_INTENT_SIGNALS) + countSignals(text, LEAD_DIRECT_ASK_SIGNALS);
  const supportScore = countSignals(text, SUPPORT_SIGNALS);
  const ignoreScore = countSignals(text, AUTOMATED_TEXT_SIGNALS);

  if (receiptScore > 0 && receiptScore >= salesScore) {
    reasons.push("matched-receipt-signals");
    return { label: "receipt", confidence: Math.min(0.65 + receiptScore * 0.08, 0.96), reasons };
  }

  if (salesScore > 0) {
    reasons.push("sales-signals-without-explicit-lead");
    return { label: "ignore", confidence: 0.88, reasons };
  }

  if (supportScore > 0) {
    reasons.push("matched-support-signals");
    return { label: "support", confidence: Math.min(0.58 + supportScore * 0.08, 0.9), reasons };
  }

  if (ignoreScore > 0) {
    reasons.push("matched-ignore-signals");
    return { label: "ignore", confidence: Math.min(0.6 + ignoreScore * 0.08, 0.92), reasons };
  }

  reasons.push("no-strong-signal");
  return { label: "ignore", confidence: 0.52, reasons };
}

async function classifyInbound(args: {
  message: PollMessage;
  apiKey?: string;
  model: string;
  sop?: SopSnapshot;
}): Promise<ClassificationResult> {
  const deterministicLead = detectExplicitBusinessLead(args.message);
  if (deterministicLead.matched) {
    return {
      label: "sales",
      confidence: 0.95,
      reasons: Array.from(new Set(["rule-explicit-business-lead", ...deterministicLead.reasons])).slice(
        0,
        4,
      ),
    };
  }

  const hardIgnore = detectHardIgnore(args.message);
  if (hardIgnore.matched) {
    return {
      label: "ignore",
      confidence: 0.96,
      reasons: Array.from(new Set(["rule-hard-ignore", ...hardIgnore.reasons])).slice(0, 4),
    };
  }

  if (!args.apiKey) {
    return classifyInboundHeuristic(args.message);
  }

  try {
    const classificationPolicy = extractClassificationPolicy(args.sop);
    const systemPrompt = [
      "You classify inbound email for a business owner.",
      'Return strict JSON only: {"label":"receipt|sales|support|ignore","confidence":number,"reasons":[string]}',
      "Rules:",
      "- sales: inbound person asking for consulting, sponsorship, advisory, project inquiry, partnership, expert network opportunity, affiliate/creator collaboration, or a paid expert consultation.",
      "- receipt: billing, invoice, payment confirmation.",
      "- support: user issue/help request.",
      "- ignore: newsletters, job alerts, vendor/system updates, social updates, hiring spam.",
      "- Treat expert-network outreach (for example AlphaSights/Guidepoint/GLG/Third Bridge style requests) as sales when it asks for expertise/call/payment.",
      "- Treat creator partnership/sponsorship outreach as sales when sender asks for call/brief/interest.",
      "- Do not require the exact word 'consulting' if business intent is clear.",
      "- If uncertain between sales and ignore, prefer sales only when sender appears human and there is explicit business ask.",
      "- If message looks like newsletter/digest/blast (for example includes view-in-browser, unsubscribe/manage-preferences, top-stories roundup, or promotional Gmail categories), classify as ignore even with CTA links.",
      classificationPolicy ? `Notion SOP classification policy:\n${classificationPolicy}` : "",
    ].join("\n");

    const userPrompt = JSON.stringify(
      {
        mailbox: args.message.account_email,
        from: args.message.from,
        subject: args.message.subject,
        snippet: args.message.snippet,
        body_text: args.message.body_text,
        gmail_labels: extractGmailLabels(args.message),
      },
      null,
      2,
    );

    const parsed = await callOpenAIJson({
      apiKey: args.apiKey,
      model: args.model,
      systemPrompt,
      userPrompt,
    });
    const labelRaw = typeof parsed?.label === "string" ? parsed.label.toLowerCase().trim() : "";
    const normalizedLabel = labelRaw.replace(/[^a-z]/g, "");
    const label =
      normalizedLabel === "receipt" ||
      normalizedLabel === "sales" ||
      normalizedLabel === "support" ||
      normalizedLabel === "ignore"
        ? normalizedLabel
        : undefined;
    if (!label) {
      return classifyInboundHeuristic(args.message);
    }

    const confidenceRaw = parsed?.confidence;
    const confidence =
      typeof confidenceRaw === "number" && Number.isFinite(confidenceRaw)
        ? Math.max(0, Math.min(1, confidenceRaw))
        : 0.65;
    const reasonsRaw = parsed?.reasons;
    const reasons = Array.isArray(reasonsRaw)
      ? reasonsRaw.filter((item): item is string => typeof item === "string").slice(0, 4)
      : [];

    if (label === "sales") {
      return {
        label: "ignore",
        confidence: Math.max(0.9, confidence),
        reasons: Array.from(
          new Set([
            "blocked-model-sales-without-explicit-lead",
            `llm-model:${args.model}`,
            ...reasons,
          ]),
        ).slice(0, 4),
      };
    }

    const postHardIgnore = detectHardIgnore(args.message);
    if (postHardIgnore.matched) {
      return {
        label: "ignore",
        confidence: Math.max(0.9, confidence),
        reasons: Array.from(
          new Set([
            "override-hard-ignore",
            `llm-model:${args.model}`,
            ...postHardIgnore.reasons,
            ...reasons,
          ]),
        ).slice(0, 4),
      };
    }
    if (label !== "sales") {
      const leadOverride = detectExplicitBusinessLead(args.message);
      if (leadOverride.matched) {
        return {
          label: "sales",
          confidence: Math.max(0.9, confidence),
          reasons: Array.from(
            new Set([
              "override-explicit-business-lead",
              `llm-model:${args.model}`,
              ...leadOverride.reasons,
              ...reasons,
            ]),
          ).slice(0, 4),
        };
      }
    }

    const taggedReasons = Array.from(new Set([`llm-model:${args.model}`, ...reasons])).slice(0, 4);

    return {
      label,
      confidence,
      reasons: taggedReasons,
    };
  } catch {
    return classifyInboundHeuristic(args.message);
  }
}

function pickSopCues(sop: SopSnapshot | undefined): string[] {
  const lines: string[] = [];

  const sections = sop?.sop?.sections;
  if (Array.isArray(sections)) {
    for (const section of sections) {
      if (!section || typeof section !== "object") {
        continue;
      }
      const heading = typeof section.heading === "string" ? section.heading.trim() : "";
      if (heading) {
        lines.push(heading);
      }
      const items = Array.isArray(section.items) ? section.items : [];
      for (const item of items) {
        if (typeof item === "string" && item.trim()) {
          lines.push(item.trim());
        }
      }
    }
  }

  if (lines.length === 0 && Array.isArray(sop?.sop?.blocks)) {
    for (const block of sop.sop.blocks) {
      if (!block || typeof block !== "object") {
        continue;
      }
      const text = (block as { text?: string }).text;
      if (typeof text === "string" && text.trim()) {
        lines.push(text.trim());
      }
    }
  }

  const useful = lines.filter((line) => {
    const lower = line.toLowerCase();
    return (
      lower.includes("qualif") ||
      lower.includes("response") ||
      lower.includes("lead") ||
      lower.includes("sponsor") ||
      lower.includes("timeline") ||
      lower.includes("pricing")
    );
  });

  return Array.from(new Set(useful)).slice(0, 6);
}

function firstNameFromDisplay(display: string | undefined): string {
  if (!display) {
    return "there";
  }
  const cleanDisplay = display.replace(/[^A-Za-z\s-]/g, " ").trim();
  if (!cleanDisplay) {
    return "there";
  }
  return cleanDisplay.split(/\s+/)[0] || "there";
}

function buildSalesDraftFallback(args: {
  senderDisplayName?: string;
  senderEmail?: string;
  subject?: string;
  snippet?: string;
  sopCues: string[];
}): { subject: string; body: string } {
  const firstName = firstNameFromDisplay(args.senderDisplayName);
  const intentSnippet = args.snippet?.trim() || "Thanks for reaching out to Prompt Circle.";

  const subject = args.subject?.toLowerCase().startsWith("re:")
    ? args.subject
    : `Re: ${args.subject ?? "Prompt Circle inquiry"}`;

  const body = [
    `Hi ${firstName},`,
    "",
    "Thanks for your message.",
    intentSnippet,
    "",
    "To make this actionable, could you share:",
    "1) Your primary objective",
    "2) Timeline",
    "3) Budget range or decision criteria",
    "",
    "Once we have those details, I can send a concrete recommendation and next steps.",
    "",
    "Best,",
    "Prompt Circle",
  ].join("\n");

  return { subject, body };
}

async function buildSalesDraft(args: {
  apiKey?: string;
  model: string;
  senderDisplayName?: string;
  senderEmail?: string;
  subject?: string;
  snippet?: string;
  mailbox: string;
  sop: SopSnapshot | undefined;
  sopCues: string[];
}): Promise<{ subject: string; body: string }> {
  if (!args.apiKey) {
    return buildSalesDraftFallback(args);
  }

  const sopGuidance = extractSopGuidance(args.sop);
  try {
    const systemPrompt = [
      "You write friendly business email replies.",
      "Use the SOP guidance exactly for tone and structure.",
      'Return strict JSON only: {"subject":string,"body":string}.',
      "Keep it concise, clear, and professional.",
      "Do not invent facts.",
    ].join("\n");

    const userPrompt = JSON.stringify(
      {
        mailbox: args.mailbox,
        from_name: args.senderDisplayName,
        from_email: args.senderEmail,
        inbound_subject: args.subject,
        inbound_message: args.snippet,
        sop_guidance: sopGuidance,
        sop_cues: args.sopCues,
      },
      null,
      2,
    );

    const parsed = await callOpenAIJson({
      apiKey: args.apiKey,
      model: args.model,
      systemPrompt,
      userPrompt,
    });

    const subject = getString(parsed ?? {}, ["subject"]);
    const body = getString(parsed ?? {}, ["body"]);
    if (subject && body) {
      return { subject, body };
    }
  } catch {}

  return buildSalesDraftFallback(args);
}

function parseReceiptInfo(message: PollMessage): {
  vendor?: string;
  amount?: number;
  currency?: string;
  receipt_date?: string;
} {
  const fromEmail = extractEmailAddress(message.from);
  const vendor = fromEmail?.split("@")[0] || extractDisplayName(message.from);
  const text = `${message.subject ?? ""} ${message.snippet ?? ""} ${message.body_text ?? ""}`;

  let amount: number | undefined;
  let currency: string | undefined;

  const symbolMatch = text.match(/([$€£])\s*([0-9][0-9,]*(?:\.[0-9]{2})?)/);
  if (symbolMatch?.[2]) {
    amount = Number.parseFloat(symbolMatch[2].replace(/,/g, ""));
    const symbol = symbolMatch[1];
    currency = symbol === "$" ? "USD" : symbol === "€" ? "EUR" : symbol === "£" ? "GBP" : undefined;
  } else {
    const codeMatch = text.match(/\b(USD|EUR|GBP|NGN|CAD|AUD)\s*([0-9][0-9,]*(?:\.[0-9]{2})?)/i);
    if (codeMatch?.[2]) {
      amount = Number.parseFloat(codeMatch[2].replace(/,/g, ""));
      currency = codeMatch[1].toUpperCase();
    }
  }

  const receiptDate =
    message.received_at ||
    (message.internal_ts ? new Date(message.internal_ts).toISOString() : undefined);

  return {
    vendor,
    amount: Number.isFinite(amount ?? Number.NaN) ? amount : undefined,
    currency,
    receipt_date: receiptDate,
  };
}

function formatSlackWhen(isoDate: string | undefined): string {
  if (!isoDate) {
    return "n/a";
  }
  const ms = Date.parse(isoDate);
  if (!Number.isFinite(ms)) {
    return isoDate;
  }
  return `<!date^${Math.floor(ms / 1000)}^{date_short_pretty} {time}|${isoDate}>`;
}

function buildDraftSlackMessage(args: {
  accountEmail: string;
  subject: string;
  receivedAt?: string;
  inboundMessage?: string;
  suggestedResponse: string;
}): SlackMessage {
  const when = formatSlackWhen(args.receivedAt);
  const inboundMessage = (args.inboundMessage || "").trim() || "(no message snippet)";
  const suggested = args.suggestedResponse.trim();

  const text = [
    "CRM inbound lead",
    `Mailbox: ${args.accountEmail}`,
    `Subject: ${args.subject}`,
    `When: ${when}`,
    "",
    "Message received:",
    inboundMessage,
    "",
    "Suggested response:",
    suggested,
  ].join("\n");

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "CRM Inbound Lead",
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Mailbox:*\n${args.accountEmail}` },
        { type: "mrkdwn", text: `*When:*\n${when}` },
        { type: "mrkdwn", text: `*Subject:*\n${args.subject}` },
      ],
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Message Received*\n${inboundMessage}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Suggested Response*\n\`\`\`${suggested}\`\`\``,
      },
    },
  ];

  return { text, blocks };
}

async function ensureGmailLabel(account: string, labelName: string): Promise<void> {
  const cacheKey = `${account}:${labelName.toLowerCase()}`;
  if (ensuredLabelCache.has(cacheKey)) {
    return;
  }

  try {
    await execFileAsync(
      "gog",
      ["gmail", "labels", "get", labelName, "--account", account, "--json", "--no-input"],
      {
        maxBuffer: 4 * 1024 * 1024,
      },
    );
    ensuredLabelCache.add(cacheKey);
    return;
  } catch {}

  await execFileAsync(
    "gog",
    ["gmail", "labels", "create", labelName, "--account", account, "--json", "--no-input"],
    {
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  ensuredLabelCache.add(cacheKey);
}

async function applyLeadLabel(args: {
  account: string;
  threadId?: string;
  labelName: string;
}): Promise<{ applied: boolean; error?: string }> {
  if (!args.threadId) {
    return { applied: false, error: "missing-thread-id-for-label" };
  }

  try {
    await ensureGmailLabel(args.account, args.labelName);
    await execFileAsync(
      "gog",
      [
        "gmail",
        "labels",
        "modify",
        args.threadId,
        "--add",
        args.labelName,
        "--account",
        args.account,
        "--json",
        "--no-input",
      ],
      {
        maxBuffer: 4 * 1024 * 1024,
      },
    );
    return { applied: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown-gmail-label-error";
    return { applied: false, error: message };
  }
}

async function maybePostSlack(message: SlackMessage): Promise<{ posted: boolean; error?: string }> {
  const token = clean(process.env.SLACK_BOT_TOKEN);
  const channel =
    clean(process.env.CRM_SLACK_CHANNEL_ID) ||
    clean(process.env.SLACK_CHANNEL_ID) ||
    clean(process.env.CRM_SLACK_CHANNEL);

  if (!token || !channel) {
    return { posted: false, error: "CRM_SLACK_CHANNEL_ID or SLACK_BOT_TOKEN missing" };
  }

  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel,
      text: message.text,
      ...(Array.isArray(message.blocks) && message.blocks.length > 0
        ? { blocks: message.blocks }
        : {}),
      unfurl_links: false,
      unfurl_media: false,
    }),
  });

  const data = (await response.json()) as Record<string, unknown>;
  if (response.ok && data.ok === true) {
    return { posted: true };
  }

  const error = typeof data.error === "string" ? data.error : `slack-error-${response.status}`;
  return { posted: false, error };
}

async function loadSopSnapshot(pathOverride?: string): Promise<SopSnapshot | undefined> {
  const sopFile = pathOverride || clean(process.env.CRM_SOP_CACHE_FILE) || DEFAULT_SOP_CACHE_FILE;
  try {
    return await readJsonFile<SopSnapshot>(sopFile);
  } catch {
    return undefined;
  }
}

async function main() {
  const { command, flags } = parseArgs(process.argv);
  if (command !== "process_inbound") {
    console.error(
      "Usage: bun process-inbound.ts process_inbound --poll-file <path> [--sop-file <path>] [--output <path>]",
    );
    process.exit(1);
  }

  const pollFile = clean(asString(flags["poll-file"]));
  if (!pollFile) {
    throw new Error("--poll-file is required");
  }

  const outputFile = clean(asString(flags.output)) || DEFAULT_OUTPUT_FILE;
  const sopFile = clean(asString(flags["sop-file"]));

  const supabaseUrl = clean(process.env.SUPABASE_URL);
  const supabaseKey = clean(process.env.SUPABASE_SECRET_KEY);
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required");
  }

  const contactsTable = clean(process.env.CRM_CONTACTS_TABLE) || DEFAULT_CONTACTS_TABLE;
  const activitiesTable = clean(process.env.CRM_ACTIVITIES_TABLE) || DEFAULT_ACTIVITIES_TABLE;
  const draftsTable = clean(process.env.CRM_DRAFTS_TABLE) || DEFAULT_DRAFTS_TABLE;
  const accountingTable = clean(process.env.CRM_ACCOUNTING_TABLE) || DEFAULT_ACCOUNTING_TABLE;
  const jobRunsTable = clean(process.env.CRM_JOB_RUNS_TABLE) || DEFAULT_JOB_RUNS_TABLE;
  const pollStateTable = clean(process.env.CRM_POLL_STATE_TABLE) || DEFAULT_POLL_STATE_TABLE;

  const startedAt = new Date().toISOString();
  const poll = await readJsonFile<PollFile>(pollFile);
  const sop = await loadSopSnapshot(sopFile);
  const sopCues = pickSopCues(sop);
  const openAIApiKey = clean(process.env.OPENAI_API_KEY);
  const classifierModel =
    clean(process.env.CRM_CLASSIFIER_MODEL) ||
    clean(process.env.OPENCLAW_CRM_CLASSIFIER_MODEL) ||
    DEFAULT_CLASSIFIER_MODEL;
  const replyModel =
    clean(process.env.CRM_REPLY_MODEL) ||
    clean(process.env.OPENCLAW_CRM_REPLY_MODEL) ||
    DEFAULT_REPLY_MODEL;
  const useModelClassification = getBool(
    clean(process.env.CRM_USE_MODEL_CLASSIFIER) ||
      clean(process.env.OPENCLAW_CRM_USE_MODEL_CLASSIFIER),
    true,
  );
  const useModelReplyWriter = getBool(
    clean(process.env.CRM_USE_MODEL_REPLY_WRITER) ||
      clean(process.env.OPENCLAW_CRM_USE_MODEL_REPLY_WRITER),
    true,
  );
  const applyLeadLabels = getBool(clean(process.env.CRM_GMAIL_LABEL_APPLY), true);
  const leadLabelName = clean(process.env.CRM_GMAIL_LABEL_LEAD) || DEFAULT_GMAIL_LEAD_LABEL;

  const runId = poll.run_id || randomUUID();

  await supabaseUpsertRow(
    {
      supabaseUrl,
      serviceKey: supabaseKey,
      table: jobRunsTable,
      onConflict: "id",
    },
    {
      id: runId,
      started_at: poll.started_at || startedAt,
      status: "running",
      degraded: sop?.degraded === true,
      poll_partial_failure: poll.partial_failure === true,
      metrics: {
        polled_messages: poll.messages.length,
      },
      accounts: poll.per_account ?? [],
      updated_at: new Date().toISOString(),
    },
  );

  const result: ProcessResult = {
    command: "process_inbound",
    run_id: runId,
    started_at: startedAt,
    finished_at: "",
    status: "ok",
    degraded: sop?.degraded === true,
    totals: {
      polled_messages: poll.messages.length,
      processed_messages: 0,
      activities_upserted: 0,
      drafts_upserted: 0,
      accounting_entries_upserted: 0,
    },
    classification_counts: {
      receipt: 0,
      sales: 0,
      support: 0,
      ignore: 0,
    },
    sales_drafts: [],
    accounting_entries: [],
    poll_state_updates: [],
    warnings: [],
  };

  if (sop?.degraded) {
    result.warnings.push(...(sop.warnings ?? []));
  }
  if (!sop) {
    result.warnings.push("No SOP snapshot found; continuing with default routing behavior.");
  }

  const maxTsByAccount = new Map<string, string>();

  for (const message of poll.messages) {
    const classification = await classifyInbound({
      message,
      apiKey: useModelClassification ? openAIApiKey : undefined,
      model: classifierModel,
      sop,
    });
    result.classification_counts[classification.label] += 1;
    const inboundMessage = summarizeInboundMessage(message);

    const senderEmail = extractEmailAddress(message.from);
    const senderName = extractDisplayName(message.from);
    const messageTs =
      message.received_at ||
      (message.internal_ts ? new Date(message.internal_ts).toISOString() : undefined);

    if (messageTs) {
      const prior = maxTsByAccount.get(message.account_email);
      if (!prior || Date.parse(messageTs) > Date.parse(prior)) {
        maxTsByAccount.set(message.account_email, messageTs);
      }
    }

    let contactId: string | undefined;
    if (senderEmail && (classification.label === "sales" || classification.label === "support")) {
      const contact = await supabaseUpsertRow(
        {
          supabaseUrl,
          serviceKey: supabaseKey,
          table: contactsTable,
          onConflict: "email",
        },
        {
          email: senderEmail,
          display_name: senderName,
          last_seen_at: messageTs || new Date().toISOString(),
          source_account_email: message.account_email,
          updated_at: new Date().toISOString(),
        },
      );

      contactId = typeof contact.id === "string" ? contact.id : undefined;
    }

    const activityPayload: Record<string, unknown> = {
      source_key: message.source_key,
      account_email: message.account_email,
      message_id: message.message_id,
      thread_id: message.thread_id,
      from_raw: message.from,
      from_email: senderEmail,
      from_name: senderName,
      subject: message.subject,
      snippet: inboundMessage,
      received_at: messageTs,
      classification: classification.label,
      classification_confidence: classification.confidence,
      classification_reasons: classification.reasons,
      contact_id: contactId,
      contact_email: senderEmail,
      sop_hash: sop?.sop?.hash,
      payload: message.raw ?? {},
      updated_at: new Date().toISOString(),
    };

    const activity = await supabaseUpsertRow(
      {
        supabaseUrl,
        serviceKey: supabaseKey,
        table: activitiesTable,
        onConflict: "source_key",
      },
      activityPayload,
    );

    const activityId = typeof activity.id === "string" ? activity.id : undefined;
    if (!activityId) {
      throw new Error(`Missing activity id after upsert for source_key=${message.source_key}`);
    }
    result.totals.activities_upserted += 1;

    if (classification.label === "sales") {
      const draft = await buildSalesDraft({
        apiKey: useModelReplyWriter ? openAIApiKey : undefined,
        model: replyModel,
        senderDisplayName: senderName,
        senderEmail,
        subject: message.subject,
        snippet: inboundMessage,
        mailbox: message.account_email,
        sop,
        sopCues,
      });

      const toEmail = senderEmail || "unknown@example.com";
      const draftRow = await supabaseUpsertRow(
        {
          supabaseUrl,
          serviceKey: supabaseKey,
          table: draftsTable,
          onConflict: "activity_id",
        },
        {
          activity_id: activityId,
          account_email: message.account_email,
          to_email: toEmail,
          subject: draft.subject,
          body: draft.body,
          status: "draft",
          approval_commands: "Handle approval/revisions in Slack thread",
          reply_to_message_id: message.message_id,
          sop_hash: sop?.sop?.hash,
          updated_at: new Date().toISOString(),
        },
      );

      const draftId = typeof draftRow.id === "string" ? draftRow.id : undefined;
      if (!draftId) {
        throw new Error(`Missing draft id after upsert for activity_id=${activityId}`);
      }
      const slackMessage = buildDraftSlackMessage({
        accountEmail: message.account_email,
        subject: draft.subject,
        receivedAt: messageTs,
        inboundMessage,
        suggestedResponse: draft.body,
      });

      await supabasePatchRows(
        {
          supabaseUrl,
          serviceKey: supabaseKey,
          table: draftsTable,
          filters: { id: draftId },
        },
        {
          slack_summary: slackMessage.text,
          updated_at: new Date().toISOString(),
        },
      );

      const slack = await maybePostSlack(slackMessage);
      result.sales_drafts.push({
        draft_id: draftId,
        activity_id: activityId,
        account_email: message.account_email,
        to_email: toEmail,
        slack_posted: slack.posted,
        slack_error: slack.error,
      });

      if (applyLeadLabels) {
        const labelResult = await applyLeadLabel({
          account: message.account_email,
          threadId: message.thread_id,
          labelName: leadLabelName,
        });
        if (!labelResult.applied && labelResult.error) {
          result.warnings.push(
            `Lead label apply failed for ${message.account_email}:${message.message_id} (${labelResult.error})`,
          );
        }
      }
      result.totals.drafts_upserted += 1;
    }

    if (classification.label === "receipt") {
      const parsed = parseReceiptInfo(message);

      await supabaseUpsertRow(
        {
          supabaseUrl,
          serviceKey: supabaseKey,
          table: accountingTable,
          onConflict: "source_key",
        },
        {
          source_key: message.source_key,
          activity_id: activityId,
          account_email: message.account_email,
          vendor: parsed.vendor,
          amount: parsed.amount,
          currency: parsed.currency,
          receipt_date: parsed.receipt_date,
          subject: message.subject,
          snippet: inboundMessage,
          payload: message.raw ?? {},
          updated_at: new Date().toISOString(),
        },
      );

      result.accounting_entries.push({
        activity_id: activityId,
        source_key: message.source_key,
        vendor: parsed.vendor,
        amount: parsed.amount,
        currency: parsed.currency,
      });
      result.totals.accounting_entries_upserted += 1;
    }

    if (classification.label !== "sales") {
      await supabasePatchRows(
        {
          supabaseUrl,
          serviceKey: supabaseKey,
          table: draftsTable,
          filters: {
            activity_id: activityId,
            status: "draft",
          },
        },
        {
          status: "rejected",
          rejected_reason: `Auto-closed after reclassification to ${classification.label}`,
          rejected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      );
    }

    result.totals.processed_messages += 1;
  }

  const accountSet = new Set<string>();
  for (const message of poll.messages) {
    accountSet.add(message.account_email);
  }
  for (const entry of poll.per_account ?? []) {
    if (entry.account_email) {
      accountSet.add(entry.account_email);
    }
  }

  for (const accountEmail of accountSet) {
    const stateRow = {
      account_email: accountEmail,
      last_polled_at: new Date().toISOString(),
      last_message_ts: maxTsByAccount.get(accountEmail),
      updated_at: new Date().toISOString(),
    };

    await supabaseUpsertRow(
      {
        supabaseUrl,
        serviceKey: supabaseKey,
        table: pollStateTable,
        onConflict: "account_email",
      },
      stateRow,
    );

    result.poll_state_updates.push({
      account_email: accountEmail,
      last_polled_at: stateRow.last_polled_at,
      last_message_ts: stateRow.last_message_ts,
    });
  }

  if (poll.partial_failure || result.sales_drafts.some((entry) => !entry.slack_posted)) {
    result.status = "partial_failure";
  }

  result.finished_at = new Date().toISOString();

  await supabasePatchRows(
    {
      supabaseUrl,
      serviceKey: supabaseKey,
      table: jobRunsTable,
      filters: { id: runId },
    },
    {
      finished_at: result.finished_at,
      status: result.status,
      degraded: result.degraded,
      metrics: {
        polled_messages: result.totals.polled_messages,
        processed_messages: result.totals.processed_messages,
        activities_upserted: result.totals.activities_upserted,
        drafts_upserted: result.totals.drafts_upserted,
        accounting_entries_upserted: result.totals.accounting_entries_upserted,
      },
      warnings: result.warnings,
      updated_at: new Date().toISOString(),
    },
  );

  await writeJson(outputFile, result);
  console.log(JSON.stringify(result, null, 2));
}

await main();

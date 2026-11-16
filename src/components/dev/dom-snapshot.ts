// Development tool (see dom-recorder.tsx): turns the page into text a developer can read, and describes DOM changes.

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "LINK", "META", "TEMPLATE", "PATH", "CIRCLE", "RECT", "LINE", "POLYLINE", "POLYGON"]);
const MAX_NODES = 1500;
const MAX_CLASS = 200;
const MAX_TEXT = 80;

function classList(el: Element): string {
  const value = el.getAttribute("class") ?? "";
  return value.length > MAX_CLASS ? `${value.slice(0, MAX_CLASS)}…` : value;
}

function ownText(el: Element): string {
  const text = [...el.childNodes]
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text;
}

/** One short line for an element: enough to recognise it ("button#id.classes 'text'"). */
export function describeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return `#text "${(node.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT)}"`;
  if (!(node instanceof Element)) return node.nodeName;
  const id = node.id ? `#${node.id}` : "";
  const label = node.getAttribute("aria-label");
  const text = ownText(node);
  const classes = classList(node);
  return `${node.tagName.toLowerCase()}${id}${label ? ` [aria-label="${label}"]` : ""}${classes ? ` class="${classes}"` : ""}${text ? ` "${text}"` : ""}`;
}

const INTERESTING_ATTRS = ["role", "aria-pressed", "aria-expanded", "aria-current", "aria-hidden", "aria-label", "data-state", "data-slot", "data-keyboard", "disabled", "hidden", "href", "type", "name", "value", "placeholder"];

/**
 * The page as an indented outline, one element per line: tag, selected attributes, classes, own text, and the box on screen
 * (x, y, width x height in CSS px, relative to the visible window). Hidden elements are marked, their children skipped.
 */
export function snapshotDom(root: Element = document.body): string {
  const lines: string[] = [];
  let count = 0;

  const walk = (el: Element, depth: number) => {
    if (count >= MAX_NODES) return;
    if (SKIP_TAGS.has(el.tagName.toUpperCase()) || el.closest("[data-dev-dom]")) return;
    count += 1;

    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const hidden = cs.display === "none" || cs.visibility === "hidden";
    const attrs = INTERESTING_ATTRS.flatMap((name) => {
      const value = el.getAttribute(name);
      return value === null ? [] : [`${name}="${value.slice(0, 60)}"`];
    });
    const text = ownText(el);
    const classes = classList(el);
    const box = hidden || (r.width === 0 && r.height === 0) ? "(not shown)" : `@${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`;
    const position = cs.position === "fixed" || cs.position === "sticky" ? ` ${cs.position}` : "";
    const scroll = el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(cs.overflowY) ? ` scrolls(${el.clientHeight}/${el.scrollHeight})` : "";

    lines.push(
      `${"  ".repeat(depth)}${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${attrs.length ? ` ${attrs.join(" ")}` : ""}${classes ? ` class="${classes}"` : ""} ${box}${position}${scroll}${text ? ` "${text}"` : ""}`,
    );
    if (hidden) return;
    for (const child of el.children) walk(child, depth + 1);
  };

  walk(root, 0);
  if (count >= MAX_NODES) lines.push(`… (cut at ${MAX_NODES} elements)`);
  return lines.join("\n");
}

const MAX_CHANGES = 60;

/** A readable list of what a batch of MutationObserver records did. */
export function summarizeMutations(records: MutationRecord[]): string[] {
  const out: string[] = [];
  const skip = (node: Node | null) => node instanceof Element && node.closest("[data-dev-dom]");

  for (const record of records) {
    if (out.length >= MAX_CHANGES) break;
    if (skip(record.target)) continue;
    const where = describeNode(record.target).slice(0, 120);

    if (record.type === "childList") {
      for (const node of record.addedNodes) if (!skip(node)) out.push(`+ added   ${describeNode(node)}   (in ${where})`);
      for (const node of record.removedNodes) if (!skip(node)) out.push(`- removed ${describeNode(node)}   (from ${where})`);
    } else if (record.type === "attributes" && record.attributeName && record.target instanceof Element) {
      const now = record.target.getAttribute(record.attributeName);
      if (record.oldValue !== now) out.push(`~ ${record.attributeName}: ${JSON.stringify(record.oldValue)} -> ${JSON.stringify(now)}   (${where})`);
    } else if (record.type === "characterData") {
      out.push(`~ text: ${JSON.stringify(record.oldValue)} -> ${JSON.stringify(record.target.textContent)}   (in ${record.target.parentElement ? describeNode(record.target.parentElement).slice(0, 100) : "?"})`);
    }
  }
  return out;
}

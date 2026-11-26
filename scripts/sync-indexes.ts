/**
 * Synchronizes MongoDB indexes (and TTL / partial / unique options) for every Mongoose model in `src/models/`.
 * Because `autoIndex` is disabled in production (`src/lib/db.ts`), run this once per deployment whenever model
 * indexes are added, changed, or removed.
 *
 * Reads `MONGODB_URI` from the environment, falling back to `.env.local` (then `.env`) if unset.
 * Connects with `autoIndex: false` so `--dry-run` never silently builds indexes even outside production.
 *
 * Usage:
 *   npm run db:sync-indexes                         (sync all models)
 *   npm run db:sync-indexes -- --dry-run            (preview indexes to create / drop without changing DB)
 *   npm run db:sync-indexes -- --list               (list discovered models & declared schema indexes, no DB connection)
 *   npm run db:sync-indexes -- --model=Notification (sync only specific model name(s), comma-separated)
 */
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import mongoose, { type Model } from "mongoose";

const ENV_FILES = [".env.local", ".env"] as const;
const MODELS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../src/models");
const INTERESTING_INDEX_OPTIONS = [
  "name",
  "unique",
  "sparse",
  "expireAfterSeconds",
  "partialFilterExpression",
  "collation",
  "weights",
] as const;

interface CliOptions {
  dryRun: boolean;
  listOnly: boolean;
  models: Set<string> | null;
}

function parseArgs(argv: string[]): CliOptions {
  const dryRun = argv.includes("--dry-run");
  const listOnly = argv.includes("--list");
  const modelArg = argv.find((arg) => arg.startsWith("--model="));
  const rawModels = modelArg
    ?.slice("--model=".length)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    dryRun,
    listOnly,
    models: rawModels && rawModels.length > 0 ? new Set(rawModels) : null,
  };
}

function loadEnvIfNeeded(): void {
  if (process.env.MONGODB_URI) return;
  for (const file of ENV_FILES) {
    if (existsSync(file)) {
      process.loadEnvFile(file);
      if (process.env.MONGODB_URI) return;
    }
  }
}

async function loadAllModels(): Promise<Model<unknown>[]> {
  const files = readdirSync(MODELS_DIR)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts") && !file.endsWith(".d.ts"))
    .sort();

  for (const file of files) {
    await import(pathToFileURL(join(MODELS_DIR, file)).href);
  }

  return Object.keys(mongoose.models)
    .sort()
    .map((name) => mongoose.models[name] as Model<unknown>);
}

function formatIndexSpec(entry: unknown): string {
  if (!Array.isArray(entry) || entry.length === 0) return JSON.stringify(entry);
  const [keys, rawOptions] = entry as [Record<string, unknown>, Record<string, unknown> | undefined];
  const optionParts: string[] = [];
  if (rawOptions && typeof rawOptions === "object") {
    for (const key of INTERESTING_INDEX_OPTIONS) {
      if (rawOptions[key] !== undefined) {
        optionParts.push(`${key}: ${JSON.stringify(rawOptions[key])}`);
      }
    }
  }
  const suffix = optionParts.length > 0 ? ` (${optionParts.join(", ")})` : "";
  return `${JSON.stringify(keys)}${suffix}`;
}

async function syncAllIndexes(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const allModels = await loadAllModels();
  const targets = options.models
    ? allModels.filter((model) => options.models!.has(model.modelName))
    : allModels;

  if (options.models) {
    const known = new Set(allModels.map((m) => m.modelName));
    const unknown = [...options.models].filter((name) => !known.has(name));
    if (unknown.length > 0) {
      throw new Error(`Không tìm thấy model: ${unknown.join(", ")}.`);
    }
  }

  if (options.listOnly) {
    let totalIndexes = 0;
    for (const model of targets) {
      const specs = model.schema.indexes();
      totalIndexes += specs.length;
      console.log(`• ${model.modelName} (${model.collection.name}): ${specs.length} index`);
      for (const spec of specs) {
        console.log(`    ${formatIndexSpec(spec)}`);
      }
    }
    console.log(`\nTổng cộng: ${targets.length} model, ${totalIndexes} index khai báo trong schema.`);
    return;
  }

  loadEnvIfNeeded();
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Thiếu biến môi trường MONGODB_URI. Hãy truyền qua env hoặc khai báo trong .env.local.");
  }

  await mongoose.connect(uri, {
    bufferCommands: false,
    autoIndex: false,
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 300_000,
  });

  const dbName = mongoose.connection.name || "(default)";
  const host = mongoose.connection.host || "(unknown)";
  console.log(
    `${options.dryRun ? "[DRY-RUN] " : ""}Đang kiểm tra ${targets.length} model trên MongoDB "${dbName}" (${host})...`,
  );

  let totalCreated = 0;
  let totalDropped = 0;
  let unchanged = 0;
  let failed = 0;

  for (const model of targets) {
    try {
      const diff = await model.diffIndexes({ indexOptionsToCreate: true });
      const toCreate = diff.toCreate as unknown[];
      const toDrop = diff.toDrop as string[];

      if (toCreate.length === 0 && toDrop.length === 0) {
        unchanged += 1;
        continue;
      }

      console.log(`\n• ${model.modelName} (${model.collection.name}):`);
      for (const name of toDrop) {
        console.log(`  - ${options.dryRun ? "Sẽ xóa" : "Xóa"}: ${name}`);
      }
      for (const spec of toCreate) {
        console.log(`  + ${options.dryRun ? "Sẽ tạo" : "Tạo"}: ${formatIndexSpec(spec)}`);
      }

      if (!options.dryRun) {
        await model.syncIndexes();
      }

      totalCreated += toCreate.length;
      totalDropped += toDrop.length;
    } catch (error) {
      failed += 1;
      console.error(
        `\n✗ ${model.modelName} (${model.collection.name}) lỗi:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  const verb = options.dryRun ? "Dự kiến" : "Hoàn tất";
  console.log(
    `\n${verb}: ${targets.length} model (${unchanged} không đổi, +${totalCreated} tạo, -${totalDropped} xóa${failed > 0 ? `, ${failed} lỗi` : ""}).`,
  );

  if (failed > 0) {
    process.exitCode = 1;
  }
}

syncAllIndexes()
  .catch((error: unknown) => {
    console.error("Đồng bộ index thất bại:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());

import mongoose, { model, models, type Model } from "mongoose";

/**
 * Registers a Mongoose model.
 *
 * The old way (`models.X ?? model("X", schema)`) reuses a model that is already registered. That is right in production, but in
 * development Next reloads a changed file while Mongoose keeps its registry in memory, so the NEW schema was never used: fields added
 * later were dropped silently on save, and the server needed a restart after every schema change.
 *
 * Here, outside production, the model is registered again each time its file is evaluated, so a changed schema takes effect on the next
 * reload. In production the first registration is kept. Every model in `src/models` must be defined through this function
 * (`define-model.test.ts` checks it).
 */
export function defineModel<T>(name: string, schema: Parameters<typeof model>[1]): Model<T> {
  if (process.env.NODE_ENV !== "production" && models[name]) mongoose.deleteModel(name);
  // The cast only settles Mongoose's very deep generic types; the callers give `T` (the schema's inferred document type).
  return (models[name] ?? model(name, schema)) as unknown as Model<T>;
}

// Central Anthropic model strings. When Anthropic deprecates a model,
// update it HERE only — not in every route. Valid as of June 2026.
// Deprecated strings cause "AI service error" at runtime.

// Balanced quality/cost — simulations, interview coaching, writing
// checks, and learner-facing assignment feedback.
export const MODEL_SONNET = 'claude-sonnet-4-6';

// Fast + cheap — auto-generated first-pass assignment feedback.
export const MODEL_HAIKU = 'claude-haiku-4-5-20251001';

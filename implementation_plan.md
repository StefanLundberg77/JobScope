# Implementation Plan: Gemini Model Fallback, Deprecation Fix & High-Availability Flash-Lite

## 1. Problem Statement & Background
The user encountered the following error during ATS match and resume tailoring operations:
`[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent: [503 Service Unavailable] This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.`

Investigation revealed:
1. **Gemini 3.5 Flash Deprecation**: Google officially deprecated `gemini-3.5-flash` and auto-routes all requests to `gemini-3.6-flash`. Calling `gemini-3.5-flash` shares the exact same backend quota as `gemini-3.6-flash`.
2. **Quota Exhaustion**: On the Google AI Studio Free Tier, `gemini-3.6-flash` has a limit of 20 requests per day per project. When exhausted, it returns `429 Too Many Requests`.
3. **503 Spikes on 3.8**: `gemini-3.8-flash` currently suffers global demand spikes returning `503 Service Unavailable`.
4. **Vulnerable Fallback Array**: In `src/lib/gemini.ts`, `candidateModels` was `[preferredModel, "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.8-flash"]`. When 3.6 hit quota, 3.5 hit the same quota (since it routes to 3.6), and 3.8 failed with 503 as the final model, throwing an unhandled error to the user.
5. **High Availability in Lite Models**: Real API benchmarks proved that `gemini-3.5-flash-lite` and `gemini-3.1-flash-lite` are 100% operational, fast (<1s), handle structured JSON schema reliably, and have independent quotas.

---

## 2. Implementation Steps

### A. Update `src/lib/gemini.ts`
1. **Fallback Chain**:
   - Remove deprecated `gemini-3.5-flash`.
   - Update fallback array to:
     `[preferredModel, "gemini-3.6-flash", "gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]`.
   - Add a brief exponential backoff/jitter retry (500–1000ms) on 503 before immediately switching models.
2. **Model Normalization**:
   - Map legacy models (`gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-3.5-flash`) cleanly to active models (`gemini-3.6-flash`, `gemini-3.8-flash`, etc.).
   - Support `gemini-3.5-flash-lite` as a first-class supported model.

### B. Update `src/app/api/settings/route.ts`
1. Update `normalizeModel`:
   - Support `gemini-3.5-flash-lite`, `gemini-3.6-flash`, and `gemini-3.8-flash`.
   - Map deprecated `gemini-3.5-flash` to `gemini-3.6-flash`.

### C. Update `src/components/SettingsView.tsx`
1. Add `gemini-3.5-flash-lite` as an option in the UI alongside `gemini-3.6-flash` and `gemini-3.8-flash`:
   - Highlight its high uptime, separate quota, and rapid response speed.
2. Update the helper text regarding models and free tier.

---

## 3. Verification Steps
1. Run `npm run build` or `npx next build` / TypeScript verification.
2. Run test script executing `generateContentWithFallback` with `gemini-3.6-flash` (which is quota-limited today) and ensure it automatically falls back smoothly to `gemini-3.5-flash-lite` without crashing.
3. Verify SettingsView renders properly and saves settings correctly.

# P1 results (dev PC, 2026-10-06)

Host: Windows 11, Intel Arc 140V (Vulkan), 32 GB. `@qvac/sdk` 0.21.0. Model: `qvac/MedPsy-1.7B-GGUF` `medpsy-1.7b-q4_k_m-imat.gguf`. All inputs here are synthetic.

| Run | Setup | Intent set | Fully correct | Median latency |
|---|---|---|---|---|
| v1 | tool calling, `tool_choice: "required"`, thinking on | 20 tuned | 2/20 (4/20 schema-valid) | ~40 s |
| v2-A | tool calling, `/no_think` | 20 tuned | 0/20 | ~25 s |
| v2-B | `responseFormat: json_schema`, model picks a day reference | 20 tuned | 10/20 | 3.7 s |
| v3 | json_schema for service type; rules for date, part of day, price, professional; `predict` cap, `reasoning_budget: 0` | 20 tuned | 19/20 | 1.2 s |
| v3 | same | 15 held-out | 14/15 | 1.4 s |

Notes

- The tool-call grammar guaranteed a call but did not keep arguments inside the zod enums; `responseFormat: json_schema` did.
- Without a `predict` cap the model sometimes kept generating after the JSON object (one summary took 185 s).
- The held-out set was written after the date/price rules were fixed, but the professional-keyword rule was adjusted after seeing one held-out failure, so that field is not a clean held-out measurement. A fresh held-out set is next.
- Numbers in summaries are rendered by `lib/recovery.mjs`; the model only picks fact ids and writes a digit-free question.

## iPhone (2026-10-06, first on-device run)

iPhone 18 Pro, iOS 27.0.1, Release build, Expo SDK 54, `@qvac/sdk` 0.21.0, MedPsy-1.7B `q4_k_m`. Synthetic data.

| Step | Result |
|---|---|
| First launch: download + load | 72.4 s (includes the 1.28 GB download over Wi-Fi) |
| Weekly summary (model picks question) | 767 ms, picked Q07 |
| Intent → ServiceRequest (default sentence) | 526 ms; sauna / 2026-10-10 / evening / professional: all correct |

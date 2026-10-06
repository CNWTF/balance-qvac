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
| Airplane mode, app relaunched: load from device | 2.0 s |
| Airplane mode: weekly summary | 471 ms, Q07 |
| Airplane mode: ServiceRequest | 533 ms; same correct result |

Screenshots: `p1/screens/` (synthetic data only).

## Three role apps on Galaxy A32 5G (2026-10-07 00:20–01:03)

Galaxy A32 5G (SM-A326BR/DS, 6 GB, Android 13, Mali GPU so CPU only). Three APKs from one codebase (Android product flavors). Peers: the A32 apps and desktop stand-ins (`p2p/agent_bot.mjs`, `p2p/user_bot.mjs`) using the same QVAC P2P plugin.

| Step | Result |
|---|---|
| P2P plugin (Hyperswarm inside the QVAC worker) on Android | Online on the phone; phone ↔ PC connected in 1–2 s once both were in the foreground |
| Two apps on the same phone | Unreliable: the background app is not reachable (Android limits background network). The demo puts each role on its own device |
| Venue: batch replies (Qwen3-0.6B, `batchCompletion`) | 2 replies in 10.9 s; confirm → capacity committed on the venue phone → order sent |
| Professional: RAG (EmbeddingGemma 300M Q4 + QVAC RAG) | 52 s incl. first download and ingest; top hits K3, K8, K5 all relevant |
| Professional: Bergamot zh→en | Runs on the phone; quality poor for this domain ("three small beams"); the app labels it as machine translation to check |
| Personal: weekly summary (real data, MedPsy-1.7B, CPU) | 14.9 s, Q01; bilingual sentences |
| Personal: read aloud (Supertonic 3 Q4, English) | Played on the phone (system audio focus at 00:39:08) |
| Personal: draft request | 16.9–21.1 s |
| Personal ↔ PC professional and venue | share → pro reply → quote → confirm → order BOP-WWNZLO |
| Safety: over budget | NT$1,500 quote vs NT$1,000 limit → agent stops, "Book this slot anyway" |
| Safety: prompt injection in venue text | Flagged, treated as data, nothing sent |
| Not tested on the phone yet | Voice input (Whisper), photo → classify → VisionPsy / OCR, Japanese read-aloud (desktop tests passed for classify, ASR, OCR, VisionPsy) |

Screenshots in `p1/screens/a32_*.png` contain demo data only.

# Regulation Corpus — provenance and replacement

Documents here are indexed by `sentinel.rag.store.RegulationStore` and cited by the
compliance assistant. This README is skipped by the loader.

## ⚠️ Read this before trusting any answer from the compliance assistant

The documents in this folder are **development summaries and plant SOPs**, written to exercise the
retrieval pipeline. They paraphrase the *substance* of publicly-described requirements
so the RAG assistant has realistic material to retrieve and cite.

**They are NOT official regulatory text.** They contain no verbatim quotations and no
fabricated clause numbers, because inventing either would be worse than useless — a plausible-looking
but wrong citation is exactly how a compliance tool gets someone hurt.

Every file declares `provenance: SUMMARY` or `OFFICIAL` (for site SOP). The retriever propagates that
field into every citation, so the UI can visibly mark an answer as grounded in development summaries or official standards.

| Value | Meaning | Citation rendering |
|---|---|---|
| `OFFICIAL` | Verbatim authoritative text, or our own plant SOP | cited plainly |
| `STATUTE` | Verbatim statutory text | cited plainly |
| `SUMMARY` | A paraphrase written for development | cited with `[development summary — not official text]` |
| `REFERENCE_ONLY` | Pointer to a document we do not hold | cited with the same marker |

## Corpus documents included

- `dgms-circulars.md` / `dgms_coal_mines_regulations.md` — Directorate General of Mines Safety circulars & rules
- `factories-act-1948.md` / `factories_act_1948.md` — The Factories Act, 1948 (esp. Chapter IV-A, hazardous processes)
- `oisd-std-105.md` / `oisd_std_105_reference.md` — OISD-STD-105 Work Permit System reference
- `sentinel-plant-sop.md` / `emergency_response_sop.md` — Site emergency response & work permit procedure

## Using site-licensed standards

OISD-STD-105 is a restricted-circulation standard and must not be committed to this repository. If your site holds a licensed copy:

1. Create `data/regulations_local/` (git-ignored).
2. Drop the `.md` or `.txt` extract in.
3. Restart the API.

Anything loaded from `regulations_local/` is marked `OFFICIAL` automatically and takes precedence in citations.

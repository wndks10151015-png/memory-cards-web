# Learning implementation — 20261021-22

The reference is the user's Anki SM-2 configuration, not FSRS. The installed Anki 26.09.3 backend was run against isolated, generated collections. The user's collection was not opened for writes. The original exported card identity and position metadata is private; it is never part of the public website repository.

## Active learning path

`sien-anki.js` collects intraday learning, then due interday learning, then due reviews, then new cards. Review/new quotas include the selected deck and each child deck. New introductions also consume the review cap unless explicitly disabled. Interday learning consumes the review cap; intraday repetitions do not. Display ordering uses the selected deck's options; answer intervals use the card's own deck options. Every start control uses this path.

Original defaults: 40 new / 400 review, learning 1 and 10 minutes, relearning 10 minutes, graduation 1 day, easy graduation 4 days, starting ease 2.5, hard factor 1.2, easy bonus 1.3, interval modifier 1, maximum 36500 days, lapse multiplier 0 / minimum 1 day, leech threshold 8 with tag-only action. New and interday learning are mixed into reviews using Anki's float32 Intersperser. Due intraday steps take priority; learn-ahead is 20 minutes only after the main queue runs out. Days start at 04:00 Asia/Seoul on every device.

`sien-sm2.js` implements the state transitions and fuzz ranges. `sien-random.js` provides the PCG seed expansion / ChaCha12 RNG used by Rust rand. Imported `anki_123` identities use the original numeric seed. Button previews and actual answers use the same next-state function. Learning crossing the rollover becomes interday learning. Lapses and leech checks count review failures, not new/learning Again answers.

Custom sessions, forced hint/item grading, same-day isolation/chain ordering, extra wrong-answer rounds, next-progress admission and rest-day/exam interval adjustments do not run in the active learning path. Compatibility handlers and old metadata remain inert so old backups and journals can still be read. Their controls are removed from the learning UI. Old review schedules and history are never replayed or rescheduled at startup.

## Persistence and load

The existing per-device Gist journals, durable outbox, explicit undo events, deletion protection, pacing, conditional reads and retry policy remain in use. No new transport or polling timer was added. Derived queues and counters are not uploaded. Preferences and a small deck resume record use the existing metadata journal. Original Anki ordering metadata is one immutable optional private file, `sien-anki-order-v1.json`, read via the existing file cache and reused offline. It contains only card IDs, original note IDs, positions and modification times, with collection creation time. It never updates a schedule or creates a card.

## Verification

- 144 next-state comparisons against Anki 26.09.3: new, learning, review, late review, relearning, four answers, empty/custom learning steps, interval modifier/cap and lapse multiplier. Exact intervals, ease and lapse results matched.
- Twenty-five complete queue orders against the installed backend: mixed/new-first/new-last/interday-first/interday-last, due ties, review cap, interval ordering and reverse new positions.
- Twelve actual backend answers also matched the scheduled learning timestamps, including the small learning-interval fuzz.
- Node tests cover hierarchy, quota use, rollover, leeches, numeric imported seeds, history merging, undo, deletion, cooldown and request pacing. `node --test *.test.cjs tests/*.test.cjs`.
- Browser plugin not available. Isolated Playwright desktop 1280×1000 and Android-sized 412×915 fixtures cover Home/deck parity, caps, ordering, keyboard reveal/answer, save/undo, removed sessions, preferences, shared device counts and idle metadata churn. No live account was graded for testing. Real Android hardware is a separate verification boundary.
- Read-only benchmark on the preserved 5358-card / 4384-log migration snapshot: 10 uncached full plans, mean 17.6 ms / max 30.7 ms on this PC. UI caches plans within a second and caches daily usage until the log changes. These numbers are not an Android performance claim.

This is a browser port of the specified learning behavior, not a complete Anki application. Anki add-ons, FSRS optimization, media playback, note-type/template editing, filtered-deck administration and collection synchronization are not implemented by this learning change.

## Source and license

Anki scheduling and queue portions are derived from work by Ankitects Pty Ltd and contributors under GNU AGPL-3.0-or-later. See `LICENSE-ANKI.txt`. Corresponding JavaScript source is distributed alongside the running application. Reference source revision: `b5df43b6a05d1270f33f6c2457eb937d8be9eda4`.

- https://github.com/ankitects/anki/tree/b5df43b6a05d1270f33f6c2457eb937d8be9eda4/rslib/src/scheduler
- https://github.com/ankitects/anki/blob/b5df43b6a05d1270f33f6c2457eb937d8be9eda4/rslib/src/storage/card/mod.rs
- https://docs.ankiweb.net/manual/deck-options
- RNG algorithm reference: https://github.com/rust-random/rand and https://github.com/rust-random/rand_chacha (MIT OR Apache-2.0).

Generated oracle fixtures contain only synthetic test cards; they contain no personal study material or credentials.

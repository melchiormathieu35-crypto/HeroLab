# Graph Report - HeroLab  (2026-08-14)

## Corpus Check
- 1 files · ~82,816 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 83 nodes · 163 edges · 8 communities
- Extraction: 78% EXTRACTED · 20% INFERRED · 2% AMBIGUOUS · INFERRED: 33 edges (avg confidence: 0.88)
- Token cost: 107,212 input · 0 output

## Community Hubs (Navigation)
- Core Poker Engine
- Opponent Profiling Lab
- Career, Bankroll & Leaks
- Feutre Hand-History Tracker
- App Shell & Rating
- Blocker Finder Lab
- Range Detective & UI
- Spot Generation Constants

## God Nodes (most connected - your core abstractions)
1. `App (Pivot shell & router)` - 21 edges
2. `BoardTex` - 11 edges
3. `Deck` - 9 edges
4. `Spot (situation generator)` - 9 edges
5. `AI (villain decision engine)` - 8 edges
6. `HRUI (Range Detective)` - 8 edges
7. `PRUI (Profiling Lab)` - 8 edges
8. `FT (Feutre router)` - 8 edges
9. `Ranges` - 7 edges
10. `Judge (EV verdict engine)` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Career` --references--> `LEVELS`  [AMBIGUOUS]
  pivot-simulateur-cashgame-17.html → pivot-simulateur-cashgame-17.html  _Bridges community 7 → community 2_
- `BlockerEngine` --calls--> `Ranges`  [INFERRED]
  pivot-simulateur-cashgame-17.html → pivot-simulateur-cashgame-17.html  _Bridges community 0 → community 5_
- `HRSpot` --references--> `ALL_PROFILES`  [INFERRED]
  pivot-simulateur-cashgame-17.html → pivot-simulateur-cashgame-17.html  _Bridges community 1 → community 6_
- `Judge (EV verdict engine)` --shares_data_with--> `Spot (situation generator)`  [INFERRED]
  pivot-simulateur-cashgame-17.html → pivot-simulateur-cashgame-17.html  _Bridges community 7 → community 0_
- `Stats (tracker compute engine)` --semantically_similar_to--> `Progress`  [INFERRED] [semantically similar]
  pivot-simulateur-cashgame-17.html → pivot-simulateur-cashgame-17.html  _Bridges community 2 → community 3_

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **DOM-free poker engine core (Module 1)** — pivot_simulateur_cashgame_17_deck, pivot_simulateur_cashgame_17_handeval, pivot_simulateur_cashgame_17_ranges, pivot_simulateur_cashgame_17_boardtex, pivot_simulateur_cashgame_17_equity, pivot_simulateur_cashgame_17_odds [EXTRACTED 1.00]
- **Simulator decision loop: generate, decide, judge, record** — pivot_simulateur_cashgame_17_spot, pivot_simulateur_cashgame_17_table, pivot_simulateur_cashgame_17_ai, pivot_simulateur_cashgame_17_judge, pivot_simulateur_cashgame_17_play, pivot_simulateur_cashgame_17_progress, pivot_simulateur_cashgame_17_app [EXTRACTED 1.00]
- **Feutre tracker pipeline: parse, store, compute, detect, render** — pivot_simulateur_cashgame_17_parser, pivot_simulateur_cashgame_17_store, pivot_simulateur_cashgame_17_stats, pivot_simulateur_cashgame_17_leaks, pivot_simulateur_cashgame_17_charts, pivot_simulateur_cashgame_17_v, pivot_simulateur_cashgame_17_ft [EXTRACTED 1.00]

## Communities (8 total, 0 thin omitted)

### Community 0 - "Core Poker Engine"
Cohesion: 0.23
Nodes (17): AI (villain decision engine), BoardTex, CAT hand categories, Card-as-integer encoding (0..51), Monte-Carlo equity vs range, Pot odds, MDF and fold equity, Deck, Equity (+9 more)

### Community 1 - "Opponent Profiling Lab"
Cohesion: 0.18
Nodes (14): ALL_PROFILES, Calibrate, Bayesian street-by-street narrowing, Opponent, PRExplain, PRLab, PROF_EXT (extended profiles), PROFILE_FAMILY (+6 more)

### Community 2 - "Career, Bankroll & Leaks"
Cohesion: 0.24
Nodes (12): Bankroll, Career, CareerUI, Leak detection & remediation loop, Goals, Journey (missions & timeline), LEAK_COST, LEAK_INFO (+4 more)

### Community 3 - "Feutre Hand-History Tracker"
Cohesion: 0.33
Nodes (10): Charts (Chart.js wrapper), Feutre embedded inside Pivot, Fmt, FT (Feutre router), Parser (Winamax/Stars hand histories), POSITIONS, Stats (tracker compute engine), Store (sessions & hands) (+2 more)

### Community 4 - "App Shell & Rating"
Cohesion: 0.36
Nodes (9): App (Pivot shell & router), BLStats, Coach voice vs mentor voice, localStorage keyed persistence, HRStats, Mentor, Player, PRStats (+1 more)

### Community 5 - "Blocker Finder Lab"
Cohesion: 0.29
Nodes (8): BLExplain, BlockerEngine, BLScore, BLSpot, BLUI (Blocker Finder), CATEGORY_ROLE (value/bluff/bluffcatch), Blocker / card-removal effect, Spot/Score/Explain/Stats lab pattern

### Community 6 - "Range Detective & UI"
Cohesion: 0.29
Nodes (8): Low-lamp felt design direction, Engine/DOM separation, HR_DIFFICULTY, HRExplain, HRScore, HRSpot, HRUI (Range Detective), UI (render primitives)

### Community 7 - "Spot Generation Constants"
Cohesion: 0.40
Nodes (5): LEVELS, MODES (training modes), Spot (situation generator), STAKES, STREETS

## Ambiguous Edges - Review These
- `LEVELS` → `Career`  [AMBIGUOUS]
  pivot-simulateur-cashgame-17.html · relation: references
- `Rating (Poker Rating)` → `BLStats`  [AMBIGUOUS]
  pivot-simulateur-cashgame-17.html · relation: shares_data_with
- `Journey (missions & timeline)` → `Leaks (rule-based leak detector)`  [AMBIGUOUS]
  pivot-simulateur-cashgame-17.html · relation: shares_data_with

## Knowledge Gaps
- **13 isolated node(s):** `CAT hand categories`, `MODES (training modes)`, `STAKES`, `STREETS`, `Fmt` (+8 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `LEVELS` and `Career`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Rating (Poker Rating)` and `BLStats`?**
  _Edge tagged AMBIGUOUS (relation: shares_data_with) - confidence is low._
- **What is the exact relationship between `Journey (missions & timeline)` and `Leaks (rule-based leak detector)`?**
  _Edge tagged AMBIGUOUS (relation: shares_data_with) - confidence is low._
- **Why does `App (Pivot shell & router)` connect `App Shell & Rating` to `Core Poker Engine`, `Opponent Profiling Lab`, `Career, Bankroll & Leaks`, `Feutre Hand-History Tracker`, `Blocker Finder Lab`, `Range Detective & UI`, `Spot Generation Constants`?**
  _High betweenness centrality (0.559) - this node is a cross-community bridge._
- **Why does `BoardTex` connect `Core Poker Engine` to `Opponent Profiling Lab`, `App Shell & Rating`, `Blocker Finder Lab`, `Range Detective & UI`?**
  _High betweenness centrality (0.143) - this node is a cross-community bridge._
- **Why does `FT (Feutre router)` connect `Feutre Hand-History Tracker` to `App Shell & Rating`?**
  _High betweenness centrality (0.118) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `App (Pivot shell & router)` (e.g. with `BLUI (Blocker Finder)` and `FT (Feutre router)`) actually correct?**
  _`App (Pivot shell & router)` has 5 INFERRED edges - model-reasoned connections that need verification._
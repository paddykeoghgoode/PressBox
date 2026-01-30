# ⚽ PitchPerfect – Football Writing Assistant (WordPress Plugin)

PitchPerfect is a WordPress editor-side writing assistant built specifically for **football (soccer) journalism**.

It helps writers and editors improve grammar, clarity, consistency, and editorial quality directly inside the Gutenberg editor, using **UK English conventions** and football-aware language rules.

The plugin is configurable by administrators, role-aware, and designed for real newsroom workflows on football and sports websites.

---

## ✨ What This Plugin Does

- Analyses post content inside the WordPress block editor
- Highlights grammar, spelling, and style issues inline
- Suggests improvements tailored to:
  - UK English
  - Football journalism and match reporting
- Explains *why* a change is suggested
- Allows one-click fixes, dismissals, or undo
- Includes football-specific editorial intelligence
- Provides an admin-controlled permissions sidebar
- Never auto-edits or auto-publishes content

---

## 🎯 Target Users

- Football journalists and contributors
- Sports editors and sub-editors
- Digital sports desks publishing:
  - Match reports
  - Previews
  - Tactical analysis
  - Opinion and features

Default access is granted to **Editors**, but access and capabilities are fully configurable by Admins.

---

## 🧩 Core Features (Expanded MVP)

### 1. Grammar & Spelling (UK English)
- Subject–verb agreement
- Tense consistency
- Article usage (“a” vs “an”)
- UK spelling (colour, defence, centre, programme)
- Apostrophes and punctuation
- Capitalisation rules for clubs and competitions

---

### 2. Football-Specific Style & Clarity
- Overly long or unclear sentences
- Passive voice overuse
- Weak verbs in action reporting
- Repetition of common football terms (match, game, side, squad)
- Sentence flow warnings for live-match narration

---

### 3. Match Report Tense Consistency
- Detects tense switching within match reports
- Warns when:
  - First half written in past tense
  - Second half switches to present tense (or vice versa)
- Suggests a consistent narrative tense for the article

---

### 4. Club & Player Name Consistency
- Detects inconsistent naming:
  - “Manchester United” → “Man United” → “United”
  - First name vs surname inconsistency
- Admin-configurable preferred naming styles
- Optional enforcement vs advisory mode

---

### 5. Headline Power & Clarity Checks
(Headings only)

- Length optimisation warnings
- Passive vs active voice detection
- Weak verb detection (“were”, “had”, “is”)
- Football-style headline suggestions
- Optional “Punchiness” score

Example:
> “Arsenal were beaten by City”  
→ “City punish Arsenal at the Etihad”

---

### 6. Repetition Heatmap
- Highlights overused words across the article
- Visual heatmap in the sidebar
- Especially useful for long match reports and previews

---

### 7. UK Football Terminology Guard
Flags incorrect or non-UK phrasing:
- ❌ soccer
- ❌ field
- ❌ playoffs
- ❌ tie (when “draw” is appropriate)

Suggests UK-appropriate alternatives automatically.

---

### 8. Confidence & Speculation Warnings
- Detects speculative language presented as fact:
  - “likely”, “could”, “might”, “expected to”
- Suggests softening or attribution where appropriate
- Especially useful for transfer rumours and previews

---

### 9. Score & Fact Consistency Warnings
- Detects inconsistent scorelines mentioned in the same article
- Warns editors before publishing
- Does not attempt external fact-checking

---

### 10. Editor Notes Mode (Private)
- Editors can add private inline notes
- Notes are:
  - Invisible to Authors and Contributors
  - Excluded from frontend output
- Useful for collaborative editing workflows

---

## 🖥️ Editor Experience (Gutenberg)

- Adds a **PitchPerfect** sidebar to the block editor
- Sidebar displays:
  - Total issues found
  - Filters by category
  - Click-to-jump navigation
- Inline underlines and highlights per issue type
- Supports:
  - Post body
  - Headings
  - Excerpt
- Ignores:
  - Shortcodes
  - Code blocks
  - HTML comments

---

## 🔐 Permissions & Admin Sidebar

### Admin Settings Panel
Accessible via:
**WP Admin → Settings → PitchPerfect**

Admins can:

- Enable or disable the plugin per role
- Choose which roles can:
  - View suggestions
  - Apply fixes
  - View explanations
  - Use rewrite tools (future)
- Enable or disable feature categories:
  - Grammar & spelling
  - Style & clarity
  - Headlines
  - Football terminology
  - Match-report checks
- Set preferred club naming conventions
- Lock language to **en-GB**

### Default Role Access

| Role          | Access |
|--------------|--------|
| Administrator | Full control |
| Editor        | Suggestions + apply |
| Author        | Suggestions only (optional) |
| Contributor   | Disabled by default |

All permissions are enforced server-side and client-side.

---

## 🏗️ Technical Architecture

### Frontend (WP Admin)
- React via `@wordpress/*` packages
- Gutenberg sidebar plugin
- Inline block decorations
- WordPress data store for state

### Backend (Plugin)
- PHP (WordPress coding standards)
- REST API for analysis
- Nonce-based authentication
- Per-user rate limiting

### AI Layer
- Abstracted provider (adapter pattern)
- Must support:
  - UK English
  - Football-aware writing
  - Short explanations
- No hard dependency on a specific AI vendor

---

## 🔌 Plugin Structure

```text
pitchperfect/
├── readme.md
├── pitchperfect.php
├── package.json
├── composer.json
├── build/
├── src/
│   ├── editor/
│   │   ├── sidebar.js
│   │   ├── highlights.js
│   │   └── store.js
│   ├── settings/
│   │   └── permissions.js
│   └── index.js
├── includes/
│   ├── RestController.php
│   ├── Permissions.php
│   ├── AnalysisService.php
│   └── AiProviderInterface.php
└── assets/
```

---

## 🌐 REST API (Internal)

### Analyse Content
`POST /wp-json/pitchperfect/v1/analyse`

```json
{
  "postId": 123,
  "content": "string",
  "language": "en-GB",
  "context": "football_article"
}
```

Response:
```json
{
  "suggestions": [
    {
      "id": "sug_001",
      "type": "grammar | spelling | clarity | style | headline | consistency",
      "severity": "info | warning | error",
      "start": 52,
      "end": 67,
      "message": "This sentence may be too long for match reporting.",
      "replacements": ["Rewritten sentence"],
      "explanation": "Shorter sentences improve readability in football articles."
    }
  ]
}
```

---

## 🧠 AI Behaviour Requirements

- Default language: **en-GB**
- Football-aware vocabulary:
  - match, fixture, squad, side, manager, referee, VAR
- Avoid Americanisms:
  - ❌ soccer
  - ❌ field
- Preserve:
  - Player names
  - Club names
  - Scores
  - Dates
- Do not introduce new facts or claims

---

## 🔒 Privacy & Compliance

- No content stored after analysis
- No training on site content
- GDPR-friendly defaults
- Admin option to disable AI calls globally

---

## 🚀 Roadmap

### v1
- Grammar, style, and football checks
- Editor sidebar
- Role-based permissions
- Admin feature toggles

### v2
- Rewrite modes (shorten, punchy, formal)
- Club/competition glossary enforcement
- Editorial analytics dashboard

---

## 🤖 Instructions for Coding Agents

- Follow WordPress coding standards
- Keep AI calls server-side
- Make permissions explicit and auditable
- Do not auto-modify content
- Prefer clarity over cleverness

---

## 📄 License

MIT

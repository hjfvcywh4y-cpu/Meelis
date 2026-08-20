# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is
A single Python 3.12 Telegram bot ("IDera Helper") that lives in `telegram_bot/`. It talks to
the Telegram Bot API via **long-polling** (`app.run_polling`) — there is **no web server, no
inbound port, and no database**. Persistence is a local JSON file (`telegram_bot/data/stats.json`,
auto-created). Optional AI free-text answers use Gemini (primary) then Groq (fallback) through
the OpenAI-compatible SDK.

### Environment
- The update script creates a virtualenv at `telegram_bot/.venv` and installs
  `telegram_bot/requirements.txt`. Activate it before running anything: `source telegram_bot/.venv/bin/activate`.
- `python3-venv` is a system package required to build the venv; it is already installed in the
  VM snapshot, so the update script does not reinstall it.

### Running the bot
- Run from inside `telegram_bot/` (module imports like `import menus` are relative to that dir):
  `cd telegram_bot && source .venv/bin/activate && python bot.py`.
- `bot.py` exits immediately with `Не задан TELEGRAM_TOKEN` if `TELEGRAM_TOKEN` is unset — this is
  expected, not a bug. Set `TELEGRAM_TOKEN` (from @BotFather) via a `.env` file in `telegram_bot/`
  or an env var. `GEMINI_API_KEY` / `GROQ_API_KEY` are optional (menus + БАД quiz work without them;
  only the free-text AI Q&A needs a key).
- An invalid/placeholder token surfaces as `telegram.error.InvalidToken: Unauthorized` from the
  `getMe` call — this proves the runtime + network stack works and only a real token is missing.

### Lint / test / build
- There is **no configured linter or test suite** in this repo. Use `python -m py_compile bot.py
  menus.py bad_quiz.py stats.py lessons.py` as a syntax/lint gate.
- Core conversational logic (menus, screen state, the БАД quiz in `bad_quiz.py`, stats in
  `stats.py`) is pure Python and can be exercised without a Telegram token by importing the modules
  and driving `bot.handle_text` / `bot.start` with mocked `Update`/`Context` objects.
- Docker build (`Dockerfile` at repo root, or `telegram_bot/Dockerfile`) mirrors production;
  `railway.toml` deploys it as a `python bot.py` worker.

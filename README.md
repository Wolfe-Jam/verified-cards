# verified-cards

**Get your business card.** Paste a GitHub repo and see its business card: front and back, flip it, light or dark.

**Try it:** https://wolfe-jam.github.io/verified-cards/

- **Printed from the repo's own public files**, in this order of trust: the owner's `.fafa` (`.well-known/fafa` or `agent.fafa`), `server.json` (MCP Registry), `package.json`, then GitHub's repository data. The back's Sources tab links each one.
- **Nothing is guessed.** A field no file gives is not printed. No colour declared means ink.
- **In your browser.** No server, no sign-in. The share link (`?repo=owner/name`) prints the business card live on every visit, so it never goes stale.
- **Not endorsed** unless the owner says so: a business card printed from public data says that on its (i) panel. A repo with its own `.fafa` shows as "claimed".

## Make it yours

Add a `.fafa` to your repo at `.well-known/fafa`. Your colour goes in `metadata.cards.accent`:

```yaml
version: "1.0"
agent:
  name: "my-server"
  description: "One sentence about what it does."
metadata:
  cards:
    accent: "#0066cc"
```

## How it's built

`index.html` and `app.js` fetch the files; `reader.js` decides what the business card says; [agent-business-card](https://www.npmjs.com/package/agent-business-card) prints it. `npm test` checks the reader.

## License

MIT

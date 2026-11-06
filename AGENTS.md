<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Phone installation uses a web manifest and static icons only; do not add app-shell service workers unless offline use is explicitly requested, to keep previews and updates safe.
- Chat agents live in src/lib/agents (registry + orchestrator); /api/chat only delegates. Register only real, working agents; unknown agentId falls back to the default so production chat never breaks.

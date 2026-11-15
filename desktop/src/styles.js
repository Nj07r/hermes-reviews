// All page CSS in one place. Colours are the app's own tokens, so it follows the theme.
export const STYLES = `
.rv-root {
  --rv-sans: var(--font-sans, system-ui, sans-serif);
  --rv-mono: var(--font-mono, "Victor Mono", ui-monospace, SFMono-Regular, Menlo, monospace);
  --rv-ease: cubic-bezier(.2,.8,.2,1);
  --rv-line: var(--ui-stroke-tertiary);
  --rv-card: var(--ui-bg-card, var(--ui-bg-elevated));
  --diffs-font-family: var(--rv-mono);
  --diffs-header-font-family: var(--rv-sans);
  --diffs-font-size: 12.5px;
  --diffs-line-height: 1.6;
  height: 100%; display: flex; flex-direction: column; min-height: 0;
  color: var(--ui-text-primary); font-family: var(--rv-sans);
}
.rv-root * { box-sizing: border-box; }
.rv-mono { font-family: var(--rv-mono); font-size: 0.75rem; }
.rv-dim { color: var(--ui-text-tertiary); }
.rv-faint { color: var(--ui-text-quaternary); }
.rv-italic { font-family: var(--rv-mono); font-style: italic; font-weight: 300; }

/* ---- buttons */
.rv-btn { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 11px; border-radius: 7px;
  border: 1px solid var(--ui-stroke-secondary); background: transparent; color: var(--ui-text-secondary);
  font: 500 0.8125rem var(--rv-sans); cursor: pointer; white-space: nowrap;
  transition: background-color 150ms var(--rv-ease), color 150ms var(--rv-ease), border-color 150ms var(--rv-ease), transform 120ms var(--rv-ease); }
.rv-btn:hover { background: var(--ui-control-hover-background); color: var(--ui-text-primary); }
.rv-btn:active { transform: scale(.96); }
.rv-btn:disabled { opacity: .45; cursor: default; transform: none; }
.rv-btn .codicon { font-size: 14px; }
.rv-btn-primary { background: var(--ui-accent); border-color: var(--ui-accent); color: #100F0F; }
.rv-btn-primary:hover { background: color-mix(in oklab, var(--ui-accent) 88%, white); color: #100F0F; }
.rv-btn-ghost { border-color: transparent; }
.rv-icon-btn { width: 28px; padding: 0; justify-content: center; }
.rv-seg { display: inline-flex; padding: 2px; gap: 2px; border-radius: 8px; background: var(--ui-control-hover-background); }
.rv-seg button { height: 24px; padding: 0 10px; border: 0; border-radius: 6px; background: transparent; cursor: pointer;
  color: var(--ui-text-tertiary); font: 500 0.75rem var(--rv-sans); transition: all 150ms var(--rv-ease); }
.rv-seg button[data-on='true'] { background: var(--ui-bg-elevated); color: var(--ui-text-primary); box-shadow: 0 1px 2px rgb(0 0 0 / .25); }

/* ---- list page */
.rv-scroll { flex: 1; min-height: 0; overflow: auto; }
.rv-wrap { max-width: 920px; margin: 0 auto; padding: 28px 28px 64px; }
.rv-title-row { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
.rv-h1 { font-size: 1.3rem; font-weight: 600; margin: 0; letter-spacing: -0.01em; }
.rv-sub { margin: 0 0 18px; }
.rv-count { font-family: var(--rv-mono); font-size: 0.8rem; color: var(--ui-text-tertiary); }
.rv-spacer { flex: 1; }
.rv-add { display: flex; gap: 8px; margin-bottom: 6px; }
.rv-input { flex: 1; height: 32px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--ui-stroke-secondary);
  background: color-mix(in oklab, var(--ui-control-hover-background) 55%, transparent); color: var(--ui-text-primary); font: 0.8125rem var(--rv-sans); outline: none;
  transition: border-color 150ms var(--rv-ease), box-shadow 150ms var(--rv-ease); }
.rv-input:focus { border-color: var(--ui-accent); box-shadow: 0 0 0 3px color-mix(in oklab, var(--ui-accent) 18%, transparent); }
.rv-msg { min-height: 20px; font-size: 0.75rem; color: var(--ui-text-tertiary); margin: 2px 0 10px; }
.rv-msg[data-tone='error'] { color: var(--ui-red, #D14D41); }
.rv-msg[data-tone='ok'] { color: var(--ui-cyan, #3AA99F); }
.rv-list { display: grid; gap: 2px; }
.rv-row { position: relative; display: grid; grid-template-columns: 30px minmax(0, 1fr) auto auto; gap: 12px; align-items: center;
  width: 100%; padding: 10px 12px; border-radius: 9px; border: 1px solid transparent; background: transparent; text-align: left;
  cursor: pointer; color: inherit; font: inherit; transition: background-color 150ms var(--rv-ease); }
.rv-row:hover { background: var(--ui-control-hover-background); }
.rv-row:focus-visible { outline: 1px solid var(--ui-accent); outline-offset: -1px; }
.rv-row-title { font-size: 0.9rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rv-row-meta { display: flex; gap: 6px; align-items: center; margin-top: 3px; font-size: 0.75rem; color: var(--ui-text-tertiary); min-width: 0; }
.rv-row-meta .rv-mono { color: var(--ui-text-tertiary); }
.rv-row-side { display: flex; align-items: center; gap: 8px; }
.rv-row-status { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; min-width: 9.5rem; }
.rv-row-lines { font-size: 0.72rem; white-space: nowrap; }
.rv-row-actions { display: flex; gap: 2px; opacity: 0; transition: opacity 150ms var(--rv-ease); }
.rv-row:hover .rv-row-actions, .rv-row:focus-within .rv-row-actions { opacity: 1; }
.rv-badge { font: 600 0.62rem var(--rv-sans); text-transform: uppercase; letter-spacing: .07em; padding: 2px 6px; border-radius: 5px;
  border: 1px solid var(--ui-stroke-secondary); color: var(--ui-text-tertiary); white-space: nowrap; }
.rv-badge[data-tone='draft'] { border-style: dashed; }
.rv-badge[data-tone='ok'] { color: var(--ui-green); border-color: color-mix(in oklab, var(--ui-green) 45%, transparent); }
.rv-badge[data-tone='bad'] { color: var(--ui-red); border-color: color-mix(in oklab, var(--ui-red) 45%, transparent); }
.rv-badge[data-tone='accent'] { color: var(--ui-accent); border-color: color-mix(in oklab, var(--ui-accent) 45%, transparent); }
.rv-empty { padding: 56px 0; text-align: center; color: var(--ui-text-tertiary); font-size: 0.9rem; }
.rv-empty .rv-italic { display: block; margin-top: 6px; font-size: 0.8rem; color: var(--ui-text-quaternary); }
.rv-hidden-toggle { margin-top: 18px; }
.rv-enter { animation: rv-rise 360ms var(--rv-ease) both; animation-delay: calc(var(--i, 0) * 28ms); }
@keyframes rv-rise { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
.rv-leave { animation: rv-fall 220ms var(--rv-ease) both; }
@keyframes rv-fall { to { opacity: 0; transform: translateX(10px); } }

/* groups */
.rv-groups { display: grid; gap: 14px; }
.rv-group-head { display: flex; align-items: center; gap: 8px; width: 100%; padding: 4px 6px 6px; border: 0; background: none;
  color: var(--ui-text-secondary); font: 600 0.8rem var(--rv-sans); cursor: pointer; text-align: left; }
.rv-group-head:hover { color: var(--ui-text-primary); }
.rv-group-head > .codicon-chevron-right { color: var(--ui-text-quaternary); transition: transform 200ms var(--rv-ease); }
.rv-group-head[data-open='true'] > .codicon-chevron-right { transform: rotate(90deg); }
.rv-group-head > .codicon-folder, .rv-group-head > .codicon-circle-large-outline { color: var(--ui-accent); font-size: 14px; }
.rv-group-name { text-transform: none; }
.rv-tag { font: 0.68rem var(--rv-mono); padding: 1px 6px; border-radius: 5px;
  background: color-mix(in oklab, var(--ui-accent) 12%, transparent); color: var(--ui-accent); white-space: nowrap; }

/* ---- avatars */
.rv-avatar { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 50%;
  font: 600 0.75rem var(--rv-sans); flex: none; color: var(--rv-tint); background: color-mix(in oklab, var(--rv-tint) 17%, transparent); }
.rv-avatar-sm { width: 20px; height: 20px; font-size: 0.65rem; }
.rv-avatar[data-tint='orange'] { --rv-tint: var(--ui-orange, #DA702C); }
.rv-avatar[data-tint='cyan'] { --rv-tint: var(--ui-cyan, #3AA99F); }
.rv-avatar[data-tint='blue'] { --rv-tint: var(--ui-blue, #4385BE); }
.rv-avatar[data-tint='purple'] { --rv-tint: var(--ui-purple, #8B7EC8); }
.rv-avatar[data-tint='magenta'] { --rv-tint: #CE5D97; }
.rv-avatar[data-tint='green'] { --rv-tint: var(--ui-green, #879A39); }
.rv-avatar[data-tint='yellow'] { --rv-tint: var(--ui-yellow, #D0A215); }
.rv-avatar[data-tint='red'] { --rv-tint: var(--ui-red, #D14D41); }

/* ---- PR page */
.rv-pr-head { flex: none; padding: 14px 24px 0; border-bottom: 1px solid var(--rv-line); }
.rv-crumbs { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; font-size: 0.75rem; color: var(--ui-text-tertiary); }
.rv-crumbs button { display: inline-flex; align-items: center; gap: 4px; border: 0; background: none; padding: 2px 4px 2px 0;
  color: var(--ui-text-tertiary); font: inherit; cursor: pointer; }
.rv-crumbs button:hover { color: var(--ui-text-primary); }
.rv-pr-titlebar { display: flex; align-items: flex-start; gap: 16px; }
.rv-pr-title { flex: 1; min-width: 0; margin: 0; font-size: 1.2rem; font-weight: 600; line-height: 1.35; letter-spacing: -0.01em; }
.rv-pr-title .rv-num { color: var(--ui-text-quaternary); font-weight: 400; }
.rv-pr-actions { display: flex; gap: 6px; flex: none; }
.rv-pr-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin: 8px 0 10px; font-size: 0.8rem; color: var(--ui-text-secondary); }
.rv-branch { display: inline-flex; align-items: center; gap: 4px; max-width: 360px; padding: 1px 7px; border-radius: 6px; cursor: pointer;
  border: 0; background: color-mix(in oklab, var(--ui-cyan, #3AA99F) 12%, transparent); color: var(--ui-cyan, #3AA99F);
  font: 0.72rem var(--rv-mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rv-branch:hover { background: color-mix(in oklab, var(--ui-cyan, #3AA99F) 20%, transparent); }
.rv-plus { color: var(--ui-green); } .rv-minus { color: var(--ui-red); }
.rv-tabs { display: flex; gap: 2px; margin-bottom: -1px; }
.rv-tab { position: relative; display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px 10px; border: 0; background: none;
  color: var(--ui-text-tertiary); font: 500 0.8125rem var(--rv-sans); cursor: pointer; transition: color 150ms var(--rv-ease); }
.rv-tab:hover { color: var(--ui-text-primary); }
.rv-tab[data-on='true'] { color: var(--ui-text-primary); }
.rv-tab::after { content: ''; position: absolute; left: 10px; right: 10px; bottom: 0; height: 2px; border-radius: 2px;
  background: var(--ui-accent); transform: scaleX(0); transition: transform 240ms var(--rv-ease); }
.rv-tab[data-on='true']::after { transform: scaleX(1); }
.rv-tab .rv-count { font-size: 0.7rem; }
.rv-tab:disabled { opacity: .4; cursor: default; }
.rv-tab .rv-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--ui-accent); animation: rv-pulse 1.4s ease-in-out infinite; }
@keyframes rv-pulse { 50% { opacity: .3; } }
.rv-body { flex: 1; min-height: 0; position: relative; }
.rv-pane { position: absolute; inset: 0; overflow: auto; animation: rv-fade 220ms var(--rv-ease); }
@keyframes rv-fade { from { opacity: 0; } }

/* overview */
.rv-ov { max-width: 920px; margin: 0 auto; padding: 22px 28px 64px; display: grid; gap: 18px; }
.rv-card { border: 1px solid var(--rv-line); border-radius: 10px; background: var(--rv-card); }
.rv-card-head { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--rv-line); font-size: 0.8rem; }
.rv-card-body { padding: 14px 16px; }
.rv-label { font: 600 0.66rem var(--rv-sans); text-transform: uppercase; letter-spacing: .1em; color: var(--ui-text-quaternary); }
.rv-checks-sum { display: flex; align-items: center; gap: 10px; width: 100%; padding: 11px 14px; border: 0; background: none; color: inherit;
  font: inherit; font-size: 0.85rem; cursor: pointer; text-align: left; }
.rv-checks-sum .codicon-chevron-right { transition: transform 200ms var(--rv-ease); color: var(--ui-text-tertiary); }
.rv-checks-sum[data-open='true'] .codicon-chevron-right { transform: rotate(90deg); }
.rv-checks-bar { display: flex; height: 4px; width: 120px; border-radius: 4px; overflow: hidden; background: var(--ui-control-hover-background); }
.rv-checks-bar span { height: 100%; }
.rv-checks { display: grid; padding: 0 6px 8px; }
.rv-check { display: grid; grid-template-columns: 18px minmax(0,1fr) auto; gap: 10px; align-items: center; padding: 6px 8px; border-radius: 6px;
  font-size: 0.8rem; border: 0; background: none; color: inherit; text-align: left; cursor: pointer; font-family: inherit; }
.rv-check:hover { background: var(--ui-control-hover-background); }
.rv-check-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rv-st-ok { color: var(--ui-green); } .rv-st-bad { color: var(--ui-red); } .rv-st-run { color: var(--ui-yellow); } .rv-st-skip { color: var(--ui-text-quaternary); }
.rv-timeline { display: grid; gap: 14px; }
.rv-event { display: grid; grid-template-columns: 28px minmax(0,1fr); gap: 12px; }
.rv-event-card { border: 1px solid var(--rv-line); border-radius: 10px; overflow: hidden; min-width: 0; }
.rv-event-head { display: flex; align-items: center; gap: 8px; padding: 8px 12px; font-size: 0.8rem; border-bottom: 1px solid var(--rv-line);
  background: color-mix(in oklab, var(--ui-control-hover-background) 60%, transparent); }
.rv-event-head b { font-weight: 600; }
.rv-event-body { padding: 10px 14px; }
.rv-event[data-bot='true'] .rv-event-card { border-style: dashed; }
.rv-collapse { border: 0; background: none; color: var(--ui-text-tertiary); font: 0.75rem var(--rv-sans); cursor: pointer; padding: 0; }
.rv-collapse:hover { color: var(--ui-text-primary); }

/* prose from GitHub */
.rv-prose { font-size: 0.875rem; line-height: 1.6; color: var(--ui-text-secondary); overflow-wrap: anywhere; }
.rv-prose > :first-child { margin-top: 0; } .rv-prose > :last-child { margin-bottom: 0; }
.rv-prose h1, .rv-prose h2, .rv-prose h3, .rv-prose h4 { color: var(--ui-text-primary); font-weight: 600; line-height: 1.3; margin: 1.2em 0 .5em; }
.rv-prose h1 { font-size: 1.15rem; } .rv-prose h2 { font-size: 1.02rem; } .rv-prose h3 { font-size: .95rem; } .rv-prose h4 { font-size: .9rem; }
.rv-prose p, .rv-prose ul, .rv-prose ol, .rv-prose pre, .rv-prose table, .rv-prose blockquote, .rv-prose details { margin: 0 0 .75em; }
.rv-prose ul, .rv-prose ol { padding-left: 1.4em; } .rv-prose ul { list-style: disc; } .rv-prose ol { list-style: decimal; } .rv-prose ul ul { list-style: circle; } .rv-prose li + li { margin-top: .2em; }
.rv-prose a { color: var(--ui-cyan, #3AA99F); text-decoration: none; } .rv-prose a:hover { text-decoration: underline; }
.rv-prose code { font-family: var(--rv-mono); font-size: .82em; padding: .1em .35em; border-radius: 4px;
  background: var(--ui-inline-code-background, var(--ui-control-hover-background)); color: var(--ui-inline-code-foreground, inherit); }
.rv-prose pre { padding: 10px 12px; border-radius: 8px; overflow: auto; background: var(--ui-bg-editor, var(--ui-control-hover-background)); }
.rv-prose pre code { padding: 0; background: none; font-size: .8rem; }
.rv-prose blockquote { padding-left: 12px; border-left: 2px solid var(--ui-stroke-secondary); color: var(--ui-text-tertiary); }
.rv-prose table { border-collapse: collapse; display: block; overflow: auto; }
.rv-prose th, .rv-prose td { border: 1px solid var(--rv-line); padding: 5px 9px; }
.rv-prose img { max-width: 100%; border-radius: 6px; }
.rv-prose hr { border: 0; border-top: 1px solid var(--rv-line); margin: 1em 0; }
.rv-prose summary { cursor: pointer; color: var(--ui-text-primary); }
.rv-prose input[type=checkbox] { margin: 0 .4em 0 0; vertical-align: middle; }
.rv-prose .task-list-item { list-style: none; margin-left: -1.2em; }

/* files */
.rv-files { position: absolute; inset: 0; display: grid; grid-template-columns: 272px minmax(0, 1fr); }
.rv-files[data-tree='false'] { grid-template-columns: 0 minmax(0, 1fr); }
.rv-side { min-height: 0; display: flex; flex-direction: column; border-right: 1px solid var(--rv-line); overflow: hidden; }
.rv-tree { flex: 1; min-height: 0; }
.rv-main { min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.rv-toolbar { flex: none; display: flex; align-items: center; gap: 10px; padding: 8px 14px; border-bottom: 1px solid var(--rv-line); font-size: 0.78rem; }
.rv-diffview { flex: 1; min-height: 0; overflow: auto; padding: 14px 16px 0; }
.rv-thread { margin: 6px 10px 10px; border: 1px solid var(--rv-line); border-radius: 9px; background: var(--rv-card);
  font-family: var(--rv-sans); max-width: 760px; overflow: hidden; }
.rv-thread-item + .rv-thread-item { border-top: 1px solid var(--rv-line); }
.rv-thread-item { padding: 9px 12px; }
.rv-thread-head { display: flex; align-items: center; gap: 8px; font-size: 0.78rem; margin-bottom: 4px; }
.rv-thread-who { font-weight: 600; color: var(--ui-text-primary); }
.rv-thread-body { font-size: 0.82rem; }

/* walkthrough */
.rv-wt { position: absolute; inset: 0; display: grid; grid-template-columns: 300px minmax(0, 1fr); }
.rv-wt-rail { border-right: 1px solid var(--rv-line); overflow: auto; padding: 18px 12px 40px; }
.rv-wt-focus { padding: 0 8px 14px; font-size: 0.8rem; line-height: 1.55; color: var(--ui-text-secondary); }
.rv-wt-focus h3 { margin: 0 0 6px; font-size: 0.95rem; color: var(--ui-text-primary); line-height: 1.35; }
.rv-wt-chapter { margin-top: 14px; }
.rv-wt-chapter > .rv-label { display: block; padding: 0 8px 6px; }
.rv-wt-stop { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 8px; align-items: start; width: 100%; padding: 7px 8px;
  border: 1px solid transparent; border-radius: 8px; background: none; color: var(--ui-text-secondary); font: inherit; font-size: 0.82rem;
  text-align: left; cursor: pointer; transition: background-color 150ms var(--rv-ease), color 150ms var(--rv-ease); }
.rv-wt-stop:hover { background: var(--ui-control-hover-background); color: var(--ui-text-primary); }
.rv-wt-stop[data-on='true'] { background: var(--ui-control-active-background); border-color: var(--rv-line); color: var(--ui-text-primary); }
.rv-wt-n { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; font: 0.68rem var(--rv-mono);
  border: 1px solid var(--ui-stroke-secondary); color: var(--ui-text-tertiary); transition: all 200ms var(--rv-ease); }
.rv-wt-stop[data-seen='true'] .rv-wt-n { border-color: color-mix(in oklab, var(--ui-accent) 55%, transparent); color: var(--ui-accent); }
.rv-wt-stop[data-on='true'] .rv-wt-n { background: var(--ui-accent); border-color: var(--ui-accent); color: #100F0F; }
.rv-wt-main { min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.rv-wt-card { flex: none; padding: 18px 22px 14px; border-bottom: 1px solid var(--rv-line); animation: rv-rise 300ms var(--rv-ease); }
.rv-wt-card h2 { margin: 2px 0 6px; font-size: 1.1rem; font-weight: 600; letter-spacing: -0.01em; }
.rv-wt-summary { margin: 0 0 8px; font-size: 0.9rem; color: var(--ui-text-primary); line-height: 1.5; }
.rv-wt-prose { margin: 0; font-size: 0.85rem; line-height: 1.6; color: var(--ui-text-secondary); max-width: 760px; }
.rv-wt-prose code, .rv-wt-summary code, .rv-wt-check code { font-family: var(--rv-mono); font-size: .82em; padding: .05em .3em; border-radius: 4px;
  background: var(--ui-inline-code-background, var(--ui-control-hover-background)); }
.rv-wt-check { display: flex; gap: 8px; align-items: flex-start; margin-top: 10px; padding: 8px 10px; border-radius: 8px; max-width: 760px;
  font-size: 0.8rem; line-height: 1.5; color: var(--ui-text-secondary);
  background: color-mix(in oklab, var(--ui-accent) 8%, transparent); border: 1px solid color-mix(in oklab, var(--ui-accent) 22%, transparent); }
.rv-wt-check .codicon { color: var(--ui-accent); margin-top: 2px; }
.rv-wt-nav { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.rv-progress { height: 2px; background: var(--ui-control-hover-background); }
.rv-progress span { display: block; height: 100%; background: var(--ui-accent); transition: width 360ms var(--rv-ease); }

/* walkthrough: preparing */
.rv-prep { position: absolute; inset: 0; display: grid; place-items: center; padding: 24px; }
.rv-prep-box { width: min(520px, 100%); display: grid; gap: 18px; justify-items: center; text-align: center; }
.rv-reader { width: 100%; max-width: 420px; padding: 14px 16px; border: 1px solid var(--rv-line); border-radius: 12px; background: var(--rv-card);
  position: relative; overflow: hidden; display: grid; gap: 7px; }
.rv-reader i { display: block; height: 7px; border-radius: 4px; background: var(--ui-control-hover-background); width: var(--w);
  transform-origin: left; animation: rv-read 3.2s var(--rv-ease) infinite; animation-delay: calc(var(--i) * 140ms); }
.rv-reader i[data-k='add'] { --hit: color-mix(in oklab, var(--ui-green) 55%, transparent); }
.rv-reader i[data-k='del'] { --hit: color-mix(in oklab, var(--ui-red) 55%, transparent); }
.rv-reader i[data-k='ctx'] { --hit: color-mix(in oklab, var(--ui-text-quaternary) 70%, transparent); }
@keyframes rv-read { 0%, 12% { background: var(--ui-control-hover-background); } 30%, 62% { background: var(--hit); } 90%, 100% { background: var(--ui-control-hover-background); } }
.rv-reader::after { content: ''; position: absolute; left: 0; right: 0; height: 26px; top: -26px;
  background: linear-gradient(to bottom, transparent, color-mix(in oklab, var(--ui-accent) 16%, transparent), transparent);
  animation: rv-scan 3.2s linear infinite; }
@keyframes rv-scan { to { top: 100%; } }
.rv-prep-line { min-height: 1.5em; font-size: 0.95rem; color: var(--ui-text-primary); }
.rv-prep-line span { display: inline-block; animation: rv-swap 2600ms var(--rv-ease) both; }
@keyframes rv-swap { 0% { opacity: 0; transform: translateY(6px); filter: blur(2px); } 12%, 85% { opacity: 1; transform: none; filter: none; } 100% { opacity: 0; transform: translateY(-6px); filter: blur(2px); } }
.rv-prep-line code { font-family: var(--rv-mono); font-size: .85em; color: var(--ui-accent); }
.rv-cta { display: grid; justify-items: center; gap: 12px; text-align: center; max-width: 440px; }
.rv-cta h3 { margin: 0; font-size: 1.05rem; }
.rv-cta p { margin: 0; color: var(--ui-text-tertiary); font-size: 0.85rem; line-height: 1.55; }
.rv-banner { display: flex; align-items: center; gap: 10px; padding: 8px 14px; font-size: 0.8rem; border-bottom: 1px solid var(--rv-line);
  background: color-mix(in oklab, var(--ui-yellow) 9%, transparent); color: var(--ui-text-secondary); }
.rv-banner .codicon { color: var(--ui-yellow); }
.rv-skeleton { display: grid; gap: 10px; padding: 28px; max-width: 920px; margin: 0 auto; }
.rv-skeleton i { display: block; height: 12px; border-radius: 6px; background: var(--ui-control-hover-background); animation: rv-pulse 1.4s ease-in-out infinite; }

@media (prefers-reduced-motion: reduce) {
  .rv-root *, .rv-root *::before, .rv-root *::after { animation: none !important; transition: none !important; }
}
`

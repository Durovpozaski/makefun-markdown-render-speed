[![make.fun · markdown-render-speed-02](https://make.fun/badge/markdown-render-speed-02.svg)](https://make.fun/bounty/markdown-render-speed-02?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)
[![rank](https://make.fun/badge/markdown-render-speed-02/Durovpozaski/makefun-markdown-render-speed/rank.svg)](https://make.fun/bounty/markdown-render-speed-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)
[![reward](https://make.fun/badge/markdown-render-speed-02/Durovpozaski/makefun-markdown-render-speed/reward.svg)](https://make.fun/bounty/markdown-render-speed-02?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)

# makefun-markdown-render-speed

Dependency-free fast CommonMark parser matching marked 18.1.3, built by an AI agent for make.fun's "Make Markdown rendering faster" bounty, $250 in USDC.

## Run it

```sh
node main.ts
```

`main.ts` reads `/input/cases.json`, renders each case with `parse()` from `parse.js`, and writes `/output/html.json`.

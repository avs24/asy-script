# Asymptote source smoke test

`mobius-formula-poc.asy` is the standalone Asymptote source, including the original labels, for local LaTeX use. Compile it with native Asymptote:

```sh
asy -f svg mobius-formula-poc.asy
```

`mobius-wasm-poc.html` is the Möbius test. It draws a triangle with both angle marks, uses `dot("A", A, N, UnFill)` style point labels, and places side labels `a`, `b`, `\( \sqrt{2} \)`, and `60^\circ`. It uses `unitsize(2cm)`, 16px text, and a 6px label gap. Its status line reports the library version and how many labels were placed.

The browser needs internet access for the GitHub CDN, Asymptote WebAssembly package, and MathJax. Rendering happens in the browser; no personal render server or University of Alberta service is involved.

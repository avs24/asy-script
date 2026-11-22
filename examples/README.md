# Asymptote source smoke test

`mobius-formula-poc.asy` is the standalone Asymptote source, including the original labels, for local LaTeX use. Compile it with native Asymptote:

```sh
asy -f svg mobius-formula-poc.asy
```

`mobius-wasm-poc.html` is the first Möbius test. It draws only a triangle and shows a status line with the library version and render result. It loads `mobius-figure.js`, which runs the Asymptote compiler in browser WebAssembly.

The browser needs internet access for the GitHub CDN, Asymptote WebAssembly package, and MathJax. Rendering happens in the browser; no personal render server or University of Alberta service is involved.

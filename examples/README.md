# Asymptote source smoke test

`mobius-formula-poc.asy` is the standalone Asymptote version of the triangle used in the Möbius test. Compile it with native Asymptote to use the figure in a LaTeX workflow:

```sh
asy -f svg mobius-formula-poc.asy
```

`mobius-wasm-poc.html` contains the Möbius HTML fragment. It loads `mobius-figure.js`, which runs the Asymptote compiler in browser WebAssembly and overlays MathJax-rendered formulas. The original `.asy` source remains intact.

The browser needs internet access for the GitHub CDN, Asymptote WebAssembly package, and MathJax. Rendering happens in the browser; no personal render server or University of Alberta service is involved.

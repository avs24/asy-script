# Asymptote figures in Möbius

This project is a browser-side proof of concept for putting Asymptote figures in Möbius question HTML. The browser runs the Asymptote compiler as WebAssembly, then typesets formula labels with MathJax and places them over the generated SVG. It does not send source to a rendering server.

The original Asymptote stays in a `text/asymptote` script block, so the same code can be copied into a local `.asy` file for LaTeX.

## Try the Möbius example

After the first version is published, paste the contents of [`examples/mobius-wasm-poc.html`](examples/mobius-wasm-poc.html) into a Möbius question's HTML editor. The example draws a triangle, its angle marks, point names, and two typeset formulas. It tests both `label("\( ... \)", point, alignment)` and a formula inside `markangle("...", ...)`.

The page needs internet access to download the JavaScript wrapper, Asymptote WebAssembly files, and MathJax. Rendering itself runs in the user's browser. It does not depend on the Asymptote online service or a personal rendering server.

The line above the figure reports the library version and render status. It shows whether the WebAssembly drawing loaded, how many formula labels were placed, or an error to help diagnose a failed preview.

## Local Asymptote / LaTeX use

The example source is also saved as [`examples/mobius-formula-poc.asy`](examples/mobius-formula-poc.asy). Compile it with Asymptote as usual:

```sh
asy -f svg examples/mobius-formula-poc.asy
```

## Current scope

- Direct `label("...", point, alignment)` calls with math delimited by `\(...\)` or `\[...\]` are extracted for browser typesetting.
- Formula labels passed directly to the pair-based `markangle("...", C, A, B, ...)` are also overlaid; the example uses Möbius-compatible `/(` syntax.
- Other Asymptote commands and plain text labels are left for the WebAssembly renderer.
- Formula color and some advanced Asymptote label options are not yet carried over. The initial example checks the required placement and font rendering first.

This is an early prototype, not yet a versioned release.

const asymptoteModuleUrl = "https://cdn.jsdelivr.net/npm/asymptote-web/dist/asymptote-web.js";
const mathJaxSource = "https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js";
const libraryVersion = "0.8.0";
let enginePromise;
let mathJaxPromise;

function getAsymptoteEngine() {
  if (!enginePromise) {
    enginePromise = import(asymptoteModuleUrl).then(({ createAsymptote, getAssetUrls }) =>
      createAsymptote(getAssetUrls()),
    );
  }
  return enginePromise;
}

function isWordCharacter(character) {
  return Boolean(character && /[A-Za-z0-9_$]/.test(character));
}

function skipQuotedOrComment(source, index) {
  const current = source[index];
  const next = source[index + 1];

  if (current === '"') {
    let cursor = index + 1;
    while (cursor < source.length) {
      if (source[cursor] === "\\") {
        cursor += 2;
      } else if (source[cursor] === '"') {
        return cursor + 1;
      } else {
        cursor += 1;
      }
    }
    return source.length;
  }

  if (current === "/" && next === "/") {
    const newline = source.indexOf("\n", index + 2);
    return newline < 0 ? source.length : newline + 1;
  }

  if (current === "/" && next === "*") {
    const close = source.indexOf("*/", index + 2);
    return close < 0 ? source.length : close + 2;
  }

  return index;
}

function findClosingParen(source, openIndex) {
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    const skipped = skipQuotedOrComment(source, index);
    if (skipped !== index) {
      index = skipped - 1;
      continue;
    }

    if (source[index] === "(") depth += 1;
    if (source[index] === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function splitArguments(source, openIndex, closeIndex) {
  const ranges = [];
  let start = openIndex + 1;
  let round = 0;
  let square = 0;
  let curly = 0;

  for (let index = start; index < closeIndex; index += 1) {
    const skipped = skipQuotedOrComment(source, index);
    if (skipped !== index) {
      index = skipped - 1;
      continue;
    }

    const character = source[index];
    if (character === "(") round += 1;
    else if (character === ")") round -= 1;
    else if (character === "[") square += 1;
    else if (character === "]") square -= 1;
    else if (character === "{") curly += 1;
    else if (character === "}") curly -= 1;
    else if (character === "," && round === 0 && square === 0 && curly === 0) {
      ranges.push({ start, end: index });
      start = index + 1;
    }
  }

  ranges.push({ start, end: closeIndex });
  return ranges;
}

function findFunctionCalls(source, functionName) {
  const calls = [];
  let index = 0;

  while (index < source.length) {
    const skipped = skipQuotedOrComment(source, index);
    if (skipped !== index) {
      index = skipped;
      continue;
    }

    if (!/[A-Za-z_]/.test(source[index])) {
      index += 1;
      continue;
    }

    const start = index;
    index += 1;
    while (index < source.length && /[A-Za-z0-9_]/.test(source[index])) index += 1;
    const name = source.slice(start, index);
    if (name !== functionName || isWordCharacter(source[start - 1])) continue;

    let openIndex = index;
    while (/\s/.test(source[openIndex] || "")) openIndex += 1;
    if (source[openIndex] !== "(") continue;

    const closeIndex = findClosingParen(source, openIndex);
    if (closeIndex < 0) continue;
    calls.push({
      start,
      openIndex,
      closeIndex,
      args: splitArguments(source, openIndex, closeIndex),
    });
    index = closeIndex + 1;
  }

  return calls;
}

function decodeAsyStringLiteral(source, range) {
  const token = source.slice(range.start, range.end).trim();
  if (token.length < 2 || token[0] !== '"' || token.at(-1) !== '"') return null;
  return token.slice(1, -1).replace(/\\([\\"])/g, "$1");
}

function mathSourceFromLabel(label) {
  const value = label.trim();
  if (value.startsWith("\\(") && value.endsWith("\\)")) {
    return value.slice(2, -2).trim();
  }
  // In Möbius, use /(...\) in source strings where dollar delimiters conflict
  // with the question editor's own formula handling.
  if (value.startsWith("/(") && value.endsWith("\\)")) {
    return value.slice(2, -2).trim();
  }
  if (value.startsWith("\\[") && value.endsWith("\\]")) {
    return value.slice(2, -2).trim();
  }
  return null;
}

function setStatus(figure, message, state) {
  const status = figure.querySelector("[data-asy-status]");
  if (!status) return;
  status.textContent = `Asymptote Möbius v${libraryVersion}: ${message}`;
  status.dataset.state = state;
}

function markerColor(index) {
  const r = 239;
  const g = (29 + index * 73) % 251;
  const b = (137 + index * 113) % 251;
  return {
    css: `rgb(${r}, ${g}, ${b})`,
    asy: `rgb(${r}/255,${g}/255,${b}/255)`,
  };
}

function getAlignment(call, source) {
  if (!call.args[2]) return "NoAlign";
  const arg = source.slice(call.args[2].start, call.args[2].end).trim();
  const named = arg.match(/\balign\s*=\s*([A-Za-z]+)/);
  return named ? named[1] : arg.split("=").at(-1).trim();
}

function statementEnd(source, closeIndex) {
  let end = closeIndex + 1;
  while (/\s/.test(source[end] || "")) end += 1;
  if (source[end] === ";") end += 1;
  return end;
}

const markAnglePositionHelper = `
import geometry;
pair mobiusAsyLabelPointForMarkAngle(
  int n=1, real radius=0, real space=0,
  pair A, pair O, pair B,
  arrowbar arrow=None, pen p=currentpen, filltype ft=NoFill,
  margin markmargin=NoMargin, marker mark=nomarker)
{
  if(space == 0) space=markanglespace(p);
  if(radius == 0) radius=markangleradius(p);
  pair OB=unit(B-O), OA=unit(A-O);
  real xoa=degrees(OA,false);
  real gle=degrees(acos(dot(OA,OB)));
  if((conj(OA)*OB).y < 0) gle *= -1;
  real labelRadius=abs(radius)+(n-1)*space;
  transform t=inverse(currentpicture.calculateTransform());
  pair offset=t*(labelRadius*dir(xoa+gle/2))-t*(0,0);
  return O+offset;
}
`;

export function prepareAsySource(source) {
  const edits = [];
  const overlays = [];
  let needsMarkAngleHelper = false;
  let nextMarkerIndex = 0;

  for (const call of findFunctionCalls(source, "label")) {
    if (call.args.length < 2) continue;
    const label = decodeAsyStringLiteral(source, call.args[0]);
    if (label === null) continue;
    const tex = mathSourceFromLabel(label);

    const position = source.slice(call.args[1].start, call.args[1].end).trim();
    if (!position) continue;

    const color = markerColor(nextMarkerIndex++);
    edits.push({
      start: call.start,
      end: statementEnd(source, call.closeIndex),
      text: `{ dot(${position}, ${color.asy}+linewidth(2bp)); }`,
    });
    overlays.push({
      kind: tex ? "math" : "text",
      tex,
      text: label,
      position,
      alignment: getAlignment(call, source),
      color: color.css,
    });
  }

  for (const call of findFunctionCalls(source, "markangle")) {
    if (call.args.length < 4) continue;
    const label = decodeAsyStringLiteral(source, call.args[0]);
    if (label === null) continue;
    const tex = mathSourceFromLabel(label);
    if (!tex) continue;

    const restArgs = source.slice(call.args[0].end, call.closeIndex).replace(/^\s*,/, "");
    const vertex = source.slice(call.args[2].start, call.args[2].end).trim();
    if (!restArgs || !vertex) continue;

    const color = markerColor(nextMarkerIndex++);
    const originColor = markerColor(nextMarkerIndex++);
    const index = overlays.length;
    const pointName = `_mobiusAsyAnglePoint${index}`;
    edits.push({
      start: call.start,
      end: statementEnd(source, call.closeIndex),
      text: `{ pair ${pointName}=mobiusAsyLabelPointForMarkAngle(${restArgs}); markangle("",${restArgs}); dot(${pointName},${color.asy}+linewidth(2bp)); dot(${vertex},${originColor.asy}+linewidth(2bp)); }`,
    });
    overlays.push({
      kind: "math",
      tex,
      position: pointName,
      alignment: "Angle",
      color: color.css,
      originPosition: vertex,
      originColor: originColor.css,
    });
    needsMarkAngleHelper = true;
  }

  let renderedSource = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    renderedSource = renderedSource.slice(0, edit.start) + edit.text + renderedSource.slice(edit.end);
  }

  if (needsMarkAngleHelper) renderedSource = `${markAnglePositionHelper}\n${renderedSource}`;

  return { source: renderedSource, overlays };
}

function parseCssRgb(value) {
  const rgb = value?.match(/rgba?\(([^)]+)\)/i)?.[1];
  if (rgb) {
    const channels = rgb.split(/[\s,\/]+/).filter(Boolean).slice(0, 3);
    if (channels.length === 3) {
      return channels.map((channel) => {
        const number = Number.parseFloat(channel);
        return channel.endsWith("%") ? Math.round(number * 2.55) : Math.round(number);
      });
    }
  }
  const hex = value?.trim().match(/^#([\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i)?.[1];
  if (!hex) return null;
  const expanded = hex.length <= 4
    ? [...hex.slice(0, 3)].map((digit) => digit + digit).join("")
    : hex.slice(0, 6);
  return [0, 2, 4].map((index) => Number.parseInt(expanded.slice(index, index + 2), 16));
}

function transformedBox(element, svg) {
  const box = element.getBBox();
  const matrix = element.getCTM();
  if (!matrix) return null;
  const corners = [
    [box.x, box.y],
    [box.x + box.width, box.y],
    [box.x, box.y + box.height],
    [box.x + box.width, box.y + box.height],
  ].map(([x, y]) => {
    const point = svg.createSVGPoint();
    point.x = x;
    point.y = y;
    return point.matrixTransform(matrix);
  });
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

function markerPoint(svg, color) {
  const expected = parseCssRgb(color);
  const elements = Array.from(svg.querySelectorAll("*"));
  const matches = elements.filter((element) => {
    if (element.closest("defs")) return false;
    const actualColors = [
      element.getAttribute("fill"),
      element.style.fill,
      getComputedStyle(element).fill,
      element.getAttribute("stroke"),
      element.style.stroke,
      getComputedStyle(element).stroke,
    ].map(parseCssRgb).filter(Boolean);
    return actualColors.some((actual) =>
      actual.every((channel, index) => Math.abs(channel - expected[index]) <= 8),
    );
  });

  if (matches.length === 0) return null;

  // Prefer the deepest matching SVG nodes. WASM output may put marker colors
  // on a group or <use>, not directly on a circle/path as native Asymptote does.
  const leaves = matches.filter((element) =>
    !Array.from(element.querySelectorAll("*")).some((child) => matches.includes(child)),
  );
  const boxes = leaves.map((element) => transformedBox(element, svg)).filter(Boolean);
  if (boxes.length === 0) return null;
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  leaves.forEach((element) => element.remove());
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

function preserveSvgColors(svg) {
  // Möbius page styles can override SVG presentation attributes. Copy Asy's
  // explicit colors to inline styles so lines and markers retain their colors.
  for (const element of svg.querySelectorAll("[fill], [stroke]")) {
    const fill = element.getAttribute("fill");
    const stroke = element.getAttribute("stroke");
    if (fill) element.style.fill = fill;
    if (stroke) element.style.stroke = stroke;
  }
}

function loadMathJax() {
  if (mathJaxPromise) return mathJaxPromise;

  mathJaxPromise = new Promise((resolve, reject) => {
    if (window.MathJax?.typesetPromise || window.MathJax?.Hub?.Queue) {
      resolve(window.MathJax);
      return;
    }

    if (!window.MathJax) {
      window.MathJax = {
        startup: { typeset: false },
        svg: { fontCache: "none" },
      };
    }

    const script = document.createElement("script");
    script.src = mathJaxSource;
    script.async = true;
    script.onload = async () => {
      try {
        await window.MathJax.startup?.promise;
        resolve(window.MathJax);
      } catch (error) {
        reject(error);
      }
    };
    script.onerror = () => reject(new Error("Could not load the browser math renderer."));
    document.head.append(script);
  });

  return mathJaxPromise;
}

async function typeset(mathJax, elements) {
  if (mathJax.typesetPromise) {
    await mathJax.typesetPromise(elements);
    return;
  }
  for (const element of elements) {
    await new Promise((resolve) => {
      mathJax.Hub.Queue(["Typeset", mathJax.Hub, element], resolve);
    });
  }
}

function direction(alignment) {
  const value = alignment.replace(/^align\s*=\s*/, "");
  const directions = new Set(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]);
  return directions.has(value) ? value : "NoAlign";
}

async function placeMathOverlays(output, svg, overlays) {
  if (overlays.length === 0) return { placed: 0, total: 0 };
  const mathJax = overlays.some((overlay) => overlay.kind === "math")
    ? await loadMathJax()
    : null;
  const records = [];
  let missing = 0;
  const fontSizePx = Number(
    output.closest("[data-mobius-asy]")?.dataset.asyFontSize || 16,
  );
  const labelGap = Number(
    output.closest("[data-mobius-asy]")?.dataset.asyLabelGap || fontSizePx * 0.25,
  );

  function toClientPoint(point) {
    if (!point) return null;
    const screenPoint = svg.createSVGPoint();
    screenPoint.x = point.x;
    screenPoint.y = point.y;
    return screenPoint.matrixTransform(svg.getScreenCTM());
  }

  for (const overlay of overlays) {
    const point = markerPoint(svg, overlay.color);
    if (!point) {
      missing += 1;
      continue;
    }
    const origin = overlay.originColor ? markerPoint(svg, overlay.originColor) : null;
    const clientPoint = toClientPoint(point);
    const originClientPoint = toClientPoint(origin);

    const element = document.createElement("span");
    element.className = "mobius-asy-math-label";
    element.textContent = overlay.kind === "math"
      ? `\\(${overlay.tex}\\)`
      : overlay.text;
    Object.assign(element.style, {
      position: "absolute",
      display: "inline-block",
      visibility: "hidden",
      whiteSpace: "nowrap",
      lineHeight: "1",
      margin: "0",
      padding: "0",
      color: "#111",
      fontSize: `${fontSizePx}px`,
      zIndex: "2",
    });
    output.append(element);
    records.push({ overlay, element, clientPoint, originClientPoint });
  }

  if (records.length === 0) return { placed: 0, total: overlays.length };
  const mathElements = records
    .filter((record) => record.overlay.kind === "math")
    .map((record) => record.element);
  if (mathElements.length > 0) await typeset(mathJax, mathElements);

  const currentRect = output.getBoundingClientRect();
  for (const { overlay, element, clientPoint, originClientPoint } of records) {
    const rect = element.getBoundingClientRect();
    const pointX = clientPoint.x - currentRect.left;
    const pointY = clientPoint.y - currentRect.top;
    let left = pointX;
    let top = pointY;

    if (overlay.alignment === "Angle" && originClientPoint) {
      const dx = clientPoint.x - originClientPoint.x;
      const dy = clientPoint.y - originClientPoint.y;
      const length = Math.hypot(dx, dy) || 1;
      const nx = dx / length;
      const ny = dy / length;
      const support = Math.abs(nx) * rect.width / 2 + Math.abs(ny) * rect.height / 2;
      const centerX = pointX + nx * (support + labelGap);
      const centerY = pointY + ny * (support + labelGap);
      left = centerX - rect.width / 2;
      top = centerY - rect.height / 2;
    } else {
      const align = direction(overlay.alignment);
      if (align.endsWith("W") || align === "W") left -= rect.width + labelGap;
      else if (!align.endsWith("E") && align !== "E") left -= rect.width / 2;
      else left += labelGap;

      if (align.startsWith("N") || align === "N") top -= rect.height + labelGap;
      else if (!align.startsWith("S") && align !== "S") top -= rect.height / 2;
      else top += labelGap;
    }

    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
    element.style.visibility = "visible";
  }
  return { placed: records.length, total: overlays.length, missing };
}

async function renderFigure(sourceBlock) {
  const figure = sourceBlock.closest("[data-mobius-asy]");
  const output = figure?.querySelector("[data-asy-output]");
  if (!output) return;

  setStatus(figure, "loading browser renderer…", "loading");
  output.textContent = "Rendering Asymptote…";
  output.style.position = "relative";

  try {
    const prepared = prepareAsySource(sourceBlock.textContent);
    const asy = await getAsymptoteEngine();
    const result = await asy.render(prepared.source, { format: "svg" });
    output.innerHTML = result.svg ?? result.output;
    output.dataset.state = "ready";

    const svg = output.querySelector("svg");
    if (!svg) throw new Error("The WebAssembly renderer returned no SVG.");
    preserveSvgColors(svg);
    svg.style.display = "block";
    svg.style.maxWidth = "100%";
    svg.style.height = "auto";
    setStatus(figure, "drawing rendered; typesetting formulas…", "working");
    const overlayResult = await placeMathOverlays(output, svg, prepared.overlays);
    if (overlayResult.total === 0) {
      setStatus(figure, "ready — Asymptote drawing rendered", "ready");
    } else if (overlayResult.placed === overlayResult.total) {
      setStatus(figure, `ready — drawing and ${overlayResult.placed} text/math label(s) rendered`, "ready");
    } else {
      setStatus(figure, `partial — drawing rendered, ${overlayResult.placed}/${overlayResult.total} text/math label(s) placed`, "partial");
    }
  } catch (error) {
    setStatus(figure, `error — ${error.message}`, "error");
    output.textContent = `Could not render this figure: ${error.message}`;
    output.dataset.state = "error";
  }
}

export async function renderAll(root = document) {
  const sourceBlocks = root.querySelectorAll(
    "[data-mobius-asy] script[type='text/asymptote']",
  );
  await Promise.all(Array.from(sourceBlocks, renderFigure));
}

if (typeof document !== "undefined") renderAll();

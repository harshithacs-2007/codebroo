import { useMemo } from "react";
import type { HeapObject, Snapshot, VizValue } from "@codebroo/core";

export function HeapViz({ snap, prev }: { snap: Snapshot | null; prev: Snapshot | null }) {
  const layout = useMemo(() => (snap ? layoutOf(snap, prev) : null), [snap, prev]);
  if (!snap || !layout) {
    return (
      <div className="viz-empty">
        Stack on the left. Heap on the right. Arrows are references — remotes, not extra TVs.
        <br />
        Run or step to paint actual JVM state.
      </div>
    );
  }

  return (
    <svg className="heap-svg" viewBox={`0 0 ${layout.w} ${layout.h}`} role="img" aria-label="Program heap and stack">
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <polygon points="0 0, 7 3, 0 6" fill="#1d6a63" />
        </marker>
      </defs>
      <text className="region" x="24" y="22">
        STACK
      </text>
      <text className="region" x={layout.heapX} y="22">
        HEAP
      </text>
      {layout.vars.map((v) => (
        <g key={v.name}>
          <text className="name" x="24" y={v.y}>
            {v.name}
          </text>
          <text className="slot" x="24" y={v.y + 14}>
            {v.text}
          </text>
        </g>
      ))}
      {layout.objs.map((o) => (
        <g key={o.id}>
          <rect className={"obj" + (o.hot ? " hot" : "")} x={o.x} y={o.y} width={o.w} height={o.h} rx="8" />
          <text className="name" x={o.x + 10} y={o.y + 16}>
            {o.type} #{o.id}
          </text>
          {o.slots.map((s, i) => (
            <text key={s.key} className={"slot" + (s.hot ? " mut" : "")} x={o.x + 10} y={o.y + 34 + i * 14}>
              [{s.key}] {s.text}
            </text>
          ))}
        </g>
      ))}
      {layout.arrows.map((a, i) => (
        <path key={i} className="arrow" d={a} />
      ))}
    </svg>
  );
}

function fmt(v: VizValue): string {
  if (v.k === "null") return "null";
  if (v.k === "prim") return v.v;
  return "→ #" + v.id;
}

function layoutOf(snap: Snapshot, prev: Snapshot | null) {
  const w = 900;
  const heapX = 280;
  const frame = snap.frames[0];
  const vars = (frame?.vars ?? [])
    .filter((v) => v.name !== "args")
    .map((v, i) => ({
    name: v.name,
    text: fmt(v.value),
    y: 48 + i * 36,
    value: v.value,
  }));
  const prevMap = new Map<string, HeapObject>();
  for (const o of prev?.heap ?? []) prevMap.set(o.id, o);

  const keep = new Set<string>();
  for (const v of vars) {
    if (v.value.k === "ref") keep.add(v.value.id);
  }
  const objs = snap.heap
    .filter((o) => keep.has(o.id))
    .map((o, i) => {
    const prevO = prevMap.get(o.id);
    const slots = o.slots.map((s) => {
      const old = prevO?.slots.find((x) => x.key === s.key);
      const hot = old ? JSON.stringify(old.value) !== JSON.stringify(s.value) : false;
      return { key: s.key, text: fmt(s.value), hot, value: s.value };
    });
    const h = Math.max(48, 28 + slots.length * 14);
    return {
      id: o.id,
      type: o.type,
      x: heapX + (i % 2) * 250,
      y: 40 + Math.floor(i / 2) * (h + 24),
      w: 230,
      h,
      slots,
      hot: slots.some((s) => s.hot),
    };
  });
  const objById = new Map(objs.map((o) => [o.id, o]));
  const arrows: string[] = [];
  for (const v of vars) {
    if (v.value.k === "ref") {
      const t = objById.get(v.value.id);
      if (t) arrows.push(curve(70, v.y - 4, t.x, t.y + 16));
    }
  }
  for (const o of objs) {
    for (const s of o.slots) {
      if (s.value.k === "ref") {
        const t = objById.get(s.value.id);
        if (t && t.id !== o.id) arrows.push(curve(o.x + o.w, o.y + 24, t.x, t.y + 16));
      }
    }
  }
  const h = Math.max(200, ...objs.map((o) => o.y + o.h + 24), ...vars.map((v) => v.y + 28));
  return { w, h, heapX, vars, objs, arrows };
}

function curve(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

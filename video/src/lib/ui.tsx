import {Line, Node, Rect, Txt} from "@motion-canvas/2d";
import {createRef, type Reference} from "@motion-canvas/core";
import {C, FONT} from "./brand";

/** Подпись в стиле сайта: «01 — ПРОБЛЕМА». */
export function label(text: string, props: {x?: number; y?: number; fill?: string; size?: number} = {}) {
  return (
    <Txt
      text={text.toUpperCase()}
      fontFamily={FONT}
      fontWeight={500}
      fontSize={props.size ?? 22}
      letterSpacing={(props.size ?? 22) * 0.12}
      fill={props.fill ?? C.muted}
      x={props.x ?? 0}
      y={props.y ?? 0}
      offset={[-1, 0]}
    />
  );
}

export type SheetRefs = {
  root: Reference<Rect>;
  lines: Reference<Line>[];
  seal: Reference<Line>;
};

/**
 * Лист документа: светлый прямоугольник с заголовком, строками текста
 * (линии, которые «пишутся») и бордовой отметкой внизу.
 */
export function sheet(opts: {
  title: string;
  subtitle?: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  rotation?: number;
  rows?: number;
}): {node: Node; refs: SheetRefs} {
  const width = opts.width ?? 400;
  const height = opts.height ?? 540;
  const rows = opts.rows ?? 7;
  const root = createRef<Rect>();
  const seal = createRef<Line>();
  const lines: Reference<Line>[] = [];
  const pad = 44;
  const top = -height / 2 + pad;
  const rowStart = top + (opts.subtitle ? 140 : 110);
  const rowGap = Math.min(34, (height - (rowStart + height / 2) - 110) / Math.max(rows - 1, 1));

  const node = (
    <Rect
      ref={root}
      width={width}
      height={height}
      x={opts.x ?? 0}
      y={opts.y ?? 0}
      rotation={opts.rotation ?? 0}
      fill={C.paper}
      shadowColor={"rgba(0,0,0,0.45)"}
      shadowBlur={60}
      shadowOffsetY={24}
    >
      <Rect width={width} height={8} y={-height / 2 + 4} fill={C.navy} />
      {opts.subtitle ? (
        <Txt
          text={opts.subtitle.toUpperCase()}
          fontFamily={FONT}
          fontWeight={500}
          fontSize={15}
          letterSpacing={1.8}
          fill={C.inkMuted}
          x={-width / 2 + pad}
          y={top + 34}
          offset={[-1, 0]}
        />
      ) : null}
      <Txt
        text={opts.title}
        fontFamily={FONT}
        fontWeight={600}
        fontSize={30}
        lineHeight={38}
        fill={C.ink}
        x={-width / 2 + pad}
        y={top + (opts.subtitle ? 78 : 50)}
        offset={[-1, 0]}
      />
      {Array.from({length: rows}, (_, i) => {
        const ref = createRef<Line>();
        lines.push(ref);
        const len = i % 3 === 2 ? 0.62 : i % 4 === 1 ? 0.84 : 0.95;
        const y = rowStart + i * rowGap;
        return (
          <Line
            ref={ref}
            points={[
              [-width / 2 + pad, y],
              [-width / 2 + pad + (width - pad * 2) * len, y],
            ]}
            stroke={C.paperLine}
            lineWidth={8}
            lineCap={"round"}
            end={0}
          />
        );
      })}
      <Line
        ref={seal}
        points={[
          [-width / 2 + pad, height / 2 - pad - 10],
          [-width / 2 + pad + 120, height / 2 - pad - 10],
        ]}
        stroke={C.accent}
        lineWidth={4}
        end={0}
      />
    </Rect>
  ) as Node;

  return {node, refs: {root, lines, seal}};
}

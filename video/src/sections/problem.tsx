import {Line, Node, Rect, Txt} from "@motion-canvas/2d";
import {all, createRef, delay, easeInOutCubic, easeOutCubic, sequence, type ThreadGenerator} from "@motion-canvas/core";
import {C, FONT} from "../lib/brand";
import {cueAt, fadeIn, runScene} from "../lib/flow";
import {label, sheet} from "../lib/ui";

const ID = "problem";

/**
 * Проблема: чертёж объекта и неизвестная стоимость, затем два расчёта
 * сторон, которые не совпадают.
 */
export function* problem(root: Node): ThreadGenerator {
  const group = createRef<Node>();
  const building = createRef<Node>();
  const outline = createRef<Rect>();
  const roof = createRef<Line>();
  const ground = createRef<Line>();
  const dimV = createRef<Line>();
  const dimH = createRef<Line>();
  const windows: ReturnType<typeof createRef<Rect>>[] = [];
  const valueGroup = createRef<Node>();
  const qBox = createRef<Rect>();
  const q = createRef<Txt>();
  const disputeGroup = createRef<Node>();
  const neq = createRef<Txt>();

  const bx = -440;
  const sheetA = sheet({title: "Расчёт\nстороны А", subtitle: "Позиция 1", width: 320, height: 420, x: 170, y: 10, rotation: -5, rows: 5});
  const sheetB = sheet({title: "Расчёт\nстороны Б", subtitle: "Позиция 2", width: 320, height: 420, x: 600, y: 30, rotation: 4, rows: 5});

  root.add(
    <Node ref={group}>
      <Node ref={building}>
        <Line ref={ground} points={[[bx - 360, 240], [bx + 360, 240]]} stroke={C.line} lineWidth={2} end={0} />
        <Rect ref={outline} x={bx} y={20} width={440} height={440} stroke={C.white} lineWidth={2.5} end={0} />
        <Line
          ref={roof}
          points={[[bx - 260, -200], [bx, -330], [bx + 260, -200], [bx - 260, -200]]}
          stroke={C.white}
          lineWidth={2.5}
          end={0}
        />
        {Array.from({length: 16}, (_, i) => {
          const ref = createRef<Rect>();
          windows.push(ref);
          const col = i % 4;
          const row = Math.floor(i / 4);
          return (
            <Rect
              ref={ref}
              x={bx - 150 + col * 100}
              y={-130 + row * 92}
              width={50}
              height={62}
              stroke={C.line}
              lineWidth={1.5}
              opacity={0}
            />
          );
        })}
        <Line
          ref={dimV}
          points={[[bx - 300, -200], [bx - 300, 240]]}
          stroke={C.accentOnDark}
          lineWidth={1.5}
          lineDash={[10, 8]}
          end={0}
        />
        <Line
          ref={dimH}
          points={[[bx - 220, 290], [bx + 220, 290]]}
          stroke={C.accentOnDark}
          lineWidth={1.5}
          lineDash={[10, 8]}
          end={0}
        />
      </Node>

      <Node ref={valueGroup} x={40} y={-40} opacity={0}>
        {label("Объект оценки", {x: 0, y: -170})}
        <Txt
          text={"Стоимость"}
          fontFamily={FONT}
          fontWeight={600}
          fontSize={110}
          fill={C.white}
          offset={[-1, 0]}
          y={-70}
        />
        <Rect ref={qBox} x={210} y={110} width={420} height={150} stroke={C.white} lineWidth={2} end={0} />
        <Txt ref={q} text={"?"} fontFamily={FONT} fontWeight={600} fontSize={110} fill={C.accentOnDark} x={210} y={112} opacity={0} />
      </Node>

      <Node ref={disputeGroup} opacity={0}>
        {sheetA.node}
        {sheetB.node}
        <Txt ref={neq} text={"≠"} fontFamily={FONT} fontWeight={500} fontSize={140} fill={C.accentOnDark} x={385} y={-300} opacity={0} />
      </Node>
    </Node>,
  );

  const drawBuilding = sequence(
    0.12,
    ground().end(1, 0.9, easeInOutCubic),
    outline().end(1, 1.4, easeInOutCubic),
    roof().end(1, 1.1, easeInOutCubic),
    sequence(0.04, ...windows.map((w) => w().opacity(1, 0.3))),
    all(dimV().end(1, 0.8), dimH().end(1, 0.8)),
  );

  const showValue = all(
    fadeIn(valueGroup(), 0.9),
    delay(0.5, qBox().end(1, 0.9, easeInOutCubic)),
    delay(1.1, q().opacity(1, 0.4)),
    delay(1.6, q().scale(1.12, 0.35).to(1, 0.35)),
  );

  const writeSheet = (refs: typeof sheetA.refs, lengths: number[]) =>
    sequence(0.12, ...refs.lines.map((l, i) => l().end(lengths[i] ?? 1, 0.45, easeOutCubic)));

  const dispute = all(
    valueGroup().opacity(0, 0.5),
    building().opacity(0.35, 0.8),
    building().x(-60, 1.2, easeInOutCubic),
    delay(0.2, fadeIn(disputeGroup(), 0.8, 40)),
    delay(0.6, writeSheet(sheetA.refs, [1, 0.7, 1, 0.5, 0.85])),
    delay(0.9, writeSheet(sheetB.refs, [0.6, 1, 0.8, 1, 0.4])),
    delay(1.8, neq().opacity(1, 0.5)),
  );

  yield* runScene(ID, group(), drawBuilding, delay(cueAt(ID, 0) + 0.4, showValue), delay(cueAt(ID, 1) - 0.2, dispute));
}

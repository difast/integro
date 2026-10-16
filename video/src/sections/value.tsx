import {Line, Node, Txt} from "@motion-canvas/2d";
import {all, createRef, delay, easeInOutCubic, easeOutCubic, sequence, type ThreadGenerator} from "@motion-canvas/core";
import {C, FONT} from "../lib/brand";
import {cueAt, runScene} from "../lib/flow";
import {sheet} from "../lib/ui";

const ID = "value";

const points = [
  {title: "Ясность", text: "понятный ответ на ваш вопрос"},
  {title: "Аргументированные выводы", text: "методы, расчёты и источники"},
  {title: "Документ", text: "для сделки, переговоров или суда"},
];

/** Ценность для клиента: ясность, аргументы, документ. */
export function* value(root: Node): ThreadGenerator {
  const group = createRef<Node>();
  const rows = points.map(() => createRef<Node>());
  const rules = points.map(() => createRef<Line>());
  const doc = sheet({title: "Отчёт\nоб оценке", subtitle: "Итоговый документ", width: 420, height: 540, x: 560, y: -20, rotation: 3, rows: 7});

  root.add(
    <Node ref={group}>
      {points.map((p, i) => (
        <Node ref={rows[i]} x={-860} y={-250 + i * 190} opacity={0}>
          <Line ref={rules[i]} points={[[0, -62], [900, -62]]} stroke={C.line} lineWidth={1.5} end={0} />
          <Txt
            text={String(i + 1).padStart(2, "0")}
            fontFamily={FONT}
            fontWeight={500}
            fontSize={24}
            fill={C.accentOnDark}
            offset={[-1, 0]}
            y={-18}
          />
          <Txt text={p.title} fontFamily={FONT} fontWeight={600} fontSize={60} fill={C.white} offset={[-1, 0]} x={70} y={-12} />
          <Txt text={p.text} fontFamily={FONT} fontWeight={400} fontSize={26} fill={C.muted} offset={[-1, 0]} x={72} y={52} />
        </Node>
      ))}
      {doc.node}
    </Node>,
  );
  doc.refs.root().opacity(0);
  doc.refs.root().y(40);

  const row = (i: number) =>
    all(rows[i]!().opacity(1, 0.6, easeOutCubic), rules[i]!().end(1, 0.9, easeInOutCubic), rows[i]!().x(-860).x(-860, 0));

  const first = sequence(0.9, row(0), row(1));
  const second = all(
    row(2),
    delay(0.2, all(doc.refs.root().opacity(1, 0.7), doc.refs.root().y(-20, 0.9, easeOutCubic))),
    delay(0.6, sequence(0.12, ...doc.refs.lines.map((l) => l().end(1, 0.4)))),
    delay(1.6, doc.refs.seal().end(1, 0.6, easeInOutCubic)),
  );

  yield* runScene(ID, group(), delay(cueAt(ID, 0) - 0.2, first), delay(cueAt(ID, 1) - 0.1, second));
}

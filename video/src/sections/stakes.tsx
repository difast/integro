import {Line, Node, Txt} from "@motion-canvas/2d";
import {all, createRef, delay, easeInOutCubic, easeOutCubic, sequence, type ThreadGenerator} from "@motion-canvas/core";
import {C, FONT} from "../lib/brand";
import {cueAt, runScene} from "../lib/flow";
import {sheet} from "../lib/ui";

const ID = "stakes";

const words = ["Сделка", "Спор", "Суд"];

/** Сделка, спор, суд — три ситуации сходятся в один обоснованный документ. */
export function* stakes(root: Node): ThreadGenerator {
  const group = createRef<Node>();
  const items = words.map(() => createRef<Node>());
  const connectors = words.map(() => createRef<Line>());
  const wordTxt = words.map(() => createRef<Txt>());
  const doc = sheet({title: "Обоснованный\nвывод", subtitle: "Документ", width: 400, height: 520, x: 470, y: -10, rows: 7});

  const ys = [-230, -20, 190];

  root.add(
    <Node ref={group}>
      {words.map((word, i) => (
        <Node ref={items[i]} x={-860} y={ys[i]} opacity={0}>
          <Txt
            text={String(i + 1).padStart(2, "0")}
            fontFamily={FONT}
            fontWeight={500}
            fontSize={24}
            fill={C.accentOnDark}
            offset={[-1, 0]}
            y={-58}
          />
          <Txt ref={wordTxt[i]} text={word} fontFamily={FONT} fontWeight={600} fontSize={104} fill={C.white} offset={[-1, 0]} />
        </Node>
      ))}
      {words.map((_, i) => (
        <Line
          ref={connectors[i]}
          points={() => [
            [-820 + wordTxt[i]!().width() + 40, ys[i]!],
            [40, ys[i]!],
            [180, -10],
            [262, -10],
          ]}
          radius={40}
          stroke={C.line}
          lineWidth={2}
          end={0}
        />
      ))}
      {doc.node}
    </Node>,
  );
  doc.refs.root().opacity(0);
  doc.refs.root().x(560);

  const showWords = sequence(
    0.55,
    ...items.map((item) => all(item().opacity(1, 0.6, easeOutCubic), item().x(-820, 0.8, easeOutCubic))),
  );

  const converge = all(
    sequence(0.15, ...connectors.map((c) => c().end(1, 1.0, easeInOutCubic))),
    delay(0.5, all(doc.refs.root().opacity(1, 0.7), doc.refs.root().x(470, 0.9, easeOutCubic))),
    delay(1.0, sequence(0.14, ...doc.refs.lines.map((l) => l().end(1, 0.45, easeOutCubic)))),
    delay(2.2, doc.refs.seal().end(1, 0.6, easeInOutCubic)),
  );

  yield* runScene(ID, group(), delay(cueAt(ID, 0) - 0.1, showWords), delay(cueAt(ID, 1) - 0.3, converge));
}

import {Img, Line, Node, Txt} from "@motion-canvas/2d";
import {all, createRef, delay, easeInOutCubic, easeOutCubic, sequence, type ThreadGenerator} from "@motion-canvas/core";
import logo from "../assets/logo-mark-light.png";
import {C, FONT} from "../lib/brand";
import {cueAt, runScene} from "../lib/flow";

const ID = "solution";

const directions = [
  {title: "Оценка\nимущества", doc: "Отчёт об оценке"},
  {title: "Судебная\nэкспертиза", doc: "Заключение эксперта"},
  {title: "Экспертные\nисследования", doc: "Заключение специалиста"},
];

/** Решение: знак «Интегро» и три направления деятельности. */
export function* solution(root: Node): ThreadGenerator {
  const group = createRef<Node>();
  const brand = createRef<Node>();
  const mark = createRef<Img>();
  const word = createRef<Txt>();
  const tagline = createRef<Txt>();
  const rule = createRef<Line>();
  const cols = directions.map(() => createRef<Node>());
  const colRules = directions.map(() => createRef<Line>());

  const colX = [-860, -280, 300];

  root.add(
    <Node ref={group}>
      <Node ref={brand} y={-20}>
        <Img ref={mark} src={logo} height={190} y={-120} opacity={0} scale={0.92} />
        <Txt
          ref={word}
          text={"ИНТЕГРО"}
          fontFamily={FONT}
          fontWeight={600}
          fontSize={86}
          letterSpacing={86 * 0.18}
          fill={C.white}
          y={60}
          opacity={0}
        />
        <Txt
          ref={tagline}
          text={"оценка и судебная экспертиза"}
          fontFamily={FONT}
          fontWeight={400}
          fontSize={30}
          letterSpacing={1}
          fill={C.muted}
          y={130}
          opacity={0}
        />
        <Line ref={rule} points={[[-40, 180], [40, 180]]} stroke={C.accentOnDark} lineWidth={4} end={0} />
      </Node>

      {directions.map((d, i) => (
        <Node ref={cols[i]} x={colX[i]} y={110} opacity={0}>
          <Line ref={colRules[i]} points={[[0, 0], [520, 0]]} stroke={C.white} lineWidth={1.5} end={0} />
          <Txt
            text={String(i + 1).padStart(2, "0")}
            fontFamily={FONT}
            fontWeight={500}
            fontSize={24}
            fill={C.accentOnDark}
            offset={[-1, -1]}
            y={30}
          />
          <Txt
            text={d.title}
            fontFamily={FONT}
            fontWeight={600}
            fontSize={50}
            lineHeight={60}
            fill={C.white}
            offset={[-1, -1]}
            y={78}
          />
          <Txt
            text={d.doc}
            fontFamily={FONT}
            fontWeight={400}
            fontSize={24}
            fill={C.muted}
            offset={[-1, -1]}
            y={222}
          />
        </Node>
      ))}
    </Node>,
  );

  const reveal = sequence(
    0.25,
    all(mark().opacity(1, 0.9, easeOutCubic), mark().scale(1, 1.2, easeOutCubic)),
    all(word().opacity(1, 0.8), word().letterSpacing(86 * 0.12, 1.2, easeOutCubic)),
    tagline().opacity(1, 0.7),
    rule().end(1, 0.6, easeInOutCubic),
  );

  const toColumns = all(
    brand().y(-262, 1.0, easeInOutCubic),
    brand().scale(0.62, 1.0, easeInOutCubic),
    tagline().opacity(0, 0.4),
    delay(
      0.4,
      sequence(
        0.35,
        ...cols.map((c, i) =>
          all(c().opacity(1, 0.6), colRules[i]!().end(1, 0.8, easeInOutCubic), c().y(80, 0.8, easeOutCubic)),
        ),
      ),
    ),
  );

  yield* runScene(ID, group(), delay(cueAt(ID, 0) - 0.4, reveal), delay(cueAt(ID, 1) - 0.2, toColumns));
}

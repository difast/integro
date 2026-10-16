import {Circle, Line, Node, Rect, Txt} from "@motion-canvas/2d";
import {
  all,
  createRef,
  delay,
  easeInOutCubic,
  easeOutCubic,
  linear,
  sequence,
  waitFor,
  type ThreadGenerator,
} from "@motion-canvas/core";
import {C, FONT} from "../lib/brand";
import {cueAt, fadeIn, runScene} from "../lib/flow";
import {sheet} from "../lib/ui";

const ID = "process";

const steps = [
  {n: "01", title: "Обращение"},
  {n: "02", title: "Изучение задачи\nи материалов"},
  {n: "03", title: "Исследования\nи расчёты"},
  {n: "04", title: "Результат"},
];

const approaches = ["Сравнительный", "Затратный", "Доходный"];

/** Порядок работы: четыре этапа на шкале, у каждого — своя иллюстрация. */
export function* processSection(root: Node): ThreadGenerator {
  const group = createRef<Node>();
  const title = createRef<Txt>();
  const track = createRef<Line>();
  const progress = createRef<Line>();
  const nodes = steps.map(() => createRef<Circle>());
  const dots = steps.map(() => createRef<Circle>());
  const stepLabels = steps.map(() => createRef<Node>());
  const panels = steps.map(() => createRef<Node>());

  const trackY = -170;
  const xs = [-760, -253, 253, 760];
  const panelY = 150;

  // Этап 1 — заявка.
  const typed = createRef<Txt>();
  const caret = createRef<Rect>();
  // Этап 2 — материалы.
  const docs = [0, 1, 2].map((i) =>
    sheet({title: ["Документы\nпо объекту", "Материалы\nдела", "Исходные\nданные"][i]!, width: 230, height: 290, rows: 4, x: -260 + i * 260, y: 0, rotation: [-4, 1, 5][i]}),
  );
  const scan = createRef<Line>();
  // Этап 3 — расчёты.
  const bars = approaches.map(() => [0, 1, 2].map(() => createRef<Line>()));
  const merge = approaches.map(() => createRef<Line>());
  const sigma = createRef<Node>();
  // Этап 4 — результат.
  const report = sheet({title: "Отчёт\nоб оценке", subtitle: "Результат", width: 250, height: 320, rows: 4, x: -150, y: -10, rotation: -3});
  const opinion = sheet({title: "Заключение", subtitle: "Результат", width: 250, height: 320, rows: 4, x: 150, y: 0, rotation: 3});

  root.add(
    <Node ref={group}>
      <Txt
        ref={title}
        text={"Как мы работаем"}
        fontFamily={FONT}
        fontWeight={600}
        fontSize={64}
        fill={C.white}
        x={-860}
        y={-330}
        offset={[-1, 0]}
        opacity={0}
      />
      <Line ref={track} points={[[xs[0]!, trackY], [xs[3]!, trackY]]} stroke={C.line} lineWidth={2} end={0} />
      <Line ref={progress} points={[[xs[0]!, trackY], [xs[3]!, trackY]]} stroke={C.accentOnDark} lineWidth={4} end={0} />
      {steps.map((s, i) => (
        <Node>
          <Circle ref={nodes[i]} x={xs[i]} y={trackY} size={34} stroke={C.white} lineWidth={2} fill={C.bg} opacity={0} />
          <Circle ref={dots[i]} x={xs[i]} y={trackY} size={0} fill={C.accentOnDark} />
          <Node ref={stepLabels[i]} x={xs[i]} y={trackY + 44} opacity={0.0}>
            <Txt text={s.n} fontFamily={FONT} fontWeight={500} fontSize={22} fill={C.accentOnDark} y={0} />
            <Txt
              text={s.title}
              fontFamily={FONT}
              fontWeight={600}
              fontSize={28}
              lineHeight={34}
              textAlign={"center"}
              fill={C.white}
              offset={[0, -1]}
              y={18}
            />
          </Node>
        </Node>
      ))}

      <Node ref={panels[0]} y={panelY} opacity={0}>
        <Rect width={760} height={210} fill={C.navy800} stroke={C.line} lineWidth={1.5} y={40} />
        <Txt text={"ЗАЯВКА"} fontFamily={FONT} fontWeight={500} fontSize={20} letterSpacing={2.4} fill={C.muted} x={-340} y={-30} offset={[-1, 0]} />
        <Line points={[[-340, 90], [340, 90]]} stroke={C.line} lineWidth={1.5} />
        <Txt ref={typed} text={""} fontFamily={FONT} fontWeight={400} fontSize={32} fill={C.white} x={-340} y={45} offset={[-1, 0]} />
        <Rect ref={caret} width={3} height={38} fill={C.accentOnDark} x={() => -340 + typed().width() + 8} y={45} />
      </Node>

      <Node ref={panels[1]} y={panelY + 10} opacity={0}>
        {docs.map((d) => d.node)}
        <Line ref={scan} points={[[-420, -150], [420, -150]]} stroke={C.accentOnDark} lineWidth={3} opacity={0} />
      </Node>

      <Node ref={panels[2]} y={panelY} opacity={0}>
        {approaches.map((a, i) => (
          <Node x={-530 + i * 400}>
            <Txt text={a} fontFamily={FONT} fontWeight={600} fontSize={28} fill={C.white} offset={[-1, 0]} y={-120} />
            <Txt text={"подход"} fontFamily={FONT} fontWeight={400} fontSize={22} fill={C.muted} offset={[-1, 0]} y={-86} />
            {[0, 1, 2].map((r) => (
              <Line
                ref={bars[i]![r]}
                points={[[0, -40 + r * 34], [[260, 200, 230][(i + r) % 3]!, -40 + r * 34]]}
                stroke={r === 0 ? C.white : C.line}
                lineWidth={10}
                lineCap={"round"}
                end={0}
              />
            ))}
            <Line
              ref={merge[i]}
              points={[[130, 70], [130, 110], [530 - i * 400, 150]]}
              radius={30}
              stroke={C.line}
              lineWidth={2}
              end={0}
            />
          </Node>
        ))}
        <Node ref={sigma} y={180} opacity={0}>
          <Txt text={"Согласование результатов"} fontFamily={FONT} fontWeight={600} fontSize={30} fill={C.white} />
          <Line points={[[-200, 32], [200, 32]]} stroke={C.accentOnDark} lineWidth={3} />
        </Node>
      </Node>

      <Node ref={panels[3]} y={panelY + 20} opacity={0}>
        {report.node}
        {opinion.node}
      </Node>
    </Node>,
  );

  function* activate(i: number): ThreadGenerator {
    const prev = i > 0 ? panels[i - 1]!() : null;
    yield* all(
      progress().end(i / 3, i === 0 ? 0.01 : 0.9, easeInOutCubic),
      delay(i === 0 ? 0 : 0.5, all(dots[i]!().size(16, 0.4, easeOutCubic), stepLabels[i]!().opacity(1, 0.5))),
      ...(i > 0 ? [stepLabels[i - 1]!().opacity(0.45, 0.6)] : []),
      ...(prev ? [prev.opacity(0, 0.4)] : []),
      delay(0.3, fadeIn(panels[i]!(), 0.6, 20)),
    );
  }

  const intro = all(
    fadeIn(title(), 0.8),
    delay(0.3, track().end(1, 1.2, easeInOutCubic)),
    delay(0.6, sequence(0.15, ...nodes.map((n) => n().opacity(1, 0.4)))),
    delay(0.9, sequence(0.15, ...stepLabels.map((l) => l().opacity(0.45, 0.4)))),
  );

  const step1 = all(
    activate(0),
    delay(0.7, typed().text("Определить стоимость доли в квартире", 1.6, linear)),
    delay(0.4, caret().opacity(0, 0.25).to(1, 0.25).to(0, 0.25).to(1, 0.25).to(0, 0.25).to(1, 0.25)),
  );

  const step2 = all(
    activate(1),
    delay(0.6, sequence(0.15, ...docs.map((d) => sequence(0.1, ...d.refs.lines.map((l) => l().end(1, 0.35)))))),
    delay(0.9, all(scan().opacity(1, 0.2), scan().position.y(150, 1.4, easeInOutCubic))),
    delay(2.3, scan().opacity(0, 0.3)),
  );

  const step3 = all(
    activate(2),
    delay(0.6, sequence(0.08, ...bars.flat().map((b) => b().end(1, 0.5, easeOutCubic)))),
    delay(1.6, all(...merge.map((m) => m().end(1, 0.7, easeInOutCubic)))),
    delay(2.1, fadeIn(sigma(), 0.5, 10)),
  );

  const step4 = all(
    activate(3),
    delay(0.6, sequence(0.08, ...report.refs.lines.map((l) => l().end(1, 0.3)), ...opinion.refs.lines.map((l) => l().end(1, 0.3)))),
    delay(1.6, all(report.refs.seal().end(1, 0.5), opinion.refs.seal().end(1, 0.5))),
  );

  yield* runScene(
    ID,
    group(),
    delay(cueAt(ID, 0) - 0.4, intro),
    delay(cueAt(ID, 1) - 0.2, step1),
    delay(cueAt(ID, 2) - 0.2, step2),
    delay(cueAt(ID, 3) - 0.2, step3),
    delay(cueAt(ID, 4) - 0.2, step4),
    waitFor(0),
  );
}

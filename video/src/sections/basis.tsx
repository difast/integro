import {Line, Node, Rect, Txt} from "@motion-canvas/2d";
import {all, createRef, delay, easeInOutCubic, easeOutCubic, sequence, type ThreadGenerator} from "@motion-canvas/core";
import {C, FONT} from "../lib/brand";
import {cueAt, runScene} from "../lib/flow";

const ID = "basis";

const pillars = ["Анализ", "Специальные\nзнания", "Требования\nзакона"];

/**
 * На чём основана работа: здание из трёх колонн — анализ, специальные знания,
 * требования закона. Чертёж «строится» снизу вверх.
 */
export function* basis(root: Node): ThreadGenerator {
  const group = createRef<Node>();
  const steps = [0, 1, 2].map(() => createRef<Line>());
  const columns = pillars.map(() => createRef<Rect>());
  const capitals = pillars.map(() => createRef<Rect>());
  const labels = pillars.map(() => createRef<Txt>());
  const beam = createRef<Rect>();
  const pediment = createRef<Line>();
  const fills = pillars.map(() => createRef<Rect>());

  const colX = [-390, 0, 390];
  const base = 250;

  root.add(
    <Node ref={group} y={-10}>
      {steps.map((ref, i) => (
        <Line
          ref={ref}
          points={[[-560 - i * 40, base + i * 28], [560 + i * 40, base + i * 28]]}
          stroke={i === 0 ? C.white : C.line}
          lineWidth={2}
          end={0}
        />
      ))}
      {pillars.map((_, i) => (
        <Rect ref={fills[i]} x={colX[i]} y={base - 165} width={250} height={330} fill={"rgba(154,166,196,0.06)"} opacity={0} />
      ))}
      {pillars.map((_, i) => (
        <Rect ref={columns[i]} x={colX[i]} y={base - 165} width={250} height={330} stroke={C.white} lineWidth={2} end={0} />
      ))}
      {pillars.map((_, i) => (
        <Rect ref={capitals[i]} x={colX[i]} y={base - 345} width={300} height={30} stroke={C.white} lineWidth={2} end={0} />
      ))}
      <Rect ref={beam} y={base - 395} width={1160} height={70} stroke={C.white} lineWidth={2} end={0} />
      <Line
        ref={pediment}
        points={[[-600, base - 430], [0, base - 610], [600, base - 430]]}
        stroke={C.accentOnDark}
        lineWidth={2.5}
        end={0}
      />
      {pillars.map((p, i) => (
        <Txt
          ref={labels[i]}
          text={p}
          fontFamily={FONT}
          fontWeight={600}
          fontSize={32}
          lineHeight={42}
          textAlign={"center"}
          fill={C.white}
          x={colX[i]}
          y={base - 165}
          opacity={0}
        />
      ))}
    </Node>,
  );

  const build = sequence(
    0.18,
    sequence(0.12, ...steps.map((s) => s().end(1, 0.7, easeInOutCubic))),
    sequence(0.15, ...columns.map((c) => c().end(1, 0.9, easeInOutCubic))),
    sequence(0.1, ...capitals.map((c) => c().end(1, 0.5))),
    beam().end(1, 0.7, easeInOutCubic),
    pediment().end(1, 0.8, easeInOutCubic),
  );

  const names = sequence(
    0.55,
    ...labels.map((l, i) =>
      all(l().opacity(1, 0.5, easeOutCubic), l().scale(0.96).scale(1, 0.6, easeOutCubic), fills[i]!().opacity(1, 0.6)),
    ),
  );

  yield* runScene(ID, group(), build, delay(cueAt(ID, 0) + 0.6, names));
}

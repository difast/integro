import {Img, Line, Node, Rect, Txt} from "@motion-canvas/2d";
import {all, createRef, delay, easeInOutCubic, easeOutCubic, sequence, waitFor, type ThreadGenerator} from "@motion-canvas/core";
import logo from "../assets/logo-mark-light.png";
import {C, FONT} from "../lib/brand";
import {cueAt, durationOf, fadeIn} from "../lib/flow";

const ID = "cta";

/** Призыв к действию. Финальный кадр остаётся на экране до конца ролика. */
export function* cta(root: Node): ThreadGenerator {
  const group = createRef<Node>();
  const brand = createRef<Node>();
  const headline = createRef<Txt>();
  const rule = createRef<Line>();
  const button = createRef<Rect>();
  const hint = createRef<Txt>();

  root.add(
    <Node ref={group}>
      <Node ref={brand} y={-250} opacity={0}>
        <Img src={logo} height={110} x={-170} />
        <Txt
          text={"ИНТЕГРО"}
          fontFamily={FONT}
          fontWeight={600}
          fontSize={60}
          letterSpacing={60 * 0.16}
          fill={C.white}
          x={-95}
          offset={[-1, 0]}
        />
      </Node>
      <Txt
        ref={headline}
        text={"Обсудим вашу ситуацию"}
        fontFamily={FONT}
        fontWeight={600}
        fontSize={92}
        fill={C.white}
        y={-60}
        opacity={0}
      />
      <Line ref={rule} points={[[-50, 40], [50, 40]]} stroke={C.accentOnDark} lineWidth={4} end={0} />
      <Rect ref={button} y={160} width={560} height={110} fill={C.white} opacity={0}>
        <Txt text={"Оставить заявку  →"} fontFamily={FONT} fontWeight={600} fontSize={40} fill={C.ink} />
      </Rect>
      <Txt
        ref={hint}
        text={"на сайте, в разделе «Контакты»"}
        fontFamily={FONT}
        fontWeight={400}
        fontSize={30}
        fill={C.muted}
        y={268}
        opacity={0}
      />
    </Node>,
  );

  yield* all(
    waitFor(durationOf(ID)),
    sequence(
      0.3,
      delay(cueAt(ID, 0) - 0.3, fadeIn(brand(), 0.8, 16)),
      fadeIn(headline(), 0.8, 24),
      rule().end(1, 0.6, easeInOutCubic),
    ),
    delay(cueAt(ID, 1) - 0.1, all(fadeIn(button(), 0.7, 16), button().scale(0.97).scale(1, 0.7, easeOutCubic))),
    delay(cueAt(ID, 1) + 0.5, hint().opacity(1, 0.6)),
  );
}

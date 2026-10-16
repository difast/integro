import {Grid, Line, Node, Rect, Txt, makeScene2D} from "@motion-canvas/2d";
import {all, createRef, delay, easeInOutCubic, linear, waitFor, type ThreadGenerator} from "@motion-canvas/core";
import {C, FONT} from "../lib/brand";
import {allCues, scenes, sceneStart, totalDuration} from "../timeline";
import {problem} from "../sections/problem";
import {stakes} from "../sections/stakes";
import {solution} from "../sections/solution";
import {basis} from "../sections/basis";
import {processSection} from "../sections/process";
import {value} from "../sections/value";
import {cta} from "../sections/cta";

const sections: Record<string, (view: Node) => ThreadGenerator> = {
  problem,
  stakes,
  solution,
  basis,
  process: processSection,
  value,
  cta,
};

export default makeScene2D(function* (view) {
  view.fill(C.bg);

  // Чертёжная сетка, медленно смещающаяся на протяжении ролика.
  const grid = createRef<Node>();
  view.add(
    <Node ref={grid}>
      <Grid width={2600} height={1600} spacing={48} stroke={"rgba(154,166,196,0.05)"} lineWidth={1} />
      <Grid width={2600} height={1600} spacing={240} stroke={"rgba(154,166,196,0.09)"} lineWidth={1} />
    </Node>,
  );

  const content = createRef<Node>();
  view.add(<Node ref={content} />);

  // Шапка: номер и название раздела, как на сайте.
  const sectionIndex = createRef<Txt>();
  const sectionTitle = createRef<Txt>();
  const header = createRef<Node>();
  view.add(
    <Node ref={header} opacity={0}>
      <Txt
        ref={sectionIndex}
        text={"01"}
        fontFamily={FONT}
        fontWeight={500}
        fontSize={22}
        fill={C.accentOnDark}
        x={-860}
        y={-470}
        offset={[-1, 0]}
      />
      <Txt
        ref={sectionTitle}
        text={""}
        fontFamily={FONT}
        fontWeight={500}
        fontSize={22}
        letterSpacing={2.6}
        fill={C.muted}
        x={-812}
        y={-470}
        offset={[-1, 0]}
      />
      <Txt
        text={"ООО «ИНТЕГРО»"}
        fontFamily={FONT}
        fontWeight={500}
        fontSize={22}
        letterSpacing={2.6}
        fill={C.muted}
        x={860}
        y={-470}
        offset={[1, 0]}
      />
      <Line points={[[-860, -436], [860, -436]]} stroke={C.faint} lineWidth={1} />
    </Node>,
  );

  // Субтитры: текст озвучки, вшитый в видео.
  const subText = createRef<Txt>();
  const subBox = createRef<Rect>();
  view.add(
    <Rect
      ref={subBox}
      y={442}
      height={84}
      width={() => subText().width() + 72}
      fill={"rgba(8, 15, 38, 0.82)"}
      opacity={0}
    >
      <Txt ref={subText} text={""} fontFamily={FONT} fontWeight={500} fontSize={42} fill={C.white} />
    </Rect>,
  );

  function* subtitles(): ThreadGenerator {
    let t = 0;
    for (const cue of allCues) {
      yield* waitFor(cue.start - t);
      subText().text(cue.text);
      yield* subBox().opacity(1, 0.18);
      yield* waitFor(cue.end - cue.start - 0.36);
      yield* subBox().opacity(0, 0.18);
      t = cue.end;
    }
  }

  function* headerTrack(): ThreadGenerator {
    let t = 0;
    for (const [i, scene] of scenes.entries()) {
      const start = sceneStart(scene.id);
      yield* waitFor(start - t);
      t = start;
      if (i === 0) {
        sectionIndex().text("01");
        sectionTitle().text(scene.title.toUpperCase());
        yield* header().opacity(1, 0.8);
        t += 0.8;
      } else {
        yield* sectionTitle().opacity(0, 0.25);
        sectionIndex().text(String(i + 1).padStart(2, "0"));
        sectionTitle().text(scene.title.toUpperCase());
        yield* sectionTitle().opacity(1, 0.35);
        t += 0.6;
      }
    }
  }

  yield* all(
    grid().position([-240, -120], totalDuration, linear),
    subtitles(),
    headerTrack(),
    ...scenes.map((scene) => delay(sceneStart(scene.id), sections[scene.id]!(content()))),
    delay(totalDuration - 0.7, header().opacity(0, 0.6, easeInOutCubic)),
    waitFor(totalDuration),
  );
});

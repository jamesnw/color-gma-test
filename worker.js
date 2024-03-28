
import Color from 'https://colorjs.io/dist/color.js'

const DELTA = 0.03;
const settings = {
  x: { min: 0, max: 1, delta: DELTA },
  y: { min: 0, max: 1, delta: DELTA },
  z: { min: 0, max: 1, delta: DELTA }
}

function* xyzColorGenerator(settings) {
  let count = 0;
  for (var x = settings.x.min; x <= settings.x.max; x = x + settings.x.delta) {
    for (var y = settings.y.min; y <= settings.y.max; y = y + settings.y.delta) {
      for (var z = settings.z.min; z <= settings.z.max; z = z + settings.z.delta) {
        yield [`color(xyz ${x} ${y} ${z})`, count++];
      }
    }
  }
}

const run = () => {

  const colors = xyzColorGenerator(settings);
  let color = colors.next();
  let results = {
    inSrgb: { count: 0 },
    inP3OutSrgb: { count: 0, clip: {}, map: {} },
    inRec2020OutSrgb: { count: 0, clip: {}, map: {} },
    inRec2020OutP3: { count: 0, clip: {}, map: {} },
    outRec2020: { count: 0, clip: {}, map: {} },
  }
  while (!color.done) {
    const [colorString, index] = color.value;
    const colorData = processColor(colorString);
    results = aggregate(results, colorData, index);
    color = colors.next();
    if (index % 100 === 0) {
      postMessage(JSON.stringify(results));
    }
  }
}

const processColor = colorString => {
  const color = new Color(colorString);
  const gamuts = checkGamuts(color);
  const clips = clipColors(color);
  const clipDeltas = checkDeltas(color, clips);
  const maps = mapColors(color);
  const mapDeltas = checkDeltas(color, maps);
  return { color, gamuts, clips, maps, clipDeltas, mapDeltas }
}

const GAMUTS = ['srgb', 'p3', 'rec2020'];
const checkGamuts = color => GAMUTS.map(gamut => color.inGamut(gamut, { epsilon: 0 }));

const clipColors = color => GAMUTS.map(gamut => color.clone().toGamut({ space: gamut, method: 'clip' }));
const mapColors = color => GAMUTS.map(gamut => color.clone().toGamut({ space: gamut, method: 'css' }));

const checkDeltas = (color, items) => items.map(item => deltas(color, item));

const deltas = (original, mapped) => {
  let deltas = {};
  ["L", "C", "H"].forEach((c, i) => {
    let delta = mapped.to("oklch").coords[i] - original.to("oklch").coords[i];

    if (c === "L") {
      // L is percentage
      delta *= 100;
    }
    else if (c === "H") {
      // Hue is angular, so we need to normalize it
      delta = ((delta % 360) + 720) % 360;
      delta = Math.min(360 - delta, delta);
      // Check: Is this hiding cases where only one value is NaN?
      if (isNaN(delta)) delta = 0;
    }

    delta = Color.util.toPrecision(delta, 2);
    // Use absolute because we are interested in magnitude, not direction
    deltas[c] = Math.abs(delta);
  });
  deltas.eok = original.deltaE(mapped, { method: "2000" });
  return deltas;
}

// {
//   inSrgb: {count: 0},
//   inP3OutSrgb: {count: 0, clip: {}, map: {}},
//   inRec2020OutSrgb: {count: 0, clip: {}, map: {}},
//   inRec2020OutP3: {count: 0, clip: {}, map: {}},
//   outRec2020: {count: 0, clip: {}, map: {}},
// }

const runningAverage = (average, newValue, count) => {
  // const count = newIndex + 1;
  if (count === 1) return newValue;
  return average * (count - 1) / count + newValue / count;
};

const aggregate = (results, colorData, index) => {
  const { gamuts, clipDeltas, mapDeltas, color } = colorData;
  if (gamuts[0]) {
    results.inSrgb.count++;
  }
  if (!gamuts[0] && gamuts[1]) {
    const res = results.inP3OutSrgb;
    res.count++;
    const clipDelta = clipDeltas[0];
    const mapDelta = mapDeltas[0];
    ["L", "C", "H", "eok"].forEach(delta => {
      res.clip[delta] = runningAverage(res.clip[delta], clipDelta[delta], res.count)
    });
    ["L", "C", "H", "eok"].forEach(delta => {
      res.map[delta] = runningAverage(res.map[delta], mapDelta[delta], res.count)
    });
    res.clip.worst = clipDelta.eok > (res.clip.worst?.delta || 0) ? { delta: clipDelta.eok, color: color.toString() } : res.clip.worst;
    res.map.worst = mapDelta.eok > (res.map.worst?.delta || 0) ? { delta: mapDelta.eok, color: color.toString() } : res.map.worst;
    results.inP3OutSrgb = res;
  }
  if (!gamuts[0] && gamuts[2]) {
    const res = results.inRec2020OutSrgb
    res.count++;
    const clipDelta = clipDeltas[0];
    const mapDelta = mapDeltas[0];
    ["L", "C", "H", "eok"].forEach(delta => {
      res.clip[delta] = runningAverage(res.clip[delta], clipDelta[delta], res.count)
    });
    ["L", "C", "H", "eok"].forEach(delta => {
      res.map[delta] = runningAverage(res.map[delta], mapDelta[delta], res.count)
    });
    res.clip.worst = clipDelta.eok > (res.clip.worst?.delta || 0) ? { delta: clipDelta.eok, color: color.toString() } : res.clip.worst;
    res.map.worst = mapDelta.eok > (res.map.worst?.delta || 0) ? { delta: mapDelta.eok, color: color.toString() } : res.map.worst;
    results.inRec2020OutSrgb = res;
  }
  if (!gamuts[1] && gamuts[2]) {
    const res = results.inRec2020OutP3
    res.count++;
    const clipDelta = clipDeltas[1];
    const mapDelta = mapDeltas[1];
    ["L", "C", "H", "eok"].forEach(delta => {
      res.clip[delta] = runningAverage(res.clip[delta], clipDelta[delta], res.count)
    });
    ["L", "C", "H", "eok"].forEach(delta => {
      res.map[delta] = runningAverage(res.map[delta], mapDelta[delta], res.count)
    });
    res.clip.worst = clipDelta.eok > (res.clip.worst?.delta || 0) ? { delta: clipDelta.eok, color: color.toString() } : res.clip.worst;
    res.map.worst = mapDelta.eok > (res.map.worst?.delta || 0) ? { delta: mapDelta.eok, color: color.toString() } : res.map.worst;
    results.inRec2020OutP3 = res;
  }
  if (!gamuts[2]) {
    const res = results.outRec2020
    res.count++;
    const clipDelta = clipDeltas[1];
    const mapDelta = mapDeltas[1];
    ["L", "C", "H", "eok"].forEach(delta => {
      res.clip[delta] = runningAverage(res.clip[delta], clipDelta[delta], res.count)
    });
    ["L", "C", "H", "eok"].forEach(delta => {
      res.map[delta] = runningAverage(res.map[delta], mapDelta[delta], res.count)
    });
    res.clip.worst = clipDelta.eok > (res.clip.worst?.delta || 0) ? { delta: clipDelta.eok, color: color.toString() } : res.clip.worst;
    res.map.worst = mapDelta.eok > (res.map.worst?.delta || 0) ? { delta: mapDelta.eok, color: color.toString() } : res.map.worst;
    results.outRec2020 = res;
  }
  return results;
}

onmessage = (event) => {
  console.log("Message received from main script", event, event.data);
  if (event.data[0] === "run") {
    run();
  }
};

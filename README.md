# Color GMA Test

Run with `npx http-server .`. Open in your browser, and click "Run" to start.

## Description

This tool iterates through channel values in the xyz space, collecting data on
the results of clipping and mapping. Results are split into 4 segments-

- `inP3OutSrgb` is mapping to srgb from a color in p3
- `inRec2020OutSrgb` is mapping to srgb from a color in rec2020
- `inRec2020OutP3` is mapping to p3 from a color in rec2020
- `outRec2020` is mapping to p3 from a color outside rec2020

`L`, `C`, and `H` average the absolute value of the difference of the original
and mapped color in the `oklch` space, and give a sense of how much on average a
certain channel is shifted, but not a direction.

`e2000` is the average `delta2000` between the original and mapped color.

`worst` is the color that has the greatest `delta2000` value for the tier.

Adjust the settings at the top of `worker.js` to change the granularity. It's currently set with a small `DELTA` between steps for quick iteration. For higher granularity, decrease the value to `0.005` or whatever you wish.
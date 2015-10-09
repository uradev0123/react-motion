/* @flow */
// currentStyle keeps the info about whether a prop is configured as a spring
// or if it's just a random prop that happens to be present on the style
export default function noVelocity(currentVelocity: Object,
                                   currentStyle: Object): boolean {
  for (let key in currentVelocity) {
    if (!currentVelocity.hasOwnProperty(key)) {
      continue;
    }
    if (currentStyle[key] != null && currentStyle[key].config && currentVelocity[key] !== 0) {
      return false;
    }
  }
  return true;
}

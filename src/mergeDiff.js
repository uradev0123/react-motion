// this function is allocation-less thanks to babel, which transforms the tail
// calls into loops
function mergeDiffArr2(arrA, arrB, collB, indexA, indexB, onRemove, accum) {
  const endA = indexA === arrA.length;
  const endB = indexB === arrB.length;
  const keyA = arrA[indexA];
  const keyB = arrB[indexB];
  if (endA && endB) {
    // returning null here, otherwise lint complains that we're not expecting
    // a return value in subsequent calls. We know what we're doing.
    return null;
  }

  if (endA) {
    accum[keyB] = collB[keyB];
    return mergeDiffArr2(arrA, arrB, collB, indexA, indexB + 1, onRemove, accum);
  }

  if (endB) {
    let fill = onRemove(keyA);
    if (fill == null) {
      return mergeDiffArr2(arrA, arrB, collB, indexA + 1, indexB, onRemove, accum);
    }
    accum[keyA] = fill;
    return mergeDiffArr2(arrA, arrB, collB, indexA + 1, indexB, onRemove, accum);
  }

  if (keyA === keyB) {
    accum[keyA] = collB[keyA];
    return mergeDiffArr2(arrA, arrB, collB, indexA + 1, indexB + 1, onRemove, accum);
  }

  if (!collB.hasOwnProperty(keyA)) {
    let fill = onRemove(keyA);
    if (fill == null) {
      return mergeDiffArr2(arrA, arrB, collB, indexA + 1, indexB, onRemove, accum);
    }
    accum[keyA] = fill;
    return mergeDiffArr2(arrA, arrB, collB, indexA + 1, indexB, onRemove, accum);
  }

  return mergeDiffArr2(arrA, arrB, collB, indexA + 1, indexB, onRemove, accum);
}

export default function mergeDiff(a, b, onRemove) {
  let ret = {};
  // if anyone can make this work without allocating the arrays here, we'll
  // give you a medal
  mergeDiffArr2(Object.keys(a), Object.keys(b), b, 0, 0, onRemove, ret);
  return ret;
}

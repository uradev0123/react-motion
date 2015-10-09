/* @flow */
export default function reorderKeys(obj: Object,
                                    f: Function): Object {
  const newKeys = f(Object.keys(obj));
  let ret = {};
  for (let i = 0; i < newKeys.length; i++) {
    const key = newKeys[i];
    ret[key] = obj[key];
  }

  return ret;
}

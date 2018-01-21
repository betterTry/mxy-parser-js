import mxy from './lib/parse';
console.log(mxy);
const result = new mxy.tokenizer('var a = 1');
console.log(result.next_token());
console.log(result.next_token());
console.log(result.next_token());
console.log(result.next_token());
console.log(result.next_token());

!function (name, defination) {
  const hasDefine = typeof window.define == 'function';
  const hasExports = typeof module !== 'undefined' && module.exports;
  if (hasDefine) {
    window.define(name, [], () => defination);
  } else if (hasExports) {
    module.exports = defination;
  } else {
    window.name = defination;
  }
}('mxy', mxy);

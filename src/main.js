import mxy from './lib';

// const result = new mxy.tokenizer('var a = 1');
// console.log(result.next_token());
const result = new mxy.parse('var a = 1');
console.log(result);


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

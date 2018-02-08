import mxy from './lib';

const result = new mxy.tokenizer('var a = 1;for(;;){};if(a) {a = 3}');
for (let i = 0; i < 25; i++) {
  console.log(result.next_token());
}
const res = new mxy.lexer('var a = 1;for(;;){};if(a) {a = 3}');
console.log(res.result);


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

import mxy from './lib';

// const result = new mxy.tokenizer('do{}while(a/=2/)');
// for (let i = 0; i < 10; i++) {
//   console.log(result.next_token());
// }
const res = new mxy.lexer('do{var a = 1}while(a = 1);while(a, b) {}; try {}catch(a) {}; new function a(a, b); switch(a){case a: console.log(2);}');
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

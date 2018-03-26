import mxy from './lib';
import './lib/process';

// const result = new mxy.tokenizer('do{}while(a/=2/)');
// for (let i = 0; i < 10; i++) {
//   console.log(result.next_token());
// }


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

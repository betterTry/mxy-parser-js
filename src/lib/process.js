import parser from './parser';
const res = new mxy.parser(`
  var a = 1;
  var b = function() {};
  do {
    var a = 1
  } while(a = 1);
  while (a, b) {
  };
  try {
    this.c = 222;
  } catch (a) {
    console.log(a);
  };
  new function a(a, b);
  switch (a) {
    case a:
      console.log(2, 3);
    case b:
      this.c = 1;
  }`);
console.log(res.toString());


function walker() {

}

function map(ast, handle) {
  return ast.map((item) => {
    return handle(item);
  });
}

class Scope() {
  constructor() {
    this.children = [];
    this.parent = [];
  }
}

const stack = [];

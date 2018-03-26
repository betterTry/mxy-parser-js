import parser from './parser';
import {hit_obj, as} from '../utils';
const res = new parser(`
  do{
    var a = 1, b = 2;
    console.log(2);
  } while(a = 1);
  while(a, b) {

  };
  try {

  } catch(a) {
    console.log(2);
  } finally {

  }
  new function a(b, c) {}(1,2);
  new a(b);
  switch(a) {
    case a:
      console.log(2);
      break;
    case b:
      console.log(b);
  }`);

const stack = [];
function getStack() {
  return stack[stack.length - 1];
}

const walker = {
  toplevel(cont) {
    stack.push(new Scope());
    return as(cont[0], map(cont[1], walker));
  },
  do(cont) {
    return as(cont[0], map(cont[1], walker), cont[2]);
  },
  block(cont) {
    return as(cont[0], map(cont[1], walker));
  },
  var(cont) {
    const _stack = getStack();
    cont[1].forEach((item) => {
      _stack.eo[item[0]] = item[1];
    });
    return cont;
  },
  comma() {
    return 'comma';
  },
  while(cont) {
    return as(cont[0], cont[1], map(cont[2], walker));
  },
  try(cont) {
    return as(cont[0], map(cont[1], walker), cont[2], map(cont[3], walker), map(cont[4], walker));
  },
  new(cont) {
    return as(cont[0], cont[1][0] === 'function' ? map(cont[1], walker) : cont[1], cont[2]);
  },
  function(cont) {
    const _stack = new Scope();
    const par = getStack();
    par.children.push(_stack);
    _stack.parent = _stack;
    cont[3].forEach((item) => {
      _stack.eo[item[1]] = undefined;
    });
    return as(cont[0], cont[1], map(cont[2], walker));
  },
  switch(cont) {
    return as(cont[0], cont[1], map(cont[2], walker));
  },
  case(cont) {
    return as(cont[0], cont[1]);
  },
  stat(cont) {
    return as(cont[0], cont[1]);
  },
  call(cont) {
    console.log(cont);
    return as(cont[0], cont[1], cont[2]);
  },
  dot(cont) {
    return cont;
  },
};

function map(target, handle) {
  if (target[0] instanceof Array) {
    return target.map((item) => {
      return map(item, handle);
    });
  } else {
    if (hit_obj(handle, target[0])) {
      return handle[target[0]](target);
    }
  }
}


function walk() {
  return map(result, walker);
}

class Scope {
  constructor() {
    this.children = [];
    this.parent = null;
    this.eo = {};
  }
}

const result = res.exec();
console.log(result);
console.log(walk());
console.log(stack);

/*
 * 全局变量不变;
 * 局部变量看有没有被内部函数用到;
 *
 *
*/
import parser from './parser';
import {base64} from '../constant';
import {hit_obj, hit_parent, prog, curry} from '../utils';
const res = new parser(`
  var g = 1, asda = 2, asdas = 3, asjajsjasj = 4;
  a = 1;
  function c(){
    function d() {
      console.log(c);
      var a = 1;
      g = 2;
    }
  }
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

const stack = {
  data: [],
  current() {
    return stack.data[stack.data.length - 1];
  },
  pop() {
    stack.data.pop();
  },
  push(scope) {
    stack.data.push(scope);
  },
  getStack() {
    return stack.data;
  },
};

class Scope {
  constructor() {
    this.children = [];
    this.parent = null;
    this.eo = {};
    this.ao = {};
    this.mangle = {};
  }
  canMangle(name) {
    return !this.hasMangle() && !hit_obj(this.ao, name) && hit_obj(this.eo, name);
  }
  addMangle(old, n) {
    this.mangle[old] = n;
  }
  hasMangle(name) {
    return hit_obj(this.mangle, name);
  }
}

const walk = {
  walker: {
    toplevel(cont) {
      stack.push(cont.scope || new Scope());
      map(cont[1], walk.getWalker());
      return prog(cont, stack.pop);
    },
    do(cont) {
      map(cont[1], walk.getWalker());
      return cont;
    },
    block(cont) {
      map(cont[1], walk.getWalker());
      return cont;
    },
    var(cont) {
      const scope = stack.current();
      cont[1].forEach((item) => {
        scope.eo[item[0]] = item[1];
      });
      return cont;
    },
    semicolon(cont) {
      return cont;
    },
    while(cont) {
      map(cont[2], walk.getWalker());
      return cont;
    },
    try(cont) {
      map(cont[1], walk.getWalker());
      map(cont[3], walk.getWalker());
      map(cont[4], walk.getWalker());
      return cont;
    },
    new(cont) {
      if (cont[1][0] === 'function') map(cont[1], walk.getWalker());
      return cont;
    },
    function(cont) {
      stack.push(cont.scope || new Scope());
      map(cont[2], walk.getWalker());
      return prog(cont, stack.pop);
    },
    defun(cont) {
      const scope = cont.scope || new Scope();
      stack.push(scope);
      map(cont[2], walk.getWalker());
      return prog(cont, stack.pop);
    },
    switch(cont) {
      map(cont[2], walk.getWalker());
      return cont;
    },
    case(cont) {
      return cont;
    },
    call(cont) {
      return cont;
    },
    dot(cont) {
      return cont;
    },
    name(cont) {
      return cont;
    },
    binary(cont) {
      map(cont[2], walk.getWalker());
      map(cont[3], walk.getWalker());
      return cont;
    },
    stat(cont) {
      map(cont[1], walk.getWalker());
      return cont;
    },
  },
  setWalker(walker) {
    return this.newWalker = Object.assign({}, this.walker, walker);
  },
  getWalker() {
    return this.newWalker || this.walker;
  },
};

const map = function(target, handle) {
  if (target[0] instanceof Array) {
    return target.map((item) => {
      return map(item, handle);
    });
  } else {
    if (hit_obj(handle, target[0])) {
      return handle[target[0]](target);
    } else {
      return target;
    }
  }
};

const domap = curry(map, walk.newWalker || walk.walker);
console.log(domap);

const addscope = (ast) => map(ast, walk.setWalker({
  toplevel(cont) {
    const scope = new Scope();
    stack.push(cont.scope = scope);
    map(cont[1], walk.getWalker());
    return prog(cont, stack.pop);
  },
  defun(cont) {
    const scope = new Scope();
    const par = stack.current();
    stack.push(scope);
    map(cont[2], walk.getWalker());

    par.eo[cont[1][1]] = cont[2];
    par.children.push(cont.scope = scope);
    scope.parent = par;
    cont[3].forEach((item) => {
      scope.eo[item[1]] = undefined;
    });
    
    return prog(cont, stack.pop);
  },
  function(cont) {
    const scope = new Scope();
    const par = stack.current();
    stack.push(scope);
    map(cont[2], walk.getWalker());

    par.children.push(cont.scope = scope);
    scope.parent = par;
    cont[3].forEach((item) => {
      scope.eo[item[1]] = undefined;
    });

    return prog(cont, stack.pop);
  },
}));
const addao = (ast) => map(ast, walk.setWalker({
  toplevel(cont) {
    stack.push(cont.scope);
    map(cont[1], walk.getWalker());
    return prog(cont, stack.pop);
  },
  name(cont) {
    const scope = stack.current();
    if (hit_obj(scope.eo, cont[1])) {
      scope.ao[cont[1]] = true;
    } else {
      hit_parent(scope, cont[1]);
    }
    return cont;
  },
}));

const mangle = {
  base64,
  num: 0,
  getString(not) {
    let base = 54;
    let ret = '';
    let num;
    do {
      ret += this.base64.charAt(this.num % base);
      num = Math.floor(num / base64);
      base = 64;
    } while(num > 0 || ret == not && ++this.num);
    this.num++;
    return ret;
  },
  reset() {
    this.num = 0;
  },
};
/**
 * scope存在
 * ao中不存在，eo中存在;
 * 混淆的变量在ao中不能存在;
 **/
const addmangle = (ast) => map(ast, walk.setWalker({
  var(cont) {
    const scope = stack.current();
    cont[1].forEach((item) => {
      if (scope.canMangle(item[0])) {
        scope.addMangle(item[0], mangle.getString());
      }
    });
    return cont;
  },
  function(cont) {
    mangle.reset();
    stack.push(cont.scope);
    map(cont[2], walk.getWalker());
    return prog(cont, stack.pop);
  },
  defun(cont) {
    mangle.reset();
    stack.push(cont.scope);
    map(cont[2], walk.getWalker());
    return prog(cont, stack.pop);
  },
}));

const makecode = (ast) => {
  return map(ast, walk.setWalker({
    toplevel(cont) {
      stack.push(cont.scope);
      return prog(map(cont[1], walk.getWalker()), stack.pop);
    },
    var(cont) {
      const scope = stack.current();
      let ret = '';
      if (cont[1].length) {
        ret = 'var ';
        cont[1].forEach((item) => {
          console.log(domap(item[1]));
          ret += (scope.hasMangle(item[0]) ? scope.mangle[item[0]] : item[0]) + '=' + domap(item[1]) + ',';
        });
        ret = ret.slice(0, -1) + ';';
      }
      return ret;
    },
    num(cont) {
      return cont[1];
    },
    string(cont) {
      return cont[1];
    },
  }));
};

const result = res.exec();
Promise.resolve(result)
  .then(addscope)
  .then(addao)
  .then(addmangle)
  .then(makecode)
  .then((ast) => {
    console.log(ast);
  });

console.log(stack.data);


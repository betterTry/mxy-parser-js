/*
 * 全局变量不变;
 * 局部变量看有没有被内部函数用到;
 *
 *
*/
import parser from './parser';
// import {mangle} from '../constant';
import {hit_obj, as, prog} from '../utils';
const res = new parser(`
  a = 1;
  function c(){
    function d() {
      console.log(c);
      var a = 1;
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

const stack = [];
const getstack = () => stack[stack.length - 1];

class Scope {
  constructor() {
    this.children = [];
    this.parent = null;
    this.eo = {};
    this.body = null;
  }

  getstack() {
    return stack[stack.length - 1];
  }

  pushstack() {
    stack.push(this);
  }

  popstack() {
    stack.pop();
  }
}

const walk = {
  walker: {
    toplevel(cont) {
      const scope = new Scope();
      scope.pushstack(scope);
      const body = as(cont[0], map(cont[1], walk.walker));
      body.scope = scope;
      return prog(body, scope.popstack);
    },
    do(cont) {
      return as(cont[0], map(cont[1], walk.walker), cont[2]);
    },
    block(cont) {
      return as(cont[0], map(cont[1], walk.walker));
    },
    var(cont) {
      const _stack = getstack();
      cont[1].forEach((item) => {
        _stack.eo[item[0]] = item[1];
      });
      return cont;
    },
    semicolon(cont) {
      return cont;
    },
    while(cont) {
      console.log(cont);
      return as(cont[0], cont[1], map(cont[2], walk.walker));
    },
    try(cont) {
      return as(cont[0], map(cont[1], walk.walker), cont[2], map(cont[3], walk.walker), map(cont[4], walk.walker));
    },
    new(cont) {
      return as(cont[0], cont[1][0] === 'function' ? map(cont[1], walk.walker) : cont[1], cont[2]);
    },
    function(cont) {
      const scope = new Scope();
      const par = scope.getstack();
      scope.pushstack(scope);
      par.children.push(scope);
      scope.parent = par;
      cont[3].forEach((item) => {
        scope.eo[item[1]] = undefined;
      });
      const body = as(cont[0], cont[1], map(cont[2], walk.walker, scope), cont[3]);
      body.scope = scope;
      return prog(body, scope.popstack);
    },
    defun(cont) {
      const scope = new Scope();
      const par = scope.getstack();
      scope.pushstack(scope);
      par.eo[cont[1][1]] = cont[2];
      par.children.push(scope);
      scope.parent = par;
      console.log(cont);
      cont[3].forEach((item) => {
        scope.eo[item[1]] = undefined;
      });
      const body = as(cont[0], cont[1], map(cont[2], walk.walker), cont[3]);
      body.scope = scope;
      return prog(body, scope.popstack);
    },
    switch(cont) {
      return as(cont[0], cont[1], map(cont[2], walk.walker));
    },
    case(cont) {
      return cont;
    },
    stat(cont) {
      return cont;
    },
    call(cont) {
      return cont;
    },
    dot(cont) {
      return cont;
    },
  },
  setWalker(walker) {
    Object.assign(this.walker, walker);
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

const result = res.exec();
Promise.resolve(result)
  .then((data) => {
    return map(data, walk.walker);
  }).then((data) => {
    walk.setWalker({
      toplevel(cont) {
        stack.push(cont.scope);
        return prog(as(cont[0], map(cont[1], walk.walker)), cont.scope.popstack);
      },
      var(cont) {
        const scope = getstack();
        cont[1].forEach((item) => {
          if (hit_obj(scope.eo, item[0])) {
            console.log(item[0]);
          } else {
            console.log('22');
          }
        });
        console.log(cont);
        return cont;
      },
    });
    map(data, walk.walker);
  });


console.log(result);
console.log(stack);

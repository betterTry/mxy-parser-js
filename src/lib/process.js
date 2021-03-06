/*
 * 全局变量不变;
 * 局部变量看有没有被内部函数用到;
 *
 *
*/
import parser from './parser';
import {base64} from '../constant';
import {hit_obj, hit_parent, prog, curry, is_array, last} from '../utils';
const text = `
  var jsp = require("./parse-js"),
    curry = jsp.curry,
    slice = jsp.slice,
    member = jsp.member,
    is_identifier_char = jsp.is_identifier_char,
    PRECEDENCE = jsp.PRECEDENCE,
    OPERATORS = jsp.OPERATORS;

/* -----[ helper for AST traversal ]----- */

function ast_walker() {
    function _vardefs(defs) {
        return [ this[0], MAP(defs, function(def){
            var a = [ def[0] ];
            if (def.length > 1)
                a[1] = walk(def[1]);
            return a;
        }) ];
    };
    function _block(statements) {
        var out = [ this[0] ]; // 类型呢;
        if (statements != null)
            out.push(MAP(statements, walk)); // MAP跑;
        return out;
    };
    var walkers = {
        "string": function(str) {
            return [ this[0], str ];
        },
        "num": function(num) {
            return [ this[0], num ];
        },
        "name": function(name) {
            return [ this[0], name ];
        },
        "toplevel": function(statements) {
            return [ this[0], MAP(statements, walk) ]; // 遍历去walk;
        },
        "block": _block,
        "splice": _block,
        "var": _vardefs,
        "const": _vardefs,
        "try": function(t, c, f) {
            return [
                this[0],
                MAP(t, walk),
                c != null ? [ c[0], MAP(c[1], walk) ] : null,
                f != null ? MAP(f, walk) : null
            ];
        },
        "throw": function(expr) {
            return [ this[0], walk(expr) ];
        },
        "new": function(ctor, args) {
            return [ this[0], walk(ctor), MAP(args, walk) ];
        },
        "switch": function(expr, body) {
            return [ this[0], walk(expr), MAP(body, function(branch){
                return [ branch[0] ? walk(branch[0]) : null,
                         MAP(branch[1], walk) ];
            }) ];
        },
        "break": function(label) {
            return [ this[0], label ];
        },
        "continue": function(label) {
            return [ this[0], label ];
        },
        "conditional": function(cond, t, e) {
            return [ this[0], walk(cond), walk(t), walk(e) ];
        },
        "assign": function(op, lvalue, rvalue) {
            return [ this[0], op, walk(lvalue), walk(rvalue) ];
        },
        "dot": function(expr) {
            return [ this[0], walk(expr) ].concat(slice(arguments, 1));
        },
        "call": function(expr, args) {
            return [ this[0], walk(expr), MAP(args, walk) ];
        },
        "function": function(name, args, body) {
            return [ this[0], name, args.slice(), MAP(body, walk) ];
        },
        "debugger": function() {
            return [ this[0] ];
        },
        "defun": function(name, args, body) {
            return [ this[0], name, args.slice(), MAP(body, walk) ];
        },
        "if": function(conditional, t, e) {
            return [ this[0], walk(conditional), walk(t), walk(e) ];
        },
        "for": function(init, cond, step, block) {
            return [ this[0], walk(init), walk(cond), walk(step), walk(block) ];
        },
        "for-in": function(vvar, key, hash, block) {
            return [ this[0], walk(vvar), walk(key), walk(hash), walk(block) ];
        },
        "while": function(cond, block) {
            return [ this[0], walk(cond), walk(block) ];
        },
        "do": function(cond, block) {
            return [ this[0], walk(cond), walk(block) ];
        },
        "return": function(expr) {
            return [ this[0], walk(expr) ];
        },
        "binary": function(op, left, right) {
            return [ this[0], op, walk(left), walk(right) ];
        },
        "unary-prefix": function(op, expr) {
            return [ this[0], op, walk(expr) ];
        },
        "unary-postfix": function(op, expr) {
            return [ this[0], op, walk(expr) ];
        },
        "sub": function(expr, subscript) {
            return [ this[0], walk(expr), walk(subscript) ];
        },
        "object": function(props) {
            return [ this[0], MAP(props, function(p){
                return p.length == 2
                    ? [ p[0], walk(p[1]) ]
                    : [ p[0], walk(p[1]), p[2] ]; // get/set-ter
            }) ];
        },
        "regexp": function(rx, mods) {
            return [ this[0], rx, mods ];
        },
        "array": function(elements) {
            return [ this[0], MAP(elements, walk) ];
        },
        "stat": function(stat) {
            return [ this[0], walk(stat) ];
        },
        "seq": function() {
            return [ this[0] ].concat(MAP(slice(arguments), walk));
        },
        "label": function(name, block) {
            return [ this[0], name, walk(block) ];
        },
        "with": function(expr, block) {
            return [ this[0], walk(expr), walk(block) ];
        },
        "atom": function(name) {
            return [ this[0], name ];
        },
        "directive": function(dir) {
            return [ this[0], dir ];
        }
    };

    var user = {};
    var stack = []; // ast遍历时的堆栈信息;
    /**
     * 有可能加入用户定义的遍历函数;
     */
    function walk(ast) {
        if (ast == null)
            return null;
        try {
            stack.push(ast);
            var type = ast[0];
            var gen = user[type];
            if (gen) {
                var ret = gen.apply(ast, ast.slice(1)); // 在这里会将上下文对象变为ast;
                if (ret != null)
                    return ret;
            }
            gen = walkers[type]; // 默认的遍历器进行遍历;
            return gen.apply(ast, ast.slice(1));
        } finally {
            stack.pop();
        }
    };


    /**
     * 原生的walker进行遍历;
     */
    function dive(ast) {
        if (ast == null)
            return null;
        try {
            stack.push(ast);
            return walkers[ast[0]].apply(ast, ast.slice(1));
        } finally {
            stack.pop();
        }
    };

    /**
     * @see 存起来walkers中各个属性;
     * @return {ret 遍历后的新语法树}
     */
    function with_walkers(walkers, cont){
        var save = {}, i;
        for (i in walkers) if (HOP(walkers, i)) {
            save[i] = user[i]; // 缓存user;
            user[i] = walkers[i]; // 新的遍历器覆盖;
        }
        var ret = cont(); // 执行的函数; 一般在里面会调用walk(ast)进行遍历;
        // 恢复原来的状态;
        for (i in save) if (HOP(save, i)) {
            if (!save[i]) delete user[i]; // 如果!原有值, 删除现在值;
            else user[i] = save[i]; // 如果有原有值, 还原值;
        }
        return ret; // 一般是遍历后的ast语法树;
    };

    return {
        walk: walk,
        dive: dive,
        with_walkers: with_walkers,
        parent: function() {
            return stack[stack.length - 2]; // 最后一个是当前的node, 返回倒数第二个; // 在walker中循环调用walk stack会持续增多;
        },
        stack: function() { // 剩余的;
            return stack;
        }
    };
};`;
console.log(text);
const res = new parser(text);

const stack = {
  data: [],
  current() {
    return last(stack.data);
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
    this.num = 0;
  }
  canMangle(name) {
    return !this.hasMangle(name) && hit_obj(this.ao, name) && hit_obj(this.eo, name);
  }
  addMangle(old, n) {
    return this.mangle[old] = n;
  }
  hasMangle(name) {
    return hit_obj(this.mangle, name);
  }
  getMangle(not) {
    let base = 54;
    let ret = '';
    let num = this.num;
    do {
      ret += base64.charAt(num % base);
      num = Math.floor(num / base);
      base = 64;
    } while(num > 0);
    this.num++;
    if (not && ret == not[0]) {
      not.splice(0, 1);
      return this.getMangle(not);
    }

    return ret;
  }
  hasEo(name) {
    return hit_obj(this.eo, name);
  }
  addEo(name) {
    this.eo[name] = undefined;
  }
  addAo(name) {
    this.ao[name] = true;
  }
}


const walk = {
  walker: {
    toplevel(cont) {
      stack.push(cont.scope || new Scope());
      domap(cont[1]);
      return prog(cont, stack.pop);
    },
    do(cont) {
      domap(cont[1]);
      domap(cont[2]);
      return cont;
    },
    block(cont) {
      domap(cont[1]);
      return cont;
    },
    var(cont) {
      const scope = stack.current();
      cont[1].forEach((item) => {
        domap(item[1]);
        scope.eo[item[0]] = undefined;
      });
      return cont;
    },
    semicolon(cont) {
      return cont;
    },
    while(cont) {
      domap(cont[1]);
      domap(cont[2]);
      return cont;
    },
    try(cont) {
      domap(cont[1]);
      domap(cont[3]);
      domap(cont[4]);
      return cont;
    },
    new(cont) {
      if (cont[1][0] === 'function') domap(cont[1]);
      return cont;
    },
    function(cont) {
      stack.push(cont.scope || new Scope());
      domap(cont[1]);
      domap(cont[2]);
      domap(cont[3]);
      return prog(cont, stack.pop);
    },
    defun(cont) {
      stack.push(cont.scope || new Scope());
      domap(cont[1]);
      domap(cont[2]);
      domap(cont[3]);
      return prog(cont, stack.pop);
    },
    switch(cont) {
      domap(cont[1]);
      domap(cont[2]);
      return cont;
    },
    object(cont) {
      cont[1].forEach((item) => {
        domap(item[1]);
      });
      return cont;
    },
    seq(cont) {
      cont.slice(1).forEach((item) => {
        domap(item);
      });
      return cont;
    },
    sub(cont) {
      domap(cont[1]);
      domap(cont[2]);
      return cont;
    },
    case(cont) {
      domap(cont[1]);
      domap(cont[2]);
      return cont;
    },
    conditional(cont) {
      domap(cont[1]);
      domap(cont[2]);
      domap(cont[3]);
      return cont;
    },
    call(cont) {
      domap(cont[1]);
      domap(cont[2]);
      return cont;
    },
    dot(cont) {
      domap(cont[1]);
      return cont;
    },
    for_in(cont) {
      domap(cont[3]);
      return cont;
    },
    array(cont) {
      domap(cont[1]);
      return cont;
    },
    name(cont) {
      return cont;
    },
    if(cont) {
      domap(cont[1]);
      domap(cont[2]);
      domap(cont[3]);
      return cont;
    },
    binary(cont) {
      domap(cont[2]);
      domap(cont[3]);
      return cont;
    },
    parentheses(cont) {
      domap(cont[1]);
      return cont;
    },
    stat(cont) {
      domap(cont[1]);
      return cont;
    },
    debug(cont) {
      return cont;
    },
    return(cont) {
      return domap(cont[1]);
    },
    assign(cont) {
      domap(cont[1]);
      domap(cont[2]);
      return cont;
    },
    string(cont) {
      return cont;
    },
    break(cont) {
      return cont;
    },
    atom(cont) {
      return cont;
    },
    'unary-prefix'(cont) {
      domap(cont[2]);
      return cont;
    },
    'unary-postfix'(cont) {
      domap(cont[2]);
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
  if (!target) return '';
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

const domap = curry((...args) => map.apply(null, args.concat([args.splice(-1)[0]()])), walk.getWalker.bind(walk));

const addscope = (ast) => map(ast, walk.setWalker({
  toplevel(cont) {
    const scope = new Scope();
    stack.push(cont.scope = scope);
    domap(cont[1]);
    return prog(cont, stack.pop);
  },
  defun(cont) {
    const scope = new Scope();
    const par = stack.current();
    stack.push(scope);
    domap(cont[2]);

    par.eo[cont[1][1]] = cont[2];
    par.children.push(cont.scope = scope);
    scope.parent = par;

    scope.addEo(cont[1][1]);
    cont[3].forEach((item) => {
      scope.addEo(item[1]);
    });

    return prog(cont, stack.pop);
  },
  function(cont) {
    const scope = new Scope();
    const par = stack.current();
    stack.push(scope);
    domap(cont[2]);

    par.children.push(cont.scope = scope);
    scope.parent = par;

    cont[1] && scope.addEo(cont[1][1]);
    cont[3].forEach((item) => {
      scope.addEo(item[1]);
    });

    return prog(cont, stack.pop);
  },
}));
const addao = (ast) => map(ast, walk.setWalker({
  toplevel(cont) {
    stack.push(cont.scope);
    domap(cont[1]);
    return prog(cont, stack.pop);
  },
  name(cont) {
    const scope = stack.current();
    scope.addAo(cont[1]);
    // if (hit_obj(scope.eo, cont[1])) {
    //   scope.ao[cont[1]] = true;
    // } else {
    //   hit_parent(scope, cont[1]);
    // }
    return cont;
  },
}));

/**
 * scope存在
 * ao中不存在，eo中存在;
 * 混淆的变量在ao中不能存在;
 **/
const addmangle = (ast) => map(ast, walk.setWalker({
  // var(cont) {
  //   const scope = stack.current();
  //   scope.parent && cont[1].forEach((item) => {
  //     if (scope.canMangle(item[0])) {
  //       scope.addMangle(item[0], scope.getMangle());
  //     }
  //     domap(item[1]);
  //   });
  //
  //   return cont;
  // },
  // name(cont) {
  //   const scope = stack.current();
  //   if (scope.parent && scope.canMangle(cont[1])) {
  //     scope.addMangle(cont[1], scope.getMangle());
  //   }
  //   return cont;
  // },
  function(cont) {

    const scope = cont.scope;
    stack.push(cont.scope);
    const r = [];
    Object.keys(scope.ao).forEach((key) => {
      if (!scope.hasEo(key)) {
        const par = hit_parent(scope, key);
        par && r.push(scope.addMangle(par.mangle[key]));
      }
    });
    Object.keys(scope.eo).forEach((key) => {
      const a = scope.getMangle(r);
      console.log(a);
      scope.addMangle(key, a);
    });

    // domap(cont[1]);
    // domap(cont[3]);
    domap(cont[2]);
    return prog(cont, stack.pop);
  },
  defun(cont) {
    let scope = stack.current();
    scope.addMangle(cont[1][1], scope.getMangle());

    scope = cont.scope;
    stack.push(cont.scope);
    const r = [];
    Object.keys(scope.ao).forEach((key) => {
      if (!scope.hasEo(key)) {
        const par = hit_parent(scope, key);
        par && r.push(scope.addMangle(par.mangle[key]));
      }
    });
    Object.keys(scope.eo).forEach((key) => {
      scope.addMangle(key, scope.getMangle(r));
    });
    // domap(cont[1]);
    // stack.push(cont.scope);
    // domap(cont[3]);
    domap(cont[2]);
    return prog(cont, stack.pop);
  },
}));

const split = (data) => is_array(data) ? data.join('') : data;

const makecode = (ast) => {
  return map(ast, walk.setWalker({
    toplevel(cont) {
      stack.push(cont.scope);
      return split(prog(domap(cont[1]), stack.pop));
    },
    var(cont) {
      const scope = stack.current();
      let ret = '';
      if (cont[1].length) {
        ret = 'var ';
        cont[1].forEach((item) => {
          ret += (scope.hasMangle(item[0]) ? scope.mangle[item[0]] : item[0]) + (item[1] ? '=' + domap(item[1]) : '') + ',' ;
        });
        ret = ret.slice(0, -1) + ';';
      }
      return ret;
    },
    stat(cont) {
      return domap(cont[1]) + ';';
    },
    name(cont) {
      const scope = stack.current();
      return scope.hasMangle(cont[1]) ? scope.mangle[cont[1]] : cont[1];
    },
    block(cont) {
      const list = domap(cont[1]);
      let la = '';
      if (list.length) {
        la = list.pop().replace(/;$/, '');
      }
      return '{' + split(list) + la + '}';
    },
    call(cont) {
      return domap(cont[1]) + '(' + domap(cont[2]) + ')';
    },
    dot(cont) {
      return domap(cont[1]) + '.' + cont[2];
    },
    binary(cont) {
      return domap(cont[2]) + cont[1] + domap(cont[3]);
    },
    do(cont) {
      return 'do' + domap(cont[1]) + 'while' + domap(cont[2]);
    },
    while(cont) {
      return 'while' + domap(cont[1]) + domap(cont[2]);
    },
    try(cont) {
      return 'try' + domap(cont[1]) + (cont[2] ? 'catch(' + cont[2] + ')' + domap(cont[3]) : '') + (cont[4] ? 'finally' + domap(cont[4]) : '');
    },
    new(cont) {
      return 'new ' + domap(cont[1]) + (cont[2].length ? `(${domap(cont[2])})` : '');
    },
    defun(cont) {
      const name = domap(cont[1]);
      console.log(cont[1], stack.current());
      console.log(name);
      stack.push(cont.scope);
      const ret = 'function ' + name + '(' + domap(cont[3]).join(',') + ')' + domap(cont[2]);
      return prog(ret, stack.pop);
    },
    function(cont) { // 在这里判断下是不是到了括号，然后加上分号分割; 其实可以在block那里去判断;判断之前得类型;
      const name = cont[1] ? domap(cont[1]) : '';
      stack.push(cont.scope);
      const ret = `function ${name}(${domap(cont[3])})` + domap(cont[2]);
      return prog(ret, stack.pop);
    },
    return(cont) {
      return 'return ' + domap(cont[1]) + ';';
    },
    for_in(cont) {
      return 'for(' + domap(cont[1]) + ' in ' + cont[2] + ')' + domap(cont[3]);
    },
    parentheses(cont) {
      return '(' + domap(cont[1]) + ')';
    },
    object(cont) {
      return '{' + cont[1].map((item) => {
        return (/^\w+$/.test(item[0]) ? `${item[0]}:` : `"${item[0]}":`) + domap(item[1]);
      }).join(',') + '}';
    },
    array(cont) {
      return '[' + domap(cont[1]) + ']';
    },
    if(cont) {
      return 'if' + domap(cont[1]) + domap(cont[2]) + (cont[3] ? 'else ' + domap(cont[3]) : '');
    },
    conditional(cont) {
      return domap(cont[1]) + '?' + domap(cont[2]) + ':' + domap(cont[3]);
    },
    sub(cont) {
      return domap(cont[1]) + '[' + domap(cont[2]) + ']';
    },
    switch(cont) {
      return 'switch' + domap(cont[1]) + '{' + split(domap(cont[2])) + '}';
    },
    case(cont) {
      return 'case ' + domap(cont[1]) + ':' + split(domap(cont[2]));
    },
    seq(cont) {
      const ret = cont.slice(1).map((item) => {
        return domap(item);
      });
      return ret.join(',');
    },
    assign(cont) {
      return domap(cont[2]) + cont[1] + domap(cont[3]);
    },
    break(cont) {
      return cont[1] ? 'break ' + cont[1] : 'break;';
    },
    num(cont) {
      return cont[1];
    },
    string(cont) {
      return '"' + cont[1] + '"';
    },
    atom(cont) {
      return cont[1];
    },
    semicolon() {
      return '';
    },
    'unary-prefix'(cont) {
      return cont[1] + domap(cont[2]);
    },
    'unary-postfix'(cont) {
      return domap(cont[2]) + cont[1];
    },
  }));
};

const result = res.exec();
Promise.resolve(result)
  .then(addscope)
  .then(addao)
  .then(addmangle)
  .then(makecode)
  .then((result) => {
    console.log(stack.data);
    console.log(result);
  });

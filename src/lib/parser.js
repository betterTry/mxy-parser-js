import {
  UNARY_PREFIX,
  UNARY_POSTFIX,
  ASSIGN_OPEATORS,
  STATEMENTS_WITH_LABELS,
} from '../constant';
import tokenizer from './tokenizer';
import js_error from './js_error';
import {as, member, hit_obj, precedence} from '../utils';

class parser {
  constructor($TEXT, strict_mode) {
    this.tokenizer = typeof $TEXT == 'string' ? new tokenizer($TEXT) : $TEXT;
    this.S = {
      token: this.tokenizer.go,
      prev: null,
      peeked: null,
      in_directive: true,
      labels: [],
      in_loop: false,
      in_func: 0,
      strict_mode: strict_mode,
    };
  }

  get current() {
    return this.S.token;
  }

  next() {
    this.S.prev = this.S.token;
    if (this.S.peeked) {
      this.S.token = this.S.peeked;
      this.S.peeked = null;
    } else {
      this.S.token = this.tokenizer.go;
    }
    this.S.in_directive = this.S.in_directive && (this.S.token.type == 'string' || this.is('punc', ';'));
    return this.S.token;
  }

  peek() {
    return this.S.peeked || (this.S.peeked = this.tokenizer.go);
  }

  is_token(token, type, value) {
    return token.type == type && (!value || token.value == value);
  }

  is(type, value) {
    return this.is_token(this.current, type, value);
  }

  throw_error(message) {
    throw new js_error(message, this.current.line, this.current.col, this.current.pos);
  }

  // https://www.ecma-international.org/ecma-262/5.1/#sec-7.9
  can_auto_insert_semicolon() {
    return !this.S.strict_mode && (this.S.token.line_before || this.is('eof') || this.is('punc', '}'));
  }

  semicolon() {
    if (this.is('punc', ';')) this.next();
    else if (this.can_auto_insert_semicolon()) this.throw_error(); // 这种情况是严格模式时才会发生的; 严格模式不允许存在分号;
  }

  is_atom_token() {
    return /^(?:name|atom|num|string|regexp)$/.test(this.current.type);
  }

  prog(ret) {
    if (ret instanceof Function) ret = ret();
    for (let i = 1; i < arguments.length; i++) {
      arguments[i].bind(this)();
    }
    return ret;
  }

  expect_token(type, value) {
    if (this.is(type, value)) return this.prog(this.current, this.next);
    this.throw_error(`Unexpected token: ${type} ${this.current.value}`);
  }

  expect(value) {
    return this.expect_token('punc', value);
  }

  unexpected(token) {
    this.throw_error(`Unexpected token: ${token && token.type || this.current.type} ${token && token.value || this.current.value}`);
  }

  var_() {
    const ret = [];
    for (;;) {
      const name = this.expect_token('name').value;
      if (this.is('operator', '=')) {
        this.next();
        ret.push([name, this.expression(false)]);
      } else {
        ret.push(name);
      }
      if (!this.is('punc', ',')) break;
      this.next();
    }
    return as('var', ret);
  }

  loop(expr) {
    try {
      this.S.in_loop = true;
      return expr && expr.bind(this)();
    } finally {
      this.S.in_loop = false;
    }
  }

  regular_for(init) {
    this.expect(';');
    const test = this.is('punc', ';') ? null : this.expression();
    this.expect(';');
    const end = this.is('punc', ')') ? null : this.expression();
    this.expect(')');
    return as('for', init, test, end, this.loop(this.statement));
  }

  for_() {
    this.expect('(');
    let ret = null;
    if (!this.is('punc', ';')) {
      ret = this.is('keyword', 'var')
        ? (this.next(), this.var_())
        : (this.expression());
      if (this.is('operator', 'in')) {
        if (ret[0] == 'var' && ret[1].length > 1) {
          this.throw_error('Only one variable declaration allowed in for..in loop');
        }
        return this.for_in(ret);
      }
    }
    return this.regular_for(ret);
  }

  break_continue(type) {
    let name;
    if (!this.can_auto_insert_semicolon()) {
      name = this.is('name') ? this.current.value : null;
    }
    if (name !== null) {
      if (!member(this.S.labels, name)) {
        this.throw_error(`Uncaught SyntaxError: Undefined label ${name}`);
      }
    } else if (!this.S.in_loop) {
      // break label can exist in block statement;
      this.throw_error(`Uncaught SyntaxError: Illegal ${type} statement`);
    }
    return as(type, name);
  }

  function_(anonymous = true) {
    this.S.in_func += 1;
    this.S.in_directive = true;
    let name;
    if (!anonymous || this.is('name')) {
      name = as('name', this.expect_token('name').value);
    }
    this.expect_token('punc', '(');
    const params = this.expr_list(')', false, true, 'name');
    const block = this.block_();
    this.S.in_func -= 1;
    return as(anonymous ? 'function' : 'defun', name, block, params);
  }

  new_() {
    let args;
    const exp = this.expr_simple_expr(false);
    if (this.is('punc', '(')) {
      this.next();
      args = this.expr_list(')', false, false);
    } else {
      args = [];
    }
    return as('new', exp, args);
  }

  with_() {
    this.expect('(');
    const context = this.parentheses_();
    const body = this.block_();
    return as('with', context, body);
  }

  return_() {
    if (!this.S.in_func) this.unexpected();
    let body;
    if (this.is('punc', ';')) {
      body = undefined;
    } else if (!this.can_auto_insert_semicolon()) {
      body = this.prog(this.expression, this.next);
    }
    return as('return', body);
  }

  debug_() {
    this.semicolon();
    return as('debug');
  }

  switch_() {
    return this.loop(function() {
      this.expect('(');
      const target = this.parentheses_();
      this.expect('{');
      const case_block = [];
      let k, cond, stat;
      while (!this.is('punc', '}')) {
        if (this.is('eof')) this.unexpected();
        if (this.is('keyword', 'case') || this.is('keyword', 'default')) {
          stat = [];
          k = this.prog(this.current.value, this.next);
          cond = this.expression();
          this.expect(':');
          case_block.push(as(k, cond, stat));
        } else {
          stat.push(this.statement());
        }
      }
      this.expect('}');
      return as('switch', target, case_block);
    });
  }

  throw__() {
    const expr = this.expression();
    return as('throw', expr);
  }

  property_name() {
    switch(this.current.type) {
      case 'name':
      case 'string':
      case 'keyword':
      case 'atom':
        return this.prog(this.current.value, this.next);
      default:
        this.throw_error('Unexpected property name');
    }
  }

  object_() {
    let first = true, ret = [];
    while(!this.is('punc', '}')) {
      if (first) first = false;
      else this.expect(',');
      const name = this.property_name();
      if (this.is('name') && (name == 'get' || name == 'set') && !this.is('punc', ':')) {
        ret.push([as(name, this.function_())]);
      } else {
        this.expect(':');
        ret.push([name, this.expression(false)]);
      }
    }
    return this.prog(as('object', ret), this.next);
  }

  expr_list(close, allow_empty, force_empty, expr_type) {
    let first = true, ret = [];
    while(!this.is('punc', close)) {
      if (first) first = false;
      else this.expect(',');
      if (this.is('punc', ',')) {
        if (force_empty) this.throw_error('Unexpected token ,');
        if (allow_empty) ret.push(['atom', 'undefined']);
      } else {
        if (expr_type) {
          ret.push(as(expr_type, this.expect_token(expr_type).value));
        } else {
          ret.push(this.expression());
        }
      }
    }
    return this.prog(ret, this.next);
  }

  subscript(expr, allow_call) {
    if (allow_call && this.is('punc', '(')) { // 在这里不对参数进行判断了，出来再进行判断;
      this.next();
      return this.subscript(as('call', expr, this.expr_list(')')), allow_call);
    }
    if (this.is('punc', '.')) {
      this.next();
      return this.subscript(as('dot', expr, this.property_name()), allow_call);
    }
    if (this.is('punc', '[')) {
      this.next();
      if (this.is('punc', ']')) this.throw_error('Unexpected token ]');
      else return this.subscript(as('sub', expr, this.expr_list(']', false, true)));
    }
    return expr;
  }


  label_(label) {
    this.S.label.push(label);
    const cache = this.current;
    const stat = this.statement();
    if (this.S.strict_mode && !hit_obj(STATEMENTS_WITH_LABELS, stat[0]))
      this.unexpected(cache);
    this.S.pop();
    return as('label', label, stat);
  }

  block_() {
    this.expect('{');
    const ret = [];
    while(!this.is('punc', '}')) {
      ret.push(this.statement());
    }
    return this.prog(as('block', ret), this.next);
  }

  braces_() {
    const ret = this.block_();
    if (ret[1].length) {
      const item = ret[1];
      for (let i = 0, len = item.length; i < len; i++) {
        if (item && item[0] !== 'label') {
          return ret;
        }
      }
      return as('object', ret[1]);
    } else {
      return ret;
    }
  }

  try_() {
    const body = this.block_();
    let cat, e, fina;

    if (this.is('keyword', 'catch')) {
      this.next();
      this.expect('(');
      e = this.expect_token('name').value;
      this.expect(')');
      cat = this.block_();
    }
    if (this.is('keyword', 'finally')) {
      this.next();
      fina = this.block_();
    }
    return as('try', body, e, cat, fina);
  }

  while_() {
    this.expect('(');
    const cond = this.parentheses_();
    const body = this.statement();
    return as('while', cond, body);
  }

  do_() {
    return this.loop(function() {
      const body = this.statement();

      this.expect_token('keyword', 'while');
      this.expect('(');
      const cond = this.parentheses_();
      return as('do', body, cond);
    });
  }
    

  if_() {
    this.expect('(');
    const cond = this.parentheses_();
    const body = this.statement();
    let ebody;
    if (this.is('keyword', 'else')) {
      ebody = this.statement();
    }
    return as('if', cond[1], body, ebody);
  }

  parentheses_(commas) {
    if (!arguments.length) commas = true;
    const expr = this.is('punc', ')') ? [] : this.expression(commas);
    this.expect(')');
    return as('parentheses', expr);
  }

  expr_simple_expr(allow_call) {
    if (this.is('operator', 'new')) {
      this.next();
      return this.new_();
    }
    if (this.is('punc')) {
      switch(this.current.value) {
        case '(':
          this.next();
          return this.subscript(this.parentheses_(), allow_call);
        case '{':
          this.next();
          return this.subscript(this.object_(), allow_call);
        case '[':
          this.next();
          return this.subscript(this.array_(), allow_call);
      }
    }
    if (this.is('keyword', 'function')) {
      this.next();
      return this.function_();
    }
    if (this.is_atom_token()) {
      const atom = this.current.type == 'regexp'
        ? as('regexp', this.current.value[0], this.current.value[1])
        : as(this.current.type, this.current.value);
      return this.subscript(this.prog(atom, this.next), allow_call);
    }
    this.throw_error(`Unexpected token ${this.current.value}`);
  }

  make_unary(tag, op, expr) {
    if (tag == '++' || tag == '--' && !this.is_assignable(expr)) this.throw_error('Uncaught ReferenceError: Invalid left-hand side expression');
    return as(tag, op, expr);
  }

  maybe_unary() {
    if (hit_obj(UNARY_PREFIX, this.current.value)) {
      return this.make_unary('unary-prefix', this.prog(this.current.value, this.next), this.maybe_unary());
    }
    let val = this.expr_simple_expr(true);
    while (this.is('operator') && hit_obj(UNARY_POSTFIX, this.current.value) && !this.current.nlb) {
      val = this.make_unary('unary_postfix', this.current.value, val);
      this.next();
    }
    return val;
  }

  expr_ops(left) {
    // 应该先看一元操作符;
    left = left || this.maybe_unary();
    let op = this.is('operator') ? this.current.value : null;
    if (op !== null) {
      precedence[op];
      this.next();
      // 此处不需要从maybe_assign处来算, 是因为优先级的问题;
      var right = this.maybe_unary();
      return this.expr_ops(as('binary', op, left, right)); // 连等;
    }
    return left;
  }

  maybe_conditional() {
    const expr = this.expr_ops();
    if (this.is('operator', '?')) {
      this.next();
      const yes = this.expression(false);
      this.expect(':');
      return as('conditional', expr, yes, this.expression(false));
    }
    return expr;
  }

  is_assignable(expr) {
    switch(expr.type) {
      case 'dot':
      case 'sub':
        return true;
      case 'atom':
        if (expr.value == 'undefined') return true;
      case 'name':
        if (expr.value !== 'this') return true;
      default:
        return false;
    }
  }

  maybe_assign(commas) {
    let left = this.maybe_conditional();
    if (this.is('operator') || hit_obj(ASSIGN_OPEATORS, this.current.value)) {
      if (this.is_assignable(left)) {
        this.next();
        return as('assign', this.current.value, left, this.maybe_assign(commas));
      }
    }
    return left;
  }

  // left-hand-site expression;
  expression(commas = true) {
    const expr = this.maybe_assign(commas);
    if (commas && this.is('punc', ',')) {
      this.next();
      return as('seq', expr, this.expression(true));
    }
    return expr;
  }

  simple_statement() {
    return as('stat', this.expression());
  }

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements
   */
  statement() {
    // DivPunctuator
    // if (is('operator', '/') || is('operator', '/=')) {
    //   return this.tokenizer.read_regexp();
    // }
    const stat_type = this.current.type;
    const stat_name = this.current.value;
    switch(stat_type) {
      case 'string':
        var is_in_directive = this.S.in_directive;
        var stat = this.statement();
        if (is_in_directive && stat[0] == 'string' && !this.is('punc', ',')) {
          return as('directive', stat_name);
        } // 指令必须在函数或全局的首行; eval括起的字符串也支持指令;
        return stat;
      case 'operator':
      case 'atom':
      case 'num':
        return this.expr_simple_expr();
      case 'punc':
        switch(this.current.value) {
          case '{':
            return this.braces_();
          case '[':
            return this.array_();
          case '(':
            return this.parentheses_();
          case ';':
            this.next();
            return as('semicolon');
          default:
            this.unexpected();
        }
      case 'keyword':
        switch(this.prog(this.current.value, this.next)) {
          case 'break':
          case 'continue':
            return this.break_continue(stat_name);
          case 'function':
            return this.function_(false);
          case 'for':
            return this.for_();
          case 'var':
            return this.var_();
          case 'if':
            return this.if_();
          case 'do':
            return this.do_();
          case 'while':
            return this.while_();
          case 'try':
            return this.try_();
          case 'new':
            return this.new_();
          case 'throw':
            return this.throw__();
          case 'switch':
            return this.switch_();
          case 'debugger':
            return this.debug_();
          case 'return':
            return this.return_();
          case 'with':
            return this.with_();
        }
      case 'name':
        var p = this.peek();
        return this.is_token(p, 'punc', ':') ? this.label_() : this.simple_statement();
      default:
        this.unexpected();
    }
  }

  top_loop() {
    const ret = [];
    while(!this.is('eof')) {
      ret.push(this.statement());
    }
    return ret;
  }

  exec() {
    if (!this.result) {
      this.result = as('toplevel', this.top_loop());
    }
    return this.result;
  }
}


export default parser;

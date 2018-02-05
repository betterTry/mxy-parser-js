import {
  INDENTIFIER,
  UNARY_PREFIX,
  UNARY_POSTFIX,
  ASSIGN_OPEATORS,
} from './constant'
import tokenizer from './tokenizer';
import js_error from './js_error';
import {as, member} from '../utils';



class parse {
  constructor($TEXT) {
    this.tokenizer = typeof $TEXT == 'string' ? new tokenizer($TEXT) : $TEXT;
    this.S = {
      token: this.next(),
      prev: null,
      peeked: null,
      in_directive: true,
      labels: [],
      in_loop: false,
      in_block: false,
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

  is(type, value) {
    return this.S.token.type == type && (!value || value && value == this.S.token.value);
  }

  throw_error(message) {
    throw new js_error(message, this.current.line, this.current.col, this.current.pos);
  }

  // https://www.ecma-international.org/ecma-262/5.1/#sec-7.9
  can_insert_semicolon() {
    return this.S.token.line_before || is('eof') || is('punc', '}');
  }

  is_atom_token() {
    return /^(?:name|atom|num|string|regexp)$/.test(this.current.token);
  }

  semicolon() {
    if (this.is('punc', ';')) next();
    else if (this.can_insert_semicolon()) this.throw_error();
  }
  prog(ret) {
    if (ret instanceof Function) ret = ret();
    for (let i = 1; i < arguments.length; i++) {
      arguments[i]();
    }
    return ret;
  }

  expect_token(type, value) {
    if (this.is(type, value)) return this.next();
    throw_error(`Unexpected token: ${type} (${token})`);
  }

  expect(value) {
    return this.expect_token('punc', value);
  }

  var_() {
    const ret = [];
    for (;;) {
      const name = this.expect_token('name').value;
      if (this.is('operator', '=')) {
        ret.push([name, this.expression()]);
      } else {
        ret.push(name);
      }
      if (!is('punc', ',')) break;
      this.next();
    }
    return as['var', ret];
  }

  in_loop(statment) {
    try {
      this.in_loop = true;
      return this.statement();
    } finally {
      this.in_loop = false;
    }
  }

  regular_for(init) {
    this.expect(';');
    const test = this.is('punc', ';') ? null : this.expression();
    this.expect(';');
    const end = this.is('punc', ';') ? null : this.expression();
    this.expect(')');
    return as('for', init, test, end, this.in_loop(this.statement);
  }

  for_() {
    this.expect('(');
    const ret = null;
    if (!this.is('punc', ',')) {
      ret = this.is('keyword', 'var')
              ? (this.next(), this.var_())
              : (this.expression());
      if (this.is('operator', 'in')) {
        if (ret[0] == 'var' && ret[1].length > 1) {
          this.throw_error('Only one variable declaration allowed in for..in loop')''
        }
        return this.for_in(ret);
      }
    }
    return this.regular_for(ret);
  }

  break_continue(type) {
    let name;
    if (!this.can_insert_semicolon()) {
      name = is('name') ? this.current.value : null;
    }
    if (name !== null) {
      if (!member(this.S.labels, name)) {
        throw_error('Uncaught SyntaxError: Undefined label "a"');
      }
    } else if (!this.S.in_loop || type == 'break' && !this.S.in_block) {
      // break label can exist in block statement;
      throw_error(`Uncaught SyntaxError: Illegal ${type} statement`);
    }
    return as(type, name);
  }

  new_() {

  }

  parentheses_() {
    const expr = this.expression();
    this.expect(')');
    return as['parentheses', expr];
  }

  property_name() {
    switch(this.current.type) {
      case 'name':
      case 'string':
      case 'keyword':
      case 'atom':
        return this.current.name;
      default this.throw_error('Unexpected property name');
    }
  }

  object_() {
    let first = true, ret = [];
    while(!this.is('}')) {
      if (first) first = false;
      else this.expect(',');
      const name = this.property_name();
      if (this.is('punc', ':')) {
        ret.push(as[name, this.expression()])
      } else {
        ret.push(as[name, this.function_()]);
      }
    }
    return prog(this.as('object', ret), this.next);
  }

  expr_list(closem, allow_empty, force_empty) {
    let first = true, ret = [];
    while(!this.is('punc', close)) {
      if (first) first = false;
      else this.expect(',');
      if (this.is('punc', ',')) {
        if (force_empty) this.throw_error('Unexpected token ,');
        if (allow_empty) ret.push(['atom', 'undefined']);
      }
      else ret.push(this.expression());
    }
    return prog(ret, this.next);
  }

  subscript(expr, allow_call) {
    if (this.is('punc', '(')) {
      this.next();
      return this.subscript(this.as('call', expr, this.expr_list(')')), allow_call);
    }
    if (this.is('punc', '.')) {
      this.next();
      this.subscript(this.as('dot', expr, this.property_name()), allow_call);
    }
    if (this.is('punc', '[')) {
      this.next();
      if (this.is('punc', ']')) this.throw_error('Unexpected token ]');
      else return this.subscript(this.as('sub', expr, this.expr_list(']', false, true)));
    }
    return expr;
  }

  expect_simple_expr() {
    if (this.is('operator', 'new')) {
      this.next();
      return this.new_();
    }
    if (is('punc')) {
      switch(this.current.value) {
        case '(':
          this.next();
          return this.subscript(this.expression())
        case '{':
          this.next();
          return this.subscript(this.object_());
        case '[':
          this.next();
          return this.subscript(this.array_());
      }
    }
    if (is('keyword', 'function')) {
      this.next();
      return this.function_();
    }
    if (this.is_atom_token()) {
      if ()
      return as(this.current.type, this.current.value)
    }
    this.throw_error(`Unexpected token ${this.current.value}`)
  }

  make_unary(tag, op, expr) {
    if (tag == '++' || tag == '--' && !is_assignable(expr)) throw_error('Uncaught ReferenceError: Invalid left-hand side expression');
    return as(tag, op, expr);
  }

  maybe_unary() {
    if (hit_obj(UNARY_PREFIX, this.current.value)) {
      return this.make_unary('unary-prefix', prog(this.current.value, this.next), this.maybe_unary());
    }
    let val = this.expect_simple_expr();
    while (this.is('operator') && hit_obj(UNARY_POSTFIX, this.current.value) && !this.current.token.nlb) {
      val = this.make_unary('unary_postfix', this.current.value, val);
      this.next();
    }
    return val;
  }

  expr_ops() {
    // 应该先看一元操作符;
    const left = this.maybe_unary();
    let op = this.is('operator') ? this.current.value : null;
    if (op !== null) {
      op = precedence(op);
      // 此处不需要从maybe_assign处来算, 是因为优先级的问题;
      var right = this.maybe_unary();
      return this.expr_ops(this.as('binary', op, left, right));
    }
    return left;
  }

  maybe_conditional() {
    const expr = this.expr_ops();
    if (this.is('operator', '?')) {
      this.next();
      const yes = this.expression(false);
      this.expect(':');
      return this.as('conditional', expr, yes, this.expression(false))
    }
    return expr;
  }

  is_assignable() {

  }

  maybe_assign(commas) {
    let left = this.maybe_conditional();
    if (this.is('operator') || hit(ASSIGN_OPEATORS, this.current.value)) {
      if (this.is_assignable(left)) {
        this.next();
        return this.as('assign', this.current.value, left, this.maybe_assign(commas));
      }
    }
    return left;
  }

  unary_() {
    this.next();
    const expr = this.expression();
    while(ex)
    if (!this.is_assignable(this.expression())) this.throw_error('Unexpected ReferenceError');
  }

  is_valid_simple_assignment_target() {

  }


  // left-hand-site expression;
  expression(commas) {
    if (!arguments.length) commas = true;
    const expr = this.maybe_assign(commas);
    if (commas && this.is('punc', ',')) {
      this.next();
      return this.as('seq', expr, this.expression(true));
    }
    return expr;
  }


  simple_statement() {
    return as('stat', expression());
  }

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements
   */
  statements() {
    // DivPunctuator
    // if (is('operator', '/') || is('operator', '/=')) {
    //   return this.tokenizer.read_regexp();
    // }
    const stat_type = this.current.type;
    switch(stat_type) {
      case 'keyword':
        switch(this.prog(this.current.type, this.next)) {
          'break':
          'continue':
            return this.break_continue(stat_type);
          'for':
            return this.for_();
        }
    }
  }

  result() {
    return this.as('toplevel', (function(ret) {
      while(!this.is('eof')) ret.push(this.statements());
      return ret;
    }))([]);
  }

}

export default parse;

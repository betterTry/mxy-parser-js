import {
  INDENTIFIER,
  UNARY_PREFIX,
  UNARY_POSTFIX,
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



  make_unary(tag, op, ) {

  }

  maybe_unary() {
    if (hit_obj(UNARY_PREFIX, this.current.value)) {
      return make_unary('unary-prefix', prog(this.current.value, this.next), )
    }
    const val =
  }



  expect_token(type, value) {
    if (this.is(type, value)) return this.next();
    throw_error(`Unexpected token: ${type} (${token})`);
  }

  expect(value) {
    return this.expect_token('punc', value);
  }

  expr_ops() {
    const unary = this.maybe_unary();
  }

  maybe_atom() {

  }

  maybe_conditional() {
    const expr = this.expr_ops();
    if (this.is('operator', '?')) {
      return
    }
    return expr;
  }

  maybe_assign(commas) {
    let left = this.maybe_conditional();
    if (commas && this.is('punc', ',')) {
      return as('seq', left, this.expression())
    }
    return
  }


  // left-hand-site expression;
  expression(commas) {
    if (!arguments.length) commas = true;
    const expr = this.maybe_assign();

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

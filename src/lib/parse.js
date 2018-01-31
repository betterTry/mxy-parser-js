import {UNARY_PREFIX, UNARY_POSTFIX} from './constant'
import tokenizer from './tokenizer';



class parse {
  constructor($TEXT) {
    this.tokenizer = typeof $TEXT == 'string' ? new tokenizer($TEXT) : $TEXT;
    this.S = {
      token: this.next(),
      prev: null,
      peeked: null,
      in_directive: true,
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
  as() {
    return slice(arguments);
  }
  // https://www.ecma-international.org/ecma-262/5.1/#sec-7.9
  can_insert_semicolon() {
    return this.S.token.line_before || is('eof') || is('punc', '}');
  }

  semicolon() {
    if (this.is('punc', ';')) next();
    else if (this.can_insert_semicolon()) throw_error();
  }



  handle_string() {

  }

  prog(ret) {
    if (ret instanceof Function) ret = ret();
    for (let i = 1; i < arguments.length; i++) {
      arguments[i]();
    }
    return ret;
  }

  make_unary(tag, op, ) {

  }

  maybe_unary() {
    if (hit_obj(UNARY_PREFIX, this.current.value)) {
      return make_unary('unary-prefix', prog(this.current.value, this.next), )
    }
    const val =
  }

  expr_ops() {
    const unary = this.maybe_unary();
  }

  maybe_conditional() {
    const expr = this.expr_ops();
  }

  maybe_assign() {
    let left = this.maybe_conditional();
    if ()
  }
  expression() {
    const left = this.maybe_assign();

  }

  simple_statement() {
    return as('stat', expression());
  }


  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements
   */
  statements() {
    if (is('operator', '/') || is('operator', '/=')) {
      return this.tokenizer.read_regexp();
    }
    switch(this.current.type) {
      case 'string':
        const stat = this.simple_statement()
        if (this.S.in_directive && this.current)
        return
      case 'keyword':
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

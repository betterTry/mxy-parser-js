import tokenizer from './tokenizer';

class parse {
  constructor($TEXT) {
    this.tokenizer = typeof $TEXT == 'string' ? new tokenizer($TEXT) : $TEXT;
    this.S = {
      token: null,
      prev: null,
      peeked: null,
    };
  }

  next() {
    this.S.prev = this.S.token;
    if (this.S.peeked) {
      this.S.token = this.S.peeked;
      this.S.peeked = null;
    } else {
      this.S.token = this.tokenizer.go;
    }
    return this.S.token;
  }

  peek() {
    return this.S.peeked || (this.S.peeked = this.tokenizer.go);
  }

  is(type, value) {
    return this.S.token.type == type && (!value || value && value == this.S.token.value);
  }

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements
   */
  statements() {
    const token = this.peek();
    console.log(token);
  }

}

export default parse;

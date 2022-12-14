"use strict";
!(function (t, i) {
  var s = (function (t) {
    function i(t) {
      this.a = t;
    }
    function s(t) {
      return v.test(t);
    }
    function e(t) {
      return k.test(t);
    }
    function h(t) {
      return t.replace(A, "\n");
    }
    function r(t, i) {
      (this.b = t),
        (this.c = i),
        (this.d = null),
        (this.input = null),
        (this.e = -1),
        (this.f = -1),
        (this.g = -1),
        (this.h = -1),
        (this.i = -1),
        this.j();
    }
    function n(t, i) {
      (this.k = null),
        (this.startLine = 1),
        (this.startColumn = 0),
        (this.options = i || {}),
        (this.tokenizer = new r(this, t));
    }
    function a(t, s) {
      var e = new n(new i(p), s);
      return e.tokenize(t);
    }
    function o(t) {
      var i,
        s = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {},
        e = z.tokenize(t),
        h = [],
        r = [];
      for (s = new D(s), i = 0; i < e.length; i++) {
        var n = e[i];
        if (n.type !== y)
          if (n.type === T) {
            var a = u(n.chars, s);
            h.push.apply(h, a);
          } else h.push(n);
        else {
          h.push(n);
          var o = n.tagName.toUpperCase(),
            c = "A" === o || N.contains(s.ignoreTags, o);
          if (!c) continue;
          var p = h.length;
          f(o, e, ++i, h), (i += h.length - p - 1);
        }
      }
      for (i = 0; i < h.length; i++) {
        var l = h[i];
        switch (l.type) {
          case y:
            var m = "<" + l.tagName;
            if (l.attributes.length > 0) {
              var g = d(l.attributes);
              m += " " + g.join(" ");
            }
            (m += ">"), r.push(m);
            break;
          case C:
            r.push("</" + l.tagName + ">");
            break;
          case T:
            r.push(b(l.chars));
            break;
          case F:
            r.push("<!--" + b(l.chars) + "-->");
        }
      }
      return r.join("");
    }
    function u(i, s) {
      for (var e = t.tokenize(i), h = [], r = 0; r < e.length; r++) {
        var n = e[r];
        if ("nl" === n.type && s.nl2br)
          h.push({ type: y, tagName: "br", attributes: [], l: !0 });
        else if (n.isLink && s.check(n)) {
          var a = s.resolve(n),
            o = a.formatted,
            u = a.formattedHref,
            f = a.tagName,
            b = a.className,
            c = a.target,
            d = a.attributes,
            p = [["href", u]];
          b && p.push(["class", b]), c && p.push(["target", c]);
          for (var l in d) p.push([l, d[l]]);
          h.push({ type: y, tagName: f, attributes: p, l: !1 }),
            h.push({ type: T, chars: o }),
            h.push({ type: C, tagName: f });
        } else h.push({ type: T, chars: n.toString() });
      }
      return h;
    }
    function f(t, i, s, e) {
      for (var h = 1; s < i.length && h > 0; ) {
        var r = i[s];
        r.type === y && r.tagName.toUpperCase() === t
          ? h++
          : r.type === C && r.tagName.toUpperCase() === t && h--,
          e.push(r),
          s++;
      }
      return e;
    }
    function b(t) {
      return t;
    }
    function c(t) {
      return t.replace(/"/g, "&quot;");
    }
    function d(t) {
      for (var i = [], s = 0; s < t.length; s++) {
        var e = t[s],
          h = e[0],
          r = e[1];
        i.push(h + '="' + c(r) + '"');
      }
      return i;
    }
    var p = { m: "??" },
      l = /^#[xX]([A-Fa-f0-9]+)$/,
      m = /^#([0-9]+)$/,
      g = /^([A-Za-z0-9]+)$/;
    i.prototype.parse = function (t) {
      if (t) {
        var i = t.match(l);
        return i
          ? "&#x" + i[1] + ";"
          : (i = t.match(m))
          ? "&#" + i[1] + ";"
          : ((i = t.match(g)), i ? this.a[i[1]] || "&" + i[1] + ";" : void 0);
      }
    };
    var v = /[\t\n\f ]/,
      k = /[A-Za-z]/,
      A = /\r\n?/g;
    (r.prototype = {
      j: function () {
        (this.d = "beforeData"),
          (this.input = ""),
          (this.e = 0),
          (this.f = 1),
          (this.g = 0),
          (this.h = -1),
          (this.i = -1),
          this.b.j();
      },
      tokenize: function (t) {
        this.j(), this.tokenizePart(t), this.tokenizeEOF();
      },
      tokenizePart: function (t) {
        for (this.input += h(t); this.e < this.input.length; )
          this.n[this.d].call(this);
      },
      tokenizeEOF: function () {
        this.o();
      },
      o: function () {
        "data" === this.d && (this.b.p(), (this.d = "beforeData"));
      },
      q: function () {
        return this.input.charAt(this.e);
      },
      r: function () {
        var t = this.q();
        return this.e++, "\n" === t ? (this.f++, (this.g = 0)) : this.g++, t;
      },
      s: function () {
        var t = this.input.indexOf(";", this.e);
        if (t !== -1) {
          var i = this.input.slice(this.e, t),
            s = this.c.parse(i);
          if (s) {
            for (var e = i.length; e; ) this.r(), e--;
            return this.r(), s;
          }
        }
      },
      t: function () {
        (this.h = this.f),
          (this.i = this.g),
          this.b.tagOpen && this.b.tagOpen();
      },
      n: {
        beforeData: function () {
          var t = this.q();
          "<" === t
            ? ((this.d = "tagOpen"), this.t(), this.r())
            : ((this.d = "data"), this.b.u());
        },
        data: function () {
          var t = this.q();
          "<" === t
            ? (this.b.p(), (this.d = "tagOpen"), this.t(), this.r())
            : "&" === t
            ? (this.r(), this.b.v(this.s() || "&"))
            : (this.r(), this.b.v(t));
        },
        tagOpen: function () {
          var t = this.r();
          "!" === t
            ? (this.d = "markupDeclaration")
            : "/" === t
            ? (this.d = "endTagOpen")
            : e(t) &&
              ((this.d = "tagName"), this.b.w(), this.b.x(t.toLowerCase()));
        },
        markupDeclaration: function () {
          var t = this.r();
          "-" === t &&
            "-" === this.input.charAt(this.e) &&
            (this.r(), (this.d = "commentStart"), this.b.y());
        },
        commentStart: function () {
          var t = this.r();
          "-" === t
            ? (this.d = "commentStartDash")
            : ">" === t
            ? (this.b.z(), (this.d = "beforeData"))
            : (this.b.A(t), (this.d = "comment"));
        },
        commentStartDash: function () {
          var t = this.r();
          "-" === t
            ? (this.d = "commentEnd")
            : ">" === t
            ? (this.b.z(), (this.d = "beforeData"))
            : (this.b.A("-"), (this.d = "comment"));
        },
        comment: function () {
          var t = this.r();
          "-" === t ? (this.d = "commentEndDash") : this.b.A(t);
        },
        commentEndDash: function () {
          var t = this.r();
          "-" === t
            ? (this.d = "commentEnd")
            : (this.b.A("-" + t), (this.d = "comment"));
        },
        commentEnd: function () {
          var t = this.r();
          ">" === t
            ? (this.b.z(), (this.d = "beforeData"))
            : (this.b.A("--" + t), (this.d = "comment"));
        },
        tagName: function () {
          var t = this.r();
          s(t)
            ? (this.d = "beforeAttributeName")
            : "/" === t
            ? (this.d = "selfClosingStartTag")
            : ">" === t
            ? (this.b.B(), (this.d = "beforeData"))
            : this.b.x(t);
        },
        beforeAttributeName: function () {
          var t = this.q();
          return s(t)
            ? void this.r()
            : void ("/" === t
                ? ((this.d = "selfClosingStartTag"), this.r())
                : ">" === t
                ? (this.r(), this.b.B(), (this.d = "beforeData"))
                : ((this.d = "attributeName"),
                  this.b.C(),
                  this.r(),
                  this.b.D(t)));
        },
        attributeName: function () {
          var t = this.q();
          s(t)
            ? ((this.d = "afterAttributeName"), this.r())
            : "/" === t
            ? (this.b.F(!1),
              this.b.G(),
              this.r(),
              (this.d = "selfClosingStartTag"))
            : "=" === t
            ? ((this.d = "beforeAttributeValue"), this.r())
            : ">" === t
            ? (this.b.F(!1),
              this.b.G(),
              this.r(),
              this.b.B(),
              (this.d = "beforeData"))
            : (this.r(), this.b.D(t));
        },
        afterAttributeName: function () {
          var t = this.q();
          return s(t)
            ? void this.r()
            : void ("/" === t
                ? (this.b.F(!1),
                  this.b.G(),
                  this.r(),
                  (this.d = "selfClosingStartTag"))
                : "=" === t
                ? (this.r(), (this.d = "beforeAttributeValue"))
                : ">" === t
                ? (this.b.F(!1),
                  this.b.G(),
                  this.r(),
                  this.b.B(),
                  (this.d = "beforeData"))
                : (this.b.F(!1),
                  this.b.G(),
                  this.r(),
                  (this.d = "attributeName"),
                  this.b.C(),
                  this.b.D(t)));
        },
        beforeAttributeValue: function () {
          var t = this.q();
          s(t)
            ? this.r()
            : '"' === t
            ? ((this.d = "attributeValueDoubleQuoted"), this.b.F(!0), this.r())
            : "'" === t
            ? ((this.d = "attributeValueSingleQuoted"), this.b.F(!0), this.r())
            : ">" === t
            ? (this.b.F(!1),
              this.b.G(),
              this.r(),
              this.b.B(),
              (this.d = "beforeData"))
            : ((this.d = "attributeValueUnquoted"),
              this.b.F(!1),
              this.r(),
              this.b.H(t));
        },
        attributeValueDoubleQuoted: function () {
          var t = this.r();
          '"' === t
            ? (this.b.G(), (this.d = "afterAttributeValueQuoted"))
            : "&" === t
            ? this.b.H(this.s('"') || "&")
            : this.b.H(t);
        },
        attributeValueSingleQuoted: function () {
          var t = this.r();
          "'" === t
            ? (this.b.G(), (this.d = "afterAttributeValueQuoted"))
            : "&" === t
            ? this.b.H(this.s("'") || "&")
            : this.b.H(t);
        },
        attributeValueUnquoted: function () {
          var t = this.q();
          s(t)
            ? (this.b.G(), this.r(), (this.d = "beforeAttributeName"))
            : "&" === t
            ? (this.r(), this.b.H(this.s(">") || "&"))
            : ">" === t
            ? (this.b.G(), this.r(), this.b.B(), (this.d = "beforeData"))
            : (this.r(), this.b.H(t));
        },
        afterAttributeValueQuoted: function () {
          var t = this.q();
          s(t)
            ? (this.r(), (this.d = "beforeAttributeName"))
            : "/" === t
            ? (this.r(), (this.d = "selfClosingStartTag"))
            : ">" === t
            ? (this.r(), this.b.B(), (this.d = "beforeData"))
            : (this.d = "beforeAttributeName");
        },
        selfClosingStartTag: function () {
          var t = this.q();
          ">" === t
            ? (this.r(), this.b.I(), this.b.B(), (this.d = "beforeData"))
            : (this.d = "beforeAttributeName");
        },
        endTagOpen: function () {
          var t = this.r();
          e(t) && ((this.d = "tagName"), this.b.J(), this.b.x(t.toLowerCase()));
        },
      },
    }),
      (n.prototype = {
        tokenize: function (t) {
          return (this.K = []), this.tokenizer.tokenize(t), this.K;
        },
        tokenizePart: function (t) {
          return (this.K = []), this.tokenizer.tokenizePart(t), this.K;
        },
        tokenizeEOF: function () {
          return (this.K = []), this.tokenizer.tokenizeEOF(), this.K[0];
        },
        j: function () {
          (this.k = null), (this.startLine = 1), (this.startColumn = 0);
        },
        L: function () {
          this.options.M &&
            (this.k.M = {
              start: { f: this.startLine, g: this.startColumn },
              N: { f: this.tokenizer.f, g: this.tokenizer.g },
            }),
            (this.startLine = this.tokenizer.f),
            (this.startColumn = this.tokenizer.g);
        },
        u: function () {
          (this.k = { type: "Chars", chars: "" }), this.K.push(this.k);
        },
        v: function (t) {
          this.k.chars += t;
        },
        p: function () {
          this.L();
        },
        y: function () {
          (this.k = { type: "Comment", chars: "" }), this.K.push(this.k);
        },
        A: function (t) {
          this.k.chars += t;
        },
        z: function () {
          this.L();
        },
        w: function () {
          (this.k = { type: "StartTag", tagName: "", attributes: [], l: !1 }),
            this.K.push(this.k);
        },
        J: function () {
          (this.k = { type: "EndTag", tagName: "" }), this.K.push(this.k);
        },
        B: function () {
          this.L();
        },
        I: function () {
          this.k.l = !0;
        },
        x: function (t) {
          this.k.tagName += t;
        },
        C: function () {
          (this._currentAttribute = ["", "", null]),
            this.k.attributes.push(this._currentAttribute);
        },
        D: function (t) {
          this._currentAttribute[0] += t;
        },
        F: function (t) {
          this._currentAttribute[2] = t;
        },
        H: function (t) {
          (this._currentAttribute[1] = this._currentAttribute[1] || ""),
            (this._currentAttribute[1] += t);
        },
        G: function () {},
      });
    var z = {
        HTML5NamedCharRefs: p,
        EntityParser: i,
        EventedTokenizer: r,
        Tokenizer: n,
        tokenize: a,
      },
      N = t.options,
      D = N.Options,
      y = "StartTag",
      C = "EndTag",
      T = "Chars",
      F = "Comment";
    return o;
  })(i);
  t.linkifyHtml = s;
})(window, linkify);

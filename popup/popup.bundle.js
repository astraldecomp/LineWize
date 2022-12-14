!(function (e) {
  function n(n) {
    for (
      var o, a, s = n[0], l = n[1], c = n[2], f = 0, p = [];
      f < s.length;
      f++
    )
      (a = s[f]),
        Object.prototype.hasOwnProperty.call(r, a) && r[a] && p.push(r[a][0]),
        (r[a] = 0);
    for (o in l) Object.prototype.hasOwnProperty.call(l, o) && (e[o] = l[o]);
    for (d && d(n); p.length; ) p.shift()();
    return i.push.apply(i, c || []), t();
  }
  function t() {
    for (var e, n = 0; n < i.length; n++) {
      for (var t = i[n], o = !0, s = 1; s < t.length; s++) {
        var l = t[s];
        0 !== r[l] && (o = !1);
      }
      o && (i.splice(n--, 1), (e = a((a.s = t[0]))));
    }
    return e;
  }
  var o = {},
    r = { 0: 0 },
    i = [];
  function a(n) {
    if (o[n]) return o[n].exports;
    var t = (o[n] = { i: n, l: !1, exports: {} });
    return e[n].call(t.exports, t, t.exports, a), (t.l = !0), t.exports;
  }
  (a.m = e),
    (a.c = o),
    (a.d = function (e, n, t) {
      a.o(e, n) || Object.defineProperty(e, n, { enumerable: !0, get: t });
    }),
    (a.r = function (e) {
      "undefined" != typeof Symbol &&
        Symbol.toStringTag &&
        Object.defineProperty(e, Symbol.toStringTag, { value: "Module" }),
        Object.defineProperty(e, "__esModule", { value: !0 });
    }),
    (a.t = function (e, n) {
      if ((1 & n && (e = a(e)), 8 & n)) return e;
      if (4 & n && "object" == typeof e && e && e.__esModule) return e;
      var t = Object.create(null);
      if (
        (a.r(t),
        Object.defineProperty(t, "default", { enumerable: !0, value: e }),
        2 & n && "string" != typeof e)
      )
        for (var o in e)
          a.d(
            t,
            o,
            function (n) {
              return e[n];
            }.bind(null, o)
          );
      return t;
    }),
    (a.n = function (e) {
      var n =
        e && e.__esModule
          ? function () {
              return e.default;
            }
          : function () {
              return e;
            };
      return a.d(n, "a", n), n;
    }),
    (a.o = function (e, n) {
      return Object.prototype.hasOwnProperty.call(e, n);
    }),
    (a.p = "/popup/");
  var s = (window.webpackJsonp = window.webpackJsonp || []),
    l = s.push.bind(s);
  (s.push = n), (s = s.slice());
  for (var c = 0; c < s.length; c++) n(s[c]);
  var d = l;
  i.push([7, 1]), t();
})([
  ,
  ,
  ,
  ,
  ,
  ,
  ,
  function (e, n, t) {
    "use strict";
    var o =
      (this && this.__importStar) ||
      function (e) {
        if (e && e.__esModule) return e;
        var n = {};
        if (null != e)
          for (var t in e) Object.hasOwnProperty.call(e, t) && (n[t] = e[t]);
        return (n.default = e), n;
      };
    Object.defineProperty(n, "__esModule", { value: !0 });
    const r = o(t(1)),
      i = o(t(9)),
      a = t(13);
    i.render(
      r.createElement(a.Classroom, null),
      document.getElementById("root")
    );
  },
  ,
  ,
  ,
  ,
  ,
  function (e, n, t) {
    "use strict";
    var o =
        (this && this.__importStar) ||
        function (e) {
          if (e && e.__esModule) return e;
          var n = {};
          if (null != e)
            for (var t in e) Object.hasOwnProperty.call(e, t) && (n[t] = e[t]);
          return (n.default = e), n;
        },
      r =
        (this && this.__importDefault) ||
        function (e) {
          return e && e.__esModule ? e : { default: e };
        };
    Object.defineProperty(n, "__esModule", { value: !0 });
    const i = o(t(1)),
      a = t(14),
      s = t(25),
      l = r(t(28)),
      c = r(t(29));
    t(30);
    class d extends i.Component {
      constructor(e) {
        super(e),
          (this.reloadConfig = () => {
            this.state.reloading ||
              (this.state.config && this.state.config.loading) ||
              chrome.runtime.sendMessage({ greeting: "ReloadConfig" });
          }),
          (this.state = { reloading: !1 }),
          chrome.runtime.onMessage.addListener(this.messageHandler.bind(this));
      }
      componentDidMount() {
        this.reloadState();
      }
      messageHandler(e, n, t) {
        e.greeting &&
          ("ReloadPopup" == e.greeting && this.reloadState(),
          "ReloadingPopup" == e.greeting &&
            this.setState((e) => ({ reloading: !0 })));
      }
      reloadState() {
        this.setState((e) => ({ reloading: !0, config: e.config })),
          chrome.runtime.sendMessage({ greeting: "GetStatus" }, (e) => {
            this.setState({ reloading: !1, config: e });
          });
      }
      render() {
        return i.createElement(
          "div",
          { className: "classroom" },
          i.createElement(
            "div",
            { className: "header" },
            i.createElement("img", { className: "fz-icon", src: l.default }),
            i.createElement("p", { className: "title" }, "connect"),
            i.createElement("img", {
              title: "Reload",
              className:
                "reload " +
                (this.state.reloading ||
                (this.state.config && this.state.config.loading)
                  ? "reloading"
                  : ""),
              onClick: this.reloadConfig,
              src: c.default,
            })
          ),
          i.createElement(
            "div",
            { className: "content" },
            this.renderContent()
          ),
          this.renderConfig()
        );
      }
      renderContent() {
        var e, n;
        return !this.state.config || this.state.config.disabled
          ? i.createElement(
              "div",
              { className: "disabled" },
              i.createElement(
                "p",
                null,
                "Your school has disabled this extension on this device"
              )
            )
          : (null === (e = this.state.config) || void 0 === e
              ? void 0
              : e.appliance.inside_network) &&
            !(null === (n = this.state.config) || void 0 === n
              ? void 0
              : n.appliance.authenticated) &&
            this.state.config.extension_login
          ? i.createElement(s.Login, null)
          : i.createElement(a.Policy, { config: this.state.config });
      }
      renderConfig() {
        var e, n, t, o;
        return i.createElement(
          "div",
          { className: "config" },
          this.state.config &&
            i.createElement(
              "table",
              { className: "features" },
              i.createElement(
                "tbody",
                null,
                i.createElement(
                  "tr",
                  null,
                  i.createElement(
                    "td",
                    null,
                    "FILTERING ",
                    i.createElement(
                      "span",
                      { className: "value" },
                      this.state.config.features.Filtering ? "ON" : "OFF"
                    )
                  ),
                  i.createElement(
                    "td",
                    null,
                    "CLASSROOM ",
                    i.createElement(
                      "span",
                      { className: "value" },
                      this.state.config.features.Classroom ? "ON" : "OFF"
                    )
                  )
                ),
                i.createElement(
                  "tr",
                  null,
                  i.createElement(
                    "td",
                    null,
                    "CONNECTIONS ",
                    i.createElement(
                      "span",
                      { className: "value" },
                      this.state.config.features.Connections ? "ON" : "OFF"
                    )
                  ),
                  i.createElement(
                    "td",
                    null,
                    "CHROMEOS ONLY ",
                    i.createElement(
                      "span",
                      { className: "value" },
                      this.state.config.features.ChromebookOnly ? "ON" : "OFF"
                    )
                  )
                )
              )
            ),
          this.state.config &&
            i.createElement(
              "div",
              { className: "identity" },
              i.createElement(
                "p",
                { className: "device" },
                "Device: ",
                i.createElement(
                  "span",
                  { className: "value" },
                  null ===
                    (n =
                      null === (e = this.state.config) || void 0 === e
                        ? void 0
                        : e.appliance) || void 0 === n
                    ? void 0
                    : n.device_id
                )
              ),
              i.createElement(
                "p",
                { className: "chrome" },
                "Chrome: ",
                i.createElement(
                  "span",
                  { className: "value" },
                  this.state.config.chrome_user
                )
              ),
              i.createElement(
                "p",
                { className: "network" },
                "Network: ",
                i.createElement(
                  "span",
                  { className: "value" },
                  (
                    null === (t = this.state.config) || void 0 === t
                      ? void 0
                      : t.appliance.inside_network
                  )
                    ? null === (o = this.state.config) || void 0 === o
                      ? void 0
                      : o.appliance.network_user
                    : "Off network"
                )
              )
            ),
          i.createElement(
            "div",
            { className: "version" },
            "Version ",
            chrome.runtime.getManifest().version
          )
        );
      }
    }
    n.Classroom = d;
  },
  function (e, n, t) {
    "use strict";
    var o =
        (this && this.__importStar) ||
        function (e) {
          if (e && e.__esModule) return e;
          var n = {};
          if (null != e)
            for (var t in e) Object.hasOwnProperty.call(e, t) && (n[t] = e[t]);
          return (n.default = e), n;
        },
      r =
        (this && this.__importDefault) ||
        function (e) {
          return e && e.__esModule ? e : { default: e };
        };
    Object.defineProperty(n, "__esModule", { value: !0 });
    const i = o(t(1)),
      a = t(15),
      s = t(21),
      l = r(t(22));
    t(23);
    class c extends i.Component {
      renderPolicyElements() {
        var e, n;
        const t = new Array();
        let o;
        this.props.config.features.Filtering ||
        (null === (e = this.props.config) || void 0 === e
          ? void 0
          : e.appliance.inside_network)
          ? t.push(
              this.renderPolicyElement(
                "filtering",
                !0,
                "Managed by school policy"
              )
            )
          : t.push(
              this.renderPolicyElement(
                "filtering",
                !1,
                "Not managed by school policy"
              )
            ),
          this.props.config.features.Connections ||
          (null === (n = this.props.config) || void 0 === n
            ? void 0
            : n.appliance.inside_network)
            ? t.push(
                this.renderPolicyElement(
                  "connections",
                  !0,
                  "Browsing activity reported"
                )
              )
            : t.push(
                this.renderPolicyElement(
                  "connections",
                  !1,
                  "Browsing activity not reported"
                )
              );
        let r = !1;
        return (
          this.props.config.classes &&
            (this.props.config.classes.forEach((e) => {
              e.is_monitoring_class && (r = !0);
            }),
            (o = this.props.config.classes.filter(
              (e) => !e.is_monitoring_class
            ))),
          o && 0 != o.length
            ? o.forEach((e) => {
                t.push(this.renderClassroom(e));
              })
            : t.push(
                this.renderPolicyElement(
                  "classroom",
                  !1,
                  "Not in an active class"
                )
              ),
          r && t.push(this.renderBeingMonitored()),
          t
        );
      }
      renderPolicyElement(e, n, t) {
        return i.createElement(
          "div",
          { key: e, className: "element" },
          i.createElement(a.FontAwesomeIcon, {
            className: n ? "good-icon" : "disabled-icon",
            icon: n ? s.faCheck : s.faCircle,
          }),
          t
        );
      }
      renderClassroom(e) {
        return i.createElement(
          "div",
          { key: e.classroom_name, className: "element" },
          i.createElement(a.FontAwesomeIcon, {
            className: "good-icon",
            icon: s.faCheck,
          }),
          (e.teacher_information &&
            e.teacher_information.first_name &&
            e.teacher_information.last_name &&
            `In ${e.teacher_information.first_name} ${e.teacher_information.last_name}'s class`) ||
            "In an active class",
          i.createElement(
            "div",
            { className: "classroom" },
            i.createElement(
              "p",
              null,
              i.createElement(a.FontAwesomeIcon, {
                className: "good-icon",
                icon: s.faChalkboard,
              }),
              i.createElement("span", { className: "value" }, e.classroom_name)
            ),
            (e.focused &&
              i.createElement(
                "p",
                null,
                i.createElement(a.FontAwesomeIcon, {
                  className: "good-icon",
                  icon: s.faSearch,
                }),
                " Browsing focused by teacher"
              )) ||
              (e.locked &&
                i.createElement(
                  "p",
                  null,
                  i.createElement(a.FontAwesomeIcon, {
                    className: "disabled-icon",
                    icon: s.faLock,
                  }),
                  " Browsing locked by teacher"
                ))
          )
        );
      }
      renderBeingMonitored() {
        return i.createElement(
          "div",
          { className: "element" },
          i.createElement("img", { className: "monitor-icon", src: l.default }),
          "Device actively monitored"
        );
      }
      getUserDisplayName() {
        return this.props.config.user_information &&
          this.props.config.user_information.first_name &&
          this.props.config.user_information.last_name
          ? `${this.props.config.user_information.first_name} ${this.props.config.user_information.last_name}`
          : "student";
      }
      render() {
        return i.createElement(
          "div",
          { className: "policy" },
          i.createElement(
            "h1",
            { className: "title" },
            "Hello, ",
            this.getUserDisplayName()
          ),
          i.createElement(
            "div",
            { className: "elements" },
            this.renderPolicyElements()
          )
        );
      }
    }
    n.Policy = c;
  },
  ,
  ,
  ,
  ,
  ,
  ,
  ,
  function (e, n, t) {
    "use strict";
    t.r(n),
      (n.default =
        t.p + "assets/monitor_eye.7f6c44e5fcb8b4dc8e09f35849849752.svg");
  },
  function (e, n, t) {
    var o = t(3),
      r = t(24);
    "string" == typeof (r = r.__esModule ? r.default : r) &&
      (r = [[e.i, r, ""]]);
    var i = { insert: "head", singleton: !1 },
      a = (o(r, i), r.locals ? r.locals : {});
    e.exports = a;
  },
  function (e, n, t) {
    (n = t(4)(!1)).push([
      e.i,
      ".policy svg{\n    min-width: 16px;\n}\n\n.policy .good-icon {\n    color: #2680eb;  \n}\n\n.policy .disabled-icon {\n    color: #808284;\n}\n\n.policy h1.title {\n    text-align: center;\n    font-size: 14pt;\n    font-weight: 500;\n    margin-top: 25px;\n}\n\n.policy .elements {\n    display: grid;\n    margin: 0 25px 25px 25px;\n    font-size: 10pt;\n}\n\n.policy .elements .element {\n    margin: 10px 0;\n    font-size: 11pt;\n    font-weight: 200;\n    overflow: hidden;\n}\n\n.policy .elements .element svg {\n    margin-right: 10px;\n}\n\n.policy .elements .element .classroom {\n    background: #efebeb;\n    margin: 10px 10px 0px 25px;\n    font-size: 10pt;\n}\n\n.policy .elements .element .classroom p {\n    margin: 0px;\n    padding: 10px;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n    overflow: hidden;\n}\n\n.policy .elements .element .classroom p .value {\n    font-weight: 400;\n}\n\n.monitor-icon {\n    width: 16px;\n    margin-right: 8px;\n}",
      "",
    ]),
      (e.exports = n);
  },
  function (e, n, t) {
    "use strict";
    var o =
      (this && this.__importStar) ||
      function (e) {
        if (e && e.__esModule) return e;
        var n = {};
        if (null != e)
          for (var t in e) Object.hasOwnProperty.call(e, t) && (n[t] = e[t]);
        return (n.default = e), n;
      };
    Object.defineProperty(n, "__esModule", { value: !0 });
    const r = o(t(1));
    t(26);
    class i extends r.Component {
      constructor() {
        super(...arguments),
          (this.sendLogin = (e) => {
            e.preventDefault(),
              chrome.runtime.sendMessage(
                { greeting: "SignIn" },
                () => location.reload
              );
          });
      }
      render() {
        return r.createElement(
          "div",
          { className: "login" },
          r.createElement(
            "p",
            null,
            "You are not currently signed into the school network"
          ),
          r.createElement(
            "form",
            { className: "login-form", onSubmit: this.sendLogin },
            r.createElement("button", { type: "submit" }, "SIGN IN")
          )
        );
      }
    }
    n.Login = i;
  },
  function (e, n, t) {
    var o = t(3),
      r = t(27);
    "string" == typeof (r = r.__esModule ? r.default : r) &&
      (r = [[e.i, r, ""]]);
    var i = { insert: "head", singleton: !1 },
      a = (o(r, i), r.locals ? r.locals : {});
    e.exports = a;
  },
  function (e, n, t) {
    (n = t(4)(!1)).push([
      e.i,
      ".login {\n    text-align: center;\n    font-size: large;\n    max-width: 250px;\n    margin-left: 50px;\n    margin-top: 40px;\n}\n\n.login p {\n    word-break: break-word;\n    white-space: normal;\n}\n\n.login form.login-form {\n    display: grid;\n}\n\n.login form.login-form button {\n    background-color: #2680eb;\n    border: none;\n    border-radius: 4px;\n    padding: 10px;\n    text-align: center;\n    color: #fff;\n    font-size: large;\n    font-weight: 400;\n    margin: 10px 25px 40px 25px;\n}\n\n.login form.login-form button:hover {\n    background-color: #4d94e8;\n    cursor: pointer;\n}",
      "",
    ]),
      (e.exports = n);
  },
  function (e, n, t) {
    "use strict";
    t.r(n),
      (n.default =
        t.p + "assets/fz_icon_white.830422a22d889d0183b00a863afeab88.png");
  },
  function (e, n, t) {
    "use strict";
    t.r(n),
      (n.default = t.p + "assets/refresh.64b9fd4b7c49da18c5c64a9f5c5b5b66.png");
  },
  function (e, n, t) {
    var o = t(3),
      r = t(31);
    "string" == typeof (r = r.__esModule ? r.default : r) &&
      (r = [[e.i, r, ""]]);
    var i = { insert: "head", singleton: !1 },
      a = (o(r, i), r.locals ? r.locals : {});
    e.exports = a;
  },
  function (e, n, t) {
    var o = t(4),
      r = t(32),
      i = t(33);
    n = o(!1);
    var a = r(i);
    n.push([
      e.i,
      "@font-face {\n  font-family: 'Lato';\n  font-style: normal;\n  font-weight: 400;\n  src: url(" +
        a +
        ");\n}\n\nbody {\n  text-align: left;\n  white-space: nowrap;\n  margin: unset;\n  min-width: 350px;\n  max-width: 350px;\n  background-color: #fff;\n  font-family: 'Lato';\n}\n\n.header {\n  min-height: 70px;\n  max-height: 70px;\n  background-color: #2680eb;\n  text-align: right;\n}\n\n.header .fz-icon {\n  max-width: 50px;\n  margin: 15px;\n  vertical-align: middle;\n  display: inline-block;\n}\n\n.header .title {\n  color: #fff;\n  font-weight: 800;\n  font-size: 16pt;\n  display: inline-block;\n  vertical-align: middle;\n  letter-spacing: 1px;\n}\n\n.header .reload {\n  display: inline-block;\n  vertical-align: middle;\n  max-width: 20px;\n  margin-left: 50px;\n  margin-right: 30px;\n}\n\n.header .reload:hover {\n  cursor: pointer;\n}\n\n.header .reload.reloading {\n  animation: reloading 0.7s linear infinite;\n}\n\n.header .reload.reloading:hover {\n  cursor: not-allowed !important;\n}\n\n@keyframes reloading {\n  from {\n    transform: rotate(0deg);\n  }\n  to {\n    transform: rotate(360deg);\n  }\n}\n\n.disabled {\n  text-align: center;\n  font-size: large;\n  margin: 50px;\n}\n\n.disabled p {\n  word-break: break-word;\n  white-space: normal;\n}\n\n.config {\n  width: 100%;\n  border-top: #e8e8e8 2px solid;\n}\n\n.config table.features {\n  background-color: #efebeb;\n  border-spacing: 0;\n  border: 0;\n  margin: 25px;\n  min-width: 300px;\n}\n\n.config .features td {\n  border-color: #8f8e8e;\n  border-width: 1px;\n  border-style: solid;\n  padding: 5px 10px;\n  font-weight: 200;\n}\n\n.config table.features tr:first-child td:first-child {\n  border-top-left-radius: 4px;\n}\n\n.config table.features tr:first-child td:last-child {\n  border-top-right-radius: 4px;\n}\n\n.config table.features tr:last-child td:first-child {\n  border-bottom-left-radius: 4px;\n}\n\n.config table.features tr:last-child td:last-child {\n  border-bottom-right-radius: 4px;\n}\n\n.config table.features span.value {\n  font-weight: bold;\n  padding-left: 5px;\n}\n\n.config .identity p {\n  font-weight: 600;\n  font-size: 10pt;\n}\n\n.config .identity p.device {\n  margin:0px;\n}\n\n.config .identity p.chrome, p.network {\n  margin:4px 0px 0px 0px;\n}\n\n.config .identity p .value {\n  font-weight: 200;\n}\n\n.config .identity {\n  margin: 25px 25px 0px 25px;\n}\n\n.config .version {\n  color: #8f8e8e;\n  margin: 15px 25px;\n  font-size: 10pt;\n  font-weight: 100;\n}",
      "",
    ]),
      (e.exports = n);
  },
  ,
  function (e, n, t) {
    "use strict";
    t.r(n),
      (n.default =
        t.p + "assets/Lato-Regular.3b9b99039cc0a98dd50c3cbfac57ccb2.ttf");
  },
]);

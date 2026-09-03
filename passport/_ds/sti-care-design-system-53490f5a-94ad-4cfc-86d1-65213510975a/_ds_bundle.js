/* @ds-bundle: {"format":3,"namespace":"StiCareDesignSystem_53490f","components":[{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"ListRow","sourcePath":"components/navigation/ListRow.jsx"},{"name":"SegmentedControl","sourcePath":"components/navigation/SegmentedControl.jsx"},{"name":"StatusPill","sourcePath":"components/status/StatusPill.jsx"}],"sourceHashes":{"components/core/Avatar.jsx":"26340214a88d","components/core/Badge.jsx":"76394271258b","components/core/Button.jsx":"31f38cc8e7fe","components/core/Card.jsx":"b526eafd7db4","components/core/IconButton.jsx":"08ef0507d8ad","components/forms/Input.jsx":"85c328bfe952","components/forms/Switch.jsx":"456b77f7a975","components/navigation/ListRow.jsx":"86c542451a1c","components/navigation/SegmentedControl.jsx":"8773868a6833","components/status/StatusPill.jsx":"74cc59bf2e6c","ui_kits/mobile_app/AddResult.jsx":"c7612cd12e33","ui_kits/mobile_app/Care.jsx":"8876e0a53891","ui_kits/mobile_app/Nudge.jsx":"62e8b644f83d","ui_kits/mobile_app/Passport.jsx":"0678cfb49697","ui_kits/mobile_app/Results.jsx":"976e8116e6aa","ui_kits/mobile_app/ShareSheet.jsx":"1e63b102a3ec","ui_kits/mobile_app/app.jsx":"553420fb8f75","ui_kits/mobile_app/icons.jsx":"7437b694f999"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.StiCareDesignSystem_53490f = window.StiCareDesignSystem_53490f || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Avatar — initials or photo in a soft circle. */
function Avatar({
  name = "",
  src,
  size = "md",
  className = "",
  ...rest
}) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
  const classes = ["sti-avatar", `sti-avatar--${size}`, className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("span", _extends({
    className: classes
  }, rest), src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name
  }) : /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true"
  }, initials || "?"));
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Badge — a small non-status label or count. */
function Badge({
  variant = "default",
  className = "",
  children,
  ...rest
}) {
  const classes = ["sti-badge", variant !== "default" ? `sti-badge--${variant}` : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("span", _extends({
    className: classes
  }, rest), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Button — the primary action control. Calm, rounded, confident.
 * Variants: primary | secondary | ghost | danger | quiet. Sizes: sm | md | lg.
 */
function Button({
  variant = "primary",
  size = "md",
  block = false,
  iconLeft,
  iconRight,
  disabled = false,
  as,
  className = "",
  children,
  ...rest
}) {
  const Tag = as || "button";
  const classes = ["sti-btn", `sti-btn--${variant}`, `sti-btn--${size}`, block ? "sti-btn--block" : "", className].filter(Boolean).join(" ");
  const extra = Tag === "button" ? {
    disabled
  } : {
    "aria-disabled": disabled || undefined
  };
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: classes
  }, extra, rest), iconLeft && /*#__PURE__*/React.createElement("span", {
    className: "sti-btn__icon",
    "aria-hidden": "true"
  }, iconLeft), children, iconRight && /*#__PURE__*/React.createElement("span", {
    className: "sti-btn__icon",
    "aria-hidden": "true"
  }, iconRight));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Card — the soft white surface that holds nearly everything. Rounded, gently
 * shadowed, never harshly outlined.
 */
function Card({
  variant = "default",
  pad = "md",
  interactive = false,
  className = "",
  children,
  ...rest
}) {
  const classes = ["sti-card", variant !== "default" ? `sti-card--${variant}` : "", pad === "sm" ? "sti-card--pad-sm" : pad === "lg" ? "sti-card--pad-lg" : "", interactive ? "sti-card--interactive" : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", _extends({
    className: classes
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * IconButton — a square, touch-sized control wrapping a single icon.
 * Variants: plain | filled | accent.
 */
function IconButton({
  variant = "plain",
  label,
  className = "",
  children,
  ...rest
}) {
  const classes = ["sti-iconbtn", `sti-iconbtn--${variant}`, className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    className: classes,
    "aria-label": label
  }, rest), children);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Input — labelled text field with optional hint and error. */
function Input({
  label,
  hint,
  error,
  multiline = false,
  id,
  className = "",
  ...rest
}) {
  const fieldId = id || (label ? `f-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  const Tag = multiline ? "textarea" : "input";
  const inputClasses = ["sti-input", error ? "sti-input--error" : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", {
    className: "sti-field"
  }, label && /*#__PURE__*/React.createElement("label", {
    className: "sti-field__label",
    htmlFor: fieldId
  }, label), /*#__PURE__*/React.createElement(Tag, _extends({
    id: fieldId,
    className: inputClasses,
    "aria-invalid": !!error || undefined
  }, rest)), error ? /*#__PURE__*/React.createElement("span", {
    className: "sti-field__error"
  }, error) : hint ? /*#__PURE__*/React.createElement("span", {
    className: "sti-field__hint"
  }, hint) : null);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Switch — a calm on/off toggle. */
function Switch({
  checked = false,
  onChange,
  label,
  disabled = false,
  className = "",
  ...rest
}) {
  const classes = ["sti-switch", checked ? "sti-switch--on" : "", disabled ? "sti-switch--disabled" : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("label", {
    className: classes
  }, /*#__PURE__*/React.createElement("span", {
    className: "sti-switch__track"
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox",
    checked: checked,
    disabled: disabled,
    onChange: e => onChange && onChange(e.target.checked, e)
  }, rest)), /*#__PURE__*/React.createElement("span", {
    className: "sti-switch__thumb",
    "aria-hidden": "true"
  })), label && /*#__PURE__*/React.createElement("span", {
    className: "sti-switch__label"
  }, label));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/navigation/ListRow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** ListRow — a settings / navigation row with lead icon, text, and trailing slot. */
function ListRow({
  lead,
  title,
  sub,
  trail,
  as,
  className = "",
  ...rest
}) {
  const Tag = as || (rest.onClick ? "button" : "div");
  const interactive = Tag !== "div" || !!rest.onClick;
  const classes = ["sti-row", interactive ? "" : "sti-row--static", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: classes
  }, rest), lead && /*#__PURE__*/React.createElement("span", {
    className: "sti-row__lead",
    "aria-hidden": "true"
  }, lead), /*#__PURE__*/React.createElement("span", {
    className: "sti-row__body"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sti-row__title"
  }, title), sub && /*#__PURE__*/React.createElement("span", {
    className: "sti-row__sub"
  }, sub)), trail && /*#__PURE__*/React.createElement("span", {
    className: "sti-row__trail"
  }, trail));
}
Object.assign(__ds_scope, { ListRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/ListRow.jsx", error: String((e && e.message) || e) }); }

// components/navigation/SegmentedControl.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** SegmentedControl — a pill-shaped switch between 2–4 short options. */
function SegmentedControl({
  options = [],
  value,
  onChange,
  className = "",
  ...rest
}) {
  const classes = ["sti-segmented", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", _extends({
    className: classes,
    role: "tablist"
  }, rest), options.map(opt => {
    const val = typeof opt === "string" ? opt : opt.value;
    const lbl = typeof opt === "string" ? opt : opt.label;
    const active = val === value;
    return /*#__PURE__*/React.createElement("button", {
      key: val,
      type: "button",
      role: "tab",
      "aria-selected": active,
      className: `sti-segmented__item${active ? " sti-segmented__item--active" : ""}`,
      onClick: () => onChange && onChange(val)
    }, lbl);
  }));
}
Object.assign(__ds_scope, { SegmentedControl });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/SegmentedControl.jsx", error: String((e && e.message) || e) }); }

// components/status/StatusPill.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Self-contained status icons — each a distinct shape so status is legible in
   grayscale and for color-blind users, never by color alone. */
const ICONS = {
  clear: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "9.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m8 12 2.5 2.5L16 9"
  })),
  treat: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "9.5"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "12 7 12 12 15.5 14"
  })),
  expired: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "9.5"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "7.5",
    x2: "12",
    y2: "12.5"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "16",
    x2: "12.01",
    y2: "16"
  })),
  none: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "9.5"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "12",
    x2: "16",
    y2: "12"
  }))
};
const LABELS = {
  clear: "Clear",
  treat: "In treatment",
  expired: "Out of date",
  none: "No status"
};

/**
 * StatusPill — the heart of the privacy-first passport. Shows ONLY a
 * traffic-light status, always as color + icon + word. Never the details.
 */
function StatusPill({
  status = "none",
  label,
  size = "md",
  solid = false,
  className = "",
  ...rest
}) {
  const classes = ["sti-pill", `sti-pill--${status}`, solid ? "sti-pill--solid" : "", size === "lg" ? "sti-pill--lg" : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("span", _extends({
    className: classes,
    role: "status"
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "sti-pill__icon",
    "aria-hidden": "true"
  }, ICONS[status]), /*#__PURE__*/React.createElement("span", null, label || LABELS[status]));
}
Object.assign(__ds_scope, { StatusPill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/status/StatusPill.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile_app/AddResult.jsx
try { (() => {
/* AddResult — self-report a test result. */
(function () {
  const I = window.StiIcons;
  const TESTS = ["Full screen panel", "HIV", "Chlamydia & gonorrhoea", "Syphilis", "Herpes", "Hepatitis B"];
  function Chip({
    active,
    onClick,
    children
  }) {
    return /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: onClick,
      style: {
        appearance: "none",
        cursor: "pointer",
        font: "inherit",
        fontSize: 14,
        fontWeight: 600,
        padding: "9px 14px",
        borderRadius: "var(--radius-pill)",
        border: "1px solid " + (active ? "var(--accent)" : "var(--border-card)"),
        background: active ? "var(--accent-soft)" : "var(--surface-card)",
        color: active ? "var(--text-accent)" : "var(--text-body)",
        transition: "all var(--dur-fast) var(--ease-gentle)"
      }
    }, children);
  }
  function ResultOption({
    status,
    title,
    sub,
    active,
    onClick
  }) {
    const {
      StatusPill
    } = window.StiCareDesignSystem_53490f;
    return /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: onClick,
      style: {
        appearance: "none",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 14,
        borderRadius: "var(--radius-md)",
        border: "1.5px solid " + (active ? "var(--accent)" : "var(--border-card)"),
        background: active ? "var(--surface-tint)" : "var(--surface-card)",
        transition: "all var(--dur-fast) var(--ease-gentle)"
      }
    }, /*#__PURE__*/React.createElement(StatusPill, {
      status: status
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, title), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--text-muted)"
      }
    }, sub)), /*#__PURE__*/React.createElement("span", {
      style: {
        width: 22,
        height: 22,
        borderRadius: "50%",
        flex: "none",
        border: "2px solid " + (active ? "var(--accent)" : "var(--border-strong)"),
        background: active ? "var(--accent)" : "transparent",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff"
      }
    }, active && /*#__PURE__*/React.createElement(I.Check, {
      size: 13
    })));
  }
  function AddResult({
    onBack,
    onSave
  }) {
    const {
      Card,
      Button,
      Input,
      Switch
    } = window.StiCareDesignSystem_53490f;
    const [test, setTest] = React.useState("Full screen panel");
    const [result, setResult] = React.useState("clear");
    const [onPassport, setOnPassport] = React.useState(true);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 20
      }
    }, /*#__PURE__*/React.createElement("h1", {
      style: {
        fontSize: 24,
        fontWeight: 800,
        letterSpacing: "-0.02em",
        color: "var(--text-strong)"
      }
    }, "Add a result"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 600,
        color: "var(--text-body)",
        marginBottom: 10
      }
    }, "Which test?"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 8
      }
    }, TESTS.map(t => /*#__PURE__*/React.createElement(Chip, {
      key: t,
      active: test === t,
      onClick: () => setTest(t)
    }, t)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 600,
        color: "var(--text-body)",
        marginBottom: 10
      }
    }, "Result"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement(ResultOption, {
      status: "clear",
      title: "Negative",
      sub: "No infection detected",
      active: result === "clear",
      onClick: () => setResult("clear")
    }), /*#__PURE__*/React.createElement(ResultOption, {
      status: "treat",
      title: "Positive \u2014 starting treatment",
      sub: "We\u2019ll guide you through care",
      active: result === "treat",
      onClick: () => setResult("treat")
    }))), /*#__PURE__*/React.createElement(Input, {
      label: "Date tested",
      defaultValue: "9 Mar 2026"
    }), /*#__PURE__*/React.createElement(Input, {
      label: "Clinic or provider (optional)",
      placeholder: "e.g. Dean Street Express"
    }), /*#__PURE__*/React.createElement(Card, {
      variant: "flat",
      style: {
        display: "flex",
        alignItems: "center",
        gap: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, "Show on my passport"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--text-muted)"
      }
    }, "Updates your shareable status only")), /*#__PURE__*/React.createElement(Switch, {
      checked: onPassport,
      onChange: setOnPassport
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "quiet",
      size: "lg",
      onClick: onBack
    }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      size: "lg",
      block: true,
      onClick: onSave
    }, "Save result")));
  }
  window.StiScreens = Object.assign(window.StiScreens || {}, {
    AddResult
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile_app/AddResult.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile_app/Care.jsx
try { (() => {
/* Care — guidance to testing & treatment, and the entry to the partner nudge. */
(function () {
  const I = window.StiIcons;
  function Care({
    onNudge,
    onFindTesting
  }) {
    const {
      Card,
      Button,
      ListRow
    } = window.StiCareDesignSystem_53490f;
    const Chevron = /*#__PURE__*/React.createElement(I.Chevron, {
      size: 18
    });
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 16
      }
    }, /*#__PURE__*/React.createElement("h1", {
      style: {
        fontSize: 26,
        fontWeight: 800,
        letterSpacing: "-0.02em",
        color: "var(--text-strong)"
      }
    }, "Care"), /*#__PURE__*/React.createElement(Card, {
      style: {
        borderRadius: "var(--radius-lg)",
        padding: 20,
        background: "var(--accent)",
        boxShadow: "var(--shadow-md), var(--shadow-accent)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        color: "#fff",
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement(I.MapPin, {
      size: 20
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        opacity: 0.9
      }
    }, "Get tested")), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 19,
        fontWeight: 700,
        color: "#fff",
        lineHeight: 1.3,
        marginBottom: 14
      }
    }, "Free and low-cost testing near you \u2014 many take walk-ins."), /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      onClick: onFindTesting,
      style: {
        background: "#fff",
        borderColor: "transparent"
      }
    }, "Find a clinic")), /*#__PURE__*/React.createElement(Card, {
      variant: "flat",
      style: {
        padding: 0,
        overflow: "hidden"
      }
    }, /*#__PURE__*/React.createElement(ListRow, {
      lead: /*#__PURE__*/React.createElement(I.Users, {
        size: 20
      }),
      title: "Let partners know",
      sub: "Anonymously suggest recent partners get checked",
      trail: Chevron,
      onClick: onNudge
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--text-subtle)",
        marginTop: 4
      }
    }, "Learn & talk"), /*#__PURE__*/React.createElement(Card, {
      variant: "flat",
      style: {
        padding: 6,
        display: "flex",
        flexDirection: "column"
      }
    }, /*#__PURE__*/React.createElement(ListRow, {
      lead: /*#__PURE__*/React.createElement(I.Shield, {
        size: 20
      }),
      title: "How your passport works",
      sub: "What\u2019s shared, what stays private",
      trail: Chevron,
      onClick: () => {}
    }), /*#__PURE__*/React.createElement(ListRow, {
      lead: /*#__PURE__*/React.createElement(I.Heart, {
        size: 20
      }),
      title: "Treatment, simply explained",
      sub: "What to expect, step by step",
      trail: Chevron,
      onClick: () => {}
    }), /*#__PURE__*/React.createElement(ListRow, {
      lead: /*#__PURE__*/React.createElement(I.Info, {
        size: 20
      }),
      title: "Talk to someone",
      sub: "Free, confidential support lines",
      trail: Chevron,
      onClick: () => {}
    })));
  }
  window.StiScreens = Object.assign(window.StiScreens || {}, {
    Care
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile_app/Care.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile_app/Nudge.jsx
try { (() => {
/* Nudge — the anonymous partner notification flow. Care, never accusation. */
(function () {
  const I = window.StiIcons;
  function Step({
    icon,
    title,
    children
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: "var(--radius-pill)",
        background: "var(--accent-soft)",
        color: "var(--text-accent)",
        flex: "none"
      }
    }, icon), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, title), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13.5,
        color: "var(--text-muted)",
        lineHeight: 1.45
      }
    }, children)));
  }
  function PartnerChip({
    name
  }) {
    const {
      Avatar
    } = window.StiCareDesignSystem_53490f;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 12px 5px 5px",
        borderRadius: "var(--radius-pill)",
        background: "var(--surface-card)",
        boxShadow: "var(--shadow-sm)"
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      name: name,
      size: "sm"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13.5,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, name));
  }
  function Nudge({
    onBack,
    onSent
  }) {
    const {
      Card,
      Button,
      Switch,
      Input
    } = window.StiCareDesignSystem_53490f;
    const [withMsg, setWithMsg] = React.useState(false);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 18
      }
    }, /*#__PURE__*/React.createElement("h1", {
      style: {
        fontSize: 24,
        fontWeight: 800,
        letterSpacing: "-0.02em",
        color: "var(--text-strong)",
        lineHeight: 1.2
      }
    }, "Let recent partners know \u2014 anonymously"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 15,
        lineHeight: 1.55,
        color: "var(--text-body)",
        margin: 0
      }
    }, "A positive result is nothing to be ashamed of. You can quietly suggest people you\u2019ve been close with get checked \u2014 your name is never shared."), /*#__PURE__*/React.createElement(Card, {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 16
      }
    }, /*#__PURE__*/React.createElement(Step, {
      icon: /*#__PURE__*/React.createElement(I.Lock, {
        size: 18
      }),
      title: "You stay anonymous"
    }, "They\u2019ll never see your name, handle, or which infection."), /*#__PURE__*/React.createElement(Step, {
      icon: /*#__PURE__*/React.createElement(I.Bell, {
        size: 18
      }),
      title: "They get a gentle prompt"
    }, "\u201CSomeone suggested getting tested. No name, no details.\u201D"), /*#__PURE__*/React.createElement(Step, {
      icon: /*#__PURE__*/React.createElement(I.Heart, {
        size: 18
      }),
      title: "They\u2019re guided to care"
    }, "Straight to free testing near them.")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 600,
        color: "var(--text-body)",
        marginBottom: 10
      }
    }, "Recent partners to notify"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement(PartnerChip, {
      name: "J K"
    }), /*#__PURE__*/React.createElement(PartnerChip, {
      name: "Alex"
    }), /*#__PURE__*/React.createElement("button", {
      type: "button",
      style: {
        appearance: "none",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 14px",
        borderRadius: "var(--radius-pill)",
        border: "1px dashed var(--border-strong)",
        background: "transparent",
        color: "var(--text-accent)",
        fontSize: 13.5,
        fontWeight: 600
      }
    }, /*#__PURE__*/React.createElement(I.Plus, {
      size: 15
    }), " Add")), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        color: "var(--text-subtle)",
        display: "flex",
        alignItems: "center",
        gap: 6
      }
    }, /*#__PURE__*/React.createElement(I.Info, {
      size: 14
    }), " Contacts are matched privately and never stored against your name.")), /*#__PURE__*/React.createElement(Card, {
      variant: "flat",
      style: {
        display: "flex",
        alignItems: "center",
        gap: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, "Add a short message"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--text-muted)"
      }
    }, "Optional \xB7 still anonymous")), /*#__PURE__*/React.createElement(Switch, {
      checked: withMsg,
      onChange: setWithMsg
    })), withMsg && /*#__PURE__*/React.createElement(Input, {
      multiline: true,
      placeholder: "e.g. No pressure \u2014 just thought you\u2019d want to know. Take care.",
      defaultValue: ""
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "quiet",
      size: "lg",
      onClick: onBack
    }, "Back"), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      size: "lg",
      block: true,
      iconLeft: /*#__PURE__*/React.createElement(I.Bell, {
        size: 18
      }),
      onClick: onSent
    }, "Send nudge")));
  }
  function NudgeSent({
    onDone
  }) {
    const {
      Button
    } = window.StiCareDesignSystem_53490f;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 18,
        paddingTop: 40
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 76,
        height: 76,
        borderRadius: "var(--radius-pill)",
        background: "var(--status-clear-bg)",
        color: "var(--status-clear-base)"
      }
    }, /*#__PURE__*/React.createElement(I.Check, {
      size: 38
    })), /*#__PURE__*/React.createElement("h1", {
      style: {
        fontSize: 24,
        fontWeight: 800,
        letterSpacing: "-0.02em",
        color: "var(--text-strong)",
        whiteSpace: "nowrap"
      }
    }, "Nudge sent"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 15,
        lineHeight: 1.55,
        color: "var(--text-body)",
        margin: 0,
        maxWidth: 300
      }
    }, "Two people were notified anonymously. You did a kind thing \u2014 now let\u2019s look after you."), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      size: "lg",
      block: true,
      onClick: onDone
    }, "Continue my care"));
  }
  window.StiScreens = Object.assign(window.StiScreens || {}, {
    Nudge,
    NudgeSent
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile_app/Nudge.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile_app/Passport.jsx
try { (() => {
/* Passport — the home screen. The privacy-first card a person shares. */
(function () {
  const I = window.StiIcons;
  function MetaRow({
    icon,
    children
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        color: "var(--text-muted)",
        fontSize: 14,
        whiteSpace: "nowrap"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        color: "var(--text-subtle)",
        flex: "none"
      }
    }, icon), children);
  }
  function Passport({
    onShare,
    onReminder
  }) {
    const {
      Card,
      Button,
      Avatar,
      StatusPill
    } = window.StiCareDesignSystem_53490f;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 18
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 4
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        color: "var(--text-muted)"
      }
    }, "Good to see you,"), /*#__PURE__*/React.createElement("h1", {
      style: {
        fontSize: 26,
        fontWeight: 800,
        letterSpacing: "-0.02em",
        color: "var(--text-strong)"
      }
    }, "Robin")), /*#__PURE__*/React.createElement(Card, {
      style: {
        borderRadius: "var(--radius-xl)",
        boxShadow: "var(--shadow-md), var(--shadow-accent)",
        padding: 22
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 18
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--text-subtle)"
      }
    }, "Your passport"), /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        color: "var(--text-accent)",
        fontSize: 12,
        fontWeight: 600
      }
    }, /*#__PURE__*/React.createElement(I.Lock, {
      size: 14
    }), " Private")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 14,
        marginBottom: 18
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      name: "Robin Vale",
      size: "lg"
    }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 19,
        fontWeight: 700,
        color: "var(--text-strong)"
      }
    }, "Robin Vale"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--text-muted)"
      }
    }, "@robin \xB7 they/them"))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "center",
        margin: "6px 0 18px"
      }
    }, /*#__PURE__*/React.createElement(StatusPill, {
      status: "clear",
      size: "lg",
      solid: true
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 8,
        paddingTop: 16,
        borderTop: "1px solid var(--divider)"
      }
    }, /*#__PURE__*/React.createElement(MetaRow, {
      icon: /*#__PURE__*/React.createElement(I.Calendar, {
        size: 16
      })
    }, "Valid through 12 Jun 2026"), /*#__PURE__*/React.createElement(MetaRow, {
      icon: /*#__PURE__*/React.createElement(I.Clock, {
        size: 16
      })
    }, "Updated 3 days ago"))), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      size: "lg",
      block: true,
      iconLeft: /*#__PURE__*/React.createElement(I.Share, {
        size: 18
      }),
      onClick: onShare
    }, "Share my passport"), /*#__PURE__*/React.createElement(Card, {
      variant: "tint",
      pad: "md",
      style: {
        display: "flex",
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--text-accent)",
        flex: "none",
        marginTop: 2
      }
    }, /*#__PURE__*/React.createElement(I.Eye, {
      size: 20
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        lineHeight: 1.5,
        color: "var(--text-body)"
      }
    }, "Sharing shows only your ", /*#__PURE__*/React.createElement("strong", {
      style: {
        color: "var(--text-strong)"
      }
    }, "status"), " \u2014 never which test, your results, or any dates.")), /*#__PURE__*/React.createElement(Card, {
      variant: "flat",
      style: {
        display: "flex",
        alignItems: "center",
        gap: 14
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 40,
        height: 40,
        borderRadius: "var(--radius-sm)",
        background: "var(--accent-soft)",
        color: "var(--text-accent)",
        flex: "none"
      }
    }, /*#__PURE__*/React.createElement(I.Bell, {
      size: 20
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, "Next test due in 2 weeks"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--text-muted)"
      }
    }, "Stay in date to keep a clear status")), /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      size: "sm",
      onClick: onReminder
    }, "Remind me")));
  }
  window.StiScreens = Object.assign(window.StiScreens || {}, {
    Passport
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile_app/Passport.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile_app/Results.jsx
try { (() => {
/* Results — the owner's private list of test results (only they see detail). */
(function () {
  const I = window.StiIcons;
  const RECENT = [{
    name: "Full screen panel",
    date: "9 Mar 2026",
    status: "clear",
    note: "HIV · chlamydia · gonorrhoea · syphilis"
  }, {
    name: "HIV",
    date: "9 Mar 2026",
    status: "clear",
    note: "Negative · in date"
  }, {
    name: "Chlamydia & gonorrhoea",
    date: "9 Mar 2026",
    status: "clear",
    note: "Negative · in date"
  }];
  const HISTORY = [{
    name: "Syphilis",
    date: "12 Dec 2025",
    status: "treat",
    note: "Treated · course completed Jan 2026"
  }, {
    name: "Full screen panel",
    date: "2 Sep 2025",
    status: "clear",
    note: "All negative"
  }, {
    name: "HIV",
    date: "2 Sep 2025",
    status: "clear",
    note: "Negative"
  }];
  function ResultRow({
    r
  }) {
    const {
      Card,
      StatusPill
    } = window.StiCareDesignSystem_53490f;
    return /*#__PURE__*/React.createElement(Card, {
      pad: "sm",
      interactive: true,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15,
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, r.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--text-muted)",
        marginTop: 2
      }
    }, "Tested ", r.date, " \xB7 ", r.note)), /*#__PURE__*/React.createElement(StatusPill, {
      status: r.status
    }));
  }
  function Results() {
    const {
      Card,
      SegmentedControl,
      Badge
    } = window.StiCareDesignSystem_53490f;
    const [tab, setTab] = React.useState("Recent");
    const list = tab === "Recent" ? RECENT : HISTORY;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between"
      }
    }, /*#__PURE__*/React.createElement("h1", {
      style: {
        fontSize: 26,
        fontWeight: 800,
        letterSpacing: "-0.02em",
        color: "var(--text-strong)"
      }
    }, "Results"), /*#__PURE__*/React.createElement(Badge, {
      variant: "accent"
    }, /*#__PURE__*/React.createElement(I.Lock, {
      size: 12
    }), " Only you")), /*#__PURE__*/React.createElement(SegmentedControl, {
      options: ["Recent", "History"],
      value: tab,
      onChange: setTab
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 10
      }
    }, list.map((r, i) => /*#__PURE__*/React.createElement(ResultRow, {
      key: i,
      r: r
    }))), /*#__PURE__*/React.createElement(Card, {
      variant: "tint",
      pad: "md",
      style: {
        display: "flex",
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--text-accent)",
        flex: "none",
        marginTop: 1
      }
    }, /*#__PURE__*/React.createElement(I.Info, {
      size: 18
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13.5,
        lineHeight: 1.5,
        color: "var(--text-body)"
      }
    }, "These details stay on your device and in your private account. Partners only ever see your overall status.")));
  }
  window.StiScreens = Object.assign(window.StiScreens || {}, {
    Results
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile_app/Results.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile_app/ShareSheet.jsx
try { (() => {
/* ShareSheet — the public passport view. Only the status, nothing else. */
(function () {
  const I = window.StiIcons;

  /* Decorative QR-style placeholder (not a real code) */
  function QRish() {
    const cells = [];
    const seed = ["1110111", "1000101", "1011101", "1011101", "1000001", "1110111", "0000000", "1101011", "0110010", "1011011", "0100110", "1101001", "0011100", "1010101"];
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: 3,
        width: 120,
        height: 120,
        padding: 10,
        background: "#fff",
        borderRadius: 12,
        boxShadow: "var(--shadow-sm)"
      }
    }, seed.flatMap((row, r) => row.split("").map((c, i) => /*#__PURE__*/React.createElement("span", {
      key: r + "-" + i,
      style: {
        background: c === "1" ? "var(--ink-900)" : "transparent",
        borderRadius: 2,
        aspectRatio: "1"
      }
    }))));
  }
  function ShareSheet({
    open,
    onClose
  }) {
    const {
      Button,
      Avatar,
      StatusPill
    } = window.StiCareDesignSystem_53490f;
    return /*#__PURE__*/React.createElement("div", {
      "aria-hidden": !open,
      style: {
        position: "absolute",
        inset: 0,
        zIndex: 30,
        pointerEvents: open ? "auto" : "none"
      }
    }, /*#__PURE__*/React.createElement("div", {
      onClick: onClose,
      style: {
        position: "absolute",
        inset: 0,
        background: "rgba(27,27,47,0.42)",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
        opacity: open ? 1 : 0,
        transition: "opacity var(--dur-base) var(--ease-gentle)"
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        background: "var(--surface-app)",
        borderTopLeftRadius: "var(--radius-xl)",
        borderTopRightRadius: "var(--radius-xl)",
        padding: "14px 20px 24px",
        boxShadow: "var(--shadow-xl)",
        transform: open ? "translateY(0)" : "translateY(100%)",
        transition: "transform var(--dur-slow) var(--ease-out)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 40,
        height: 4,
        borderRadius: 999,
        background: "var(--ink-200)",
        margin: "0 auto 16px"
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 18,
        fontWeight: 700,
        color: "var(--text-strong)"
      }
    }, "Share your passport"), /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: onClose,
      "aria-label": "Close",
      style: {
        appearance: "none",
        border: "none",
        background: "var(--surface-sunken)",
        width: 32,
        height: 32,
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        color: "var(--text-muted)"
      }
    }, /*#__PURE__*/React.createElement(I.X, {
      size: 16
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        background: "#fff",
        borderRadius: "var(--radius-lg)",
        padding: 22,
        boxShadow: "var(--shadow-md)",
        textAlign: "center",
        position: "relative"
      }
    }, /*#__PURE__*/React.createElement("img", {
      src: "../../assets/logo/logo-wordmark.svg",
      alt: "sti.care",
      style: {
        height: 26,
        marginBottom: 18
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      name: "Robin Vale",
      size: "lg"
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 17,
        fontWeight: 700,
        color: "var(--text-strong)"
      }
    }, "Robin Vale"), /*#__PURE__*/React.createElement(StatusPill, {
      status: "clear",
      size: "lg",
      solid: true
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--text-muted)",
        display: "inline-flex",
        alignItems: "center",
        gap: 6
      }
    }, /*#__PURE__*/React.createElement(I.Shield, {
      size: 14
    }), " Verified \xB7 valid through 12 Jun 2026"), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 6
      }
    }, /*#__PURE__*/React.createElement(QRish, null)))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        justifyContent: "center",
        margin: "14px 0 16px",
        color: "var(--text-subtle)",
        fontSize: 12.5
      }
    }, /*#__PURE__*/React.createElement(I.Eye, {
      size: 14
    }), " This is everything they see \u2014 no test names, no dates."), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      size: "lg",
      block: true,
      iconLeft: /*#__PURE__*/React.createElement(I.Share, {
        size: 18
      })
    }, "Share link"), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      size: "lg",
      block: true
    }, "Show QR"))));
  }
  window.StiScreens = Object.assign(window.StiScreens || {}, {
    ShareSheet
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile_app/ShareSheet.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile_app/app.jsx
try { (() => {
/* App — phone shell, tab bar, and navigation wiring for the sti.care kit. */
(function () {
  const S = window.StiScreens;
  const I = window.StiIcons;
  const TABS = [{
    id: "passport",
    label: "Passport",
    icon: I.Passport
  }, {
    id: "results",
    label: "Results",
    icon: I.Results
  }, {
    id: "care",
    label: "Care",
    icon: I.Care
  }];
  function TabBar({
    tab,
    setTab
  }) {
    return /*#__PURE__*/React.createElement("nav", {
      style: {
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        padding: "8px 8px 6px",
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderTop: "1px solid var(--divider)",
        flex: "none"
      }
    }, TABS.map(t => {
      const active = tab === t.id;
      const Icon = t.icon;
      return /*#__PURE__*/React.createElement("button", {
        key: t.id,
        type: "button",
        onClick: () => setTab(t.id),
        style: {
          appearance: "none",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          padding: "6px 14px",
          color: active ? "var(--text-accent)" : "var(--text-subtle)",
          transition: "color var(--dur-fast) var(--ease-gentle)"
        }
      }, /*#__PURE__*/React.createElement(Icon, {
        size: 24,
        strokeWidth: active ? 2.4 : 2
      }), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 11,
          fontWeight: active ? 700 : 500
        }
      }, t.label));
    }));
  }
  function StatusBar() {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 24px 2px",
        fontSize: 14,
        fontWeight: 600,
        color: "var(--text-strong)",
        flex: "none"
      }
    }, /*#__PURE__*/React.createElement("span", null, "9:41"), /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        gap: 6,
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("svg", {
      width: "18",
      height: "12",
      viewBox: "0 0 18 12",
      fill: "currentColor"
    }, /*#__PURE__*/React.createElement("rect", {
      x: "0",
      y: "7",
      width: "3",
      height: "5",
      rx: "1"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "5",
      y: "4",
      width: "3",
      height: "8",
      rx: "1"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "10",
      y: "1.5",
      width: "3",
      height: "10.5",
      rx: "1"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "15",
      y: "0",
      width: "3",
      height: "12",
      rx: "1",
      opacity: "0.35"
    })), /*#__PURE__*/React.createElement("svg", {
      width: "22",
      height: "12",
      viewBox: "0 0 22 12",
      fill: "none"
    }, /*#__PURE__*/React.createElement("rect", {
      x: "1",
      y: "1",
      width: "18",
      height: "10",
      rx: "3",
      stroke: "currentColor",
      strokeWidth: "1.2",
      opacity: "0.5"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "2.5",
      y: "2.5",
      width: "13",
      height: "7",
      rx: "1.5",
      fill: "currentColor"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "20",
      y: "4",
      width: "1.6",
      height: "4",
      rx: "0.8",
      fill: "currentColor",
      opacity: "0.5"
    }))));
  }
  function TopBar({
    onAdd
  }) {
    const {
      IconButton
    } = window.StiCareDesignSystem_53490f;
    return /*#__PURE__*/React.createElement("header", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 16px 10px",
        flex: "none"
      }
    }, /*#__PURE__*/React.createElement("img", {
      src: "../../assets/logo/logo-wordmark.svg",
      alt: "sti.care",
      style: {
        height: 30
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 2
      }
    }, /*#__PURE__*/React.createElement(IconButton, {
      label: "Add a result",
      variant: "accent",
      onClick: onAdd
    }, /*#__PURE__*/React.createElement(I.Plus, {
      size: 20
    })), /*#__PURE__*/React.createElement(IconButton, {
      label: "Notifications"
    }, /*#__PURE__*/React.createElement(I.Bell, {
      size: 20
    }))));
  }
  function App() {
    const {
      IconButton
    } = window.StiCareDesignSystem_53490f;
    const [tab, setTab] = React.useState("passport");
    const [overlay, setOverlay] = React.useState(null); // null | add | nudge | nudgeSent
    const [share, setShare] = React.useState(false);
    const scroller = React.useRef(null);
    React.useEffect(() => {
      if (scroller.current) scroller.current.scrollTop = 0;
    }, [tab, overlay]);
    let screen;
    if (overlay === "add") {
      screen = /*#__PURE__*/React.createElement(S.AddResult, {
        onBack: () => setOverlay(null),
        onSave: () => {
          setOverlay(null);
          setTab("results");
        }
      });
    } else if (overlay === "nudge") {
      screen = /*#__PURE__*/React.createElement(S.Nudge, {
        onBack: () => setOverlay(null),
        onSent: () => setOverlay("nudgeSent")
      });
    } else if (overlay === "nudgeSent") {
      screen = /*#__PURE__*/React.createElement(S.NudgeSent, {
        onDone: () => {
          setOverlay(null);
          setTab("passport");
        }
      });
    } else if (tab === "passport") {
      screen = /*#__PURE__*/React.createElement(S.Passport, {
        onShare: () => setShare(true),
        onReminder: () => {}
      });
    } else if (tab === "results") {
      screen = /*#__PURE__*/React.createElement(S.Results, null);
    } else {
      screen = /*#__PURE__*/React.createElement(S.Care, {
        onNudge: () => setOverlay("nudge"),
        onFindTesting: () => {}
      });
    }
    const showChrome = overlay === null;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        width: 402,
        height: 858,
        position: "relative",
        background: "var(--surface-app)",
        borderRadius: 46,
        overflow: "hidden",
        boxShadow: "0 50px 100px -20px rgba(27,27,47,0.45), 0 0 0 11px #11131c, 0 0 0 12px #2a2d3a",
        display: "flex",
        flexDirection: "column"
      }
    }, /*#__PURE__*/React.createElement(StatusBar, null), overlay === null ? /*#__PURE__*/React.createElement(TopBar, {
      onAdd: () => setOverlay("add")
    }) : /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        padding: "6px 12px 8px",
        flex: "none"
      }
    }, /*#__PURE__*/React.createElement(IconButton, {
      label: "Back",
      onClick: () => setOverlay(overlay === "nudgeSent" ? null : null)
    }, /*#__PURE__*/React.createElement(I.Back, {
      size: 22
    }))), /*#__PURE__*/React.createElement("main", {
      ref: scroller,
      style: {
        flex: 1,
        overflowY: "auto",
        padding: "6px 20px 28px"
      }
    }, screen), showChrome && /*#__PURE__*/React.createElement(TabBar, {
      tab: tab,
      setTab: setTab
    }), /*#__PURE__*/React.createElement(S.ShareSheet, {
      open: share,
      onClose: () => setShare(false)
    }));
  }
  window.StiApp = App;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile_app/app.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile_app/icons.jsx
try { (() => {
/* Shared Lucide-style icon set (2px round stroke) for the sti.care UI kit.
   Exported on window for the other babel scripts. */
(function () {
  const S = (paths, extra = {}) => props => React.createElement("svg", Object.assign({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    width: props && props.size ? props.size : 24,
    height: props && props.size ? props.size : 24
  }, props || {}), paths.map((d, i) => typeof d === "string" ? React.createElement("path", {
    key: i,
    d
  }) : React.createElement(d.t, Object.assign({
    key: i
  }, d.p))));
  const Icons = {
    Passport: S([{
      t: "rect",
      p: {
        x: 4,
        y: 3,
        width: 16,
        height: 18,
        rx: 3
      }
    }, {
      t: "circle",
      p: {
        cx: 12,
        cy: 10,
        r: 2.4
      }
    }, "M8.5 16.5a3.5 3.5 0 0 1 7 0"]),
    Results: S([{
      t: "rect",
      p: {
        x: 4,
        y: 4,
        width: 16,
        height: 16,
        rx: 3
      }
    }, "M8 9h8", "M8 13h8", "M8 17h5"]),
    Care: S(["M19 14c1.5-1.5 2.5-3 2.5-5A4.5 4.5 0 0 0 12 6.5 4.5 4.5 0 0 0 2.5 9c0 2 1 3.5 2.5 5l7 7Z", "M3.5 11h4l1.5-3 2 5 1.5-2H17"]),
    Plus: S(["M12 5v14", "M5 12h14"]),
    Share: S([{
      t: "circle",
      p: {
        cx: 18,
        cy: 5,
        r: 3
      }
    }, {
      t: "circle",
      p: {
        cx: 6,
        cy: 12,
        r: 3
      }
    }, {
      t: "circle",
      p: {
        cx: 18,
        cy: 19,
        r: 3
      }
    }, "m8.6 13.5 6.8 4", "m15.4 6.5-6.8 4"]),
    Lock: S([{
      t: "rect",
      p: {
        x: 5,
        y: 11,
        width: 14,
        height: 9,
        rx: 2
      }
    }, "M8 11V8a4 4 0 0 1 8 0v3"]),
    Bell: S(["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"]),
    Chevron: S(["m9 18 6-6-6-6"]),
    Back: S(["m15 18-6-6 6-6"]),
    X: S(["M18 6 6 18", "m6 6 12 12"]),
    Calendar: S([{
      t: "rect",
      p: {
        x: 3,
        y: 5,
        width: 18,
        height: 16,
        rx: 3
      }
    }, "M3 10h18", "M8 3v4", "M16 3v4"]),
    Clock: S([{
      t: "circle",
      p: {
        cx: 12,
        cy: 12,
        r: 9
      }
    }, "M12 8v4l3 2"]),
    Check: S(["M5 12.5 10 17 19 7"]),
    MapPin: S(["M20 10c0 5-8 11-8 11s-8-6-8-11a8 8 0 0 1 16 0Z", {
      t: "circle",
      p: {
        cx: 12,
        cy: 10,
        r: 2.6
      }
    }]),
    Shield: S(["M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z", "m9 12 2 2 4-4"]),
    Users: S(["M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19", {
      t: "circle",
      p: {
        cx: 10,
        cy: 8,
        r: 3.2
      }
    }, "M20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4", "M15 5.2a3.2 3.2 0 0 1 0 5.6"]),
    Heart: S(["M12 20s-7-4.5-7-9.5A3.5 3.5 0 0 1 12 7a3.5 3.5 0 0 1 7 3.5C19 15.5 12 20 12 20Z"]),
    Sparkle: S(["M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4Z"]),
    Info: S([{
      t: "circle",
      p: {
        cx: 12,
        cy: 12,
        r: 9
      }
    }, "M12 11v5", "M12 8h.01"]),
    Eye: S(["M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z", {
      t: "circle",
      p: {
        cx: 12,
        cy: 12,
        r: 3
      }
    }]),
    Dots: S([{
      t: "circle",
      p: {
        cx: 5,
        cy: 12,
        r: 1.4
      }
    }, {
      t: "circle",
      p: {
        cx: 12,
        cy: 12,
        r: 1.4
      }
    }, {
      t: "circle",
      p: {
        cx: 19,
        cy: 12,
        r: 1.4
      }
    }])
  };
  window.StiIcons = Icons;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile_app/icons.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.ListRow = __ds_scope.ListRow;

__ds_ns.SegmentedControl = __ds_scope.SegmentedControl;

__ds_ns.StatusPill = __ds_scope.StatusPill;

})();

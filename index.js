const { textarea, text, div, pre, code } = require("@saltcorn/markup/tags");
const xss = require("xss");
const { getState } = require("@saltcorn/data/db/state");
const cheerio = require("cheerio");

xss.whiteList.kbd = [];
xss.whiteList.table = [
  "width",
  "border",
  "align",
  "valign",
  "class",
  "cellpadding",
  "cellspacing",
  "style",
];

xss.whiteList.span.push("style");
xss.whiteList.p.push("style");

const rmFirstWord = s => s.substring(s.indexOf(" ") + 1);

const searchExtract = (txt, q) => {
  if (!q)
    return txt.substring(0, 150) + '...';
  const searchWords = q.split(' ');
  const wordStarts = searchWords.map(w => [w, txt.indexOf(w)]).filter(([w, ix]) => ix >= 0)
  if (wordStarts.length == 0) return txt.substring(0, 150) + '...';
  const ix = wordStarts[0][1]
  const start = Math.max(0, ix - 100)
  const extract = txt.substring(start, Math.min(ix + 120, txt.length - 1))
  const replace = (t, [w, ...ws]) => w ? replace(t.replaceAll(w, `<b>${w}</b>`), ws) : t
  const replaced = replace(extract, searchWords)
  return (start === 0 ? replaced + "..." : "..." + rmFirstWord(replaced)) + "..."
  //return extract.replaceAll(wordStarts[0][0], `<b>${wordStarts[0][0]}</b>`)
}

const html = {
  name: "HTML",
  sql_name: "text",
  attributes: ({ table }) => {
    const strFields =
      table &&
      table.fields.filter(
        (f) =>
          (f.type || {}).name === "HTML" &&
          !(f.attributes && f.attributes.localizes_field)
      );
    const locales = Object.keys(
      getState().getConfig("localizer_languages", {})
    );
    return [
      ...(table
        ? [
          {
            name: "localizes_field",
            label: "Translation of",
            sublabel:
              "This is a translation of a different field in a different language",
            type: "String",
            attributes: {
              options: strFields.map((f) => f.name),
            },
          },
          {
            name: "locale",
            label: "Locale",
            sublabel: "Language locale of translation",
            input_type: "select",
            options: locales,
            showIf: { localizes_field: strFields.map((f) => f.name) },
          },
        ]
        : []),
    ];
  },
  fieldviews: {
    showAll: {
      isEdit: false,
      run: (v) =>
        xss(v || "")
          .split("<blockquote>")
          .join('<blockquote class="blockquote">'),
    },
    showAsCode: {
      isEdit: false,
      run: (v) =>
        pre(
          code(
            (v || "")
              .replaceAll("&", "&amp;")
              .replaceAll("<", "&lt;")
              .replaceAll(">", "&gt;")
              .replaceAll('"', "&quot;")
              .replaceAll("'", "&#039;")
          )
        ),
    },
    showSearchExtract: {
      isEdit: false,
      run: (v, req) => {
        console.log(req.query);
        const $ = cheerio.load(`<body>${v}</body>`);
        const txt = $('body').text()
        return searchExtract(txt, req.query.q)
      }
    },
    unsafeNotEscaped: {
      isEdit: false,
      run: (v) => v,
    },
    peek: {
      isEdit: false,
      configFields: [
        {
          name: "number_lines",
          label: "Number of lines",
          type: "Integer",
        },
      ],
      run: (v, req, options) =>
        div(
          {
            style: `overflow: hidden;text-overflow: ellipsis;display: -webkit-box; -webkit-line-clamp: ${(options && options.number_lines) || 3
              }; -webkit-box-orient: vertical;`,
          },
          text(xss(v || ""))
        ),
    },
    editHTML: {
      isEdit: true,
      run: (nm, v, attrs, cls) =>
        textarea(
          {
            class: ["form-control", cls],
            name: text(nm),
            id: `input${text(nm)}`,
            rows: 10,
          },
          xss(v || "")
        ),
    },
  },
  read: (v) => {
    switch (typeof v) {
      case "string":
        return v;
      default:
        return undefined;
    }
  },
};

module.exports = { sc_plugin_api_version: 1, types: [html] };

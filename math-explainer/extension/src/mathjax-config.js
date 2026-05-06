window.MathJax = {
  loader: {
    load: ["[tex]/html"]
  },
  options: {
    ignoreHtmlClass: "no-mathjax"
  },
  tex: {
    inlineMath: [["$", "$"], ["\\(", "\\)"]],
    displayMath: [["$$", "$$"], ["\\[", "\\]"]],
    packages: { "[+]": ["html"] }
  },
  startup: {
    typeset: false
  }
};

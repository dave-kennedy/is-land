const fs = require("fs");
const path = require("path");
const { Module } = require("module");
const svelte = require('svelte/compiler');
const { ImportTransformer } = require("esm-import-transformer");

let id = 0;

class EleventySvelteComponent {
  constructor(filename, options = { ssr: true }) {
    this.filename = filename;
    this.parsed = path.parse(this.filename);
    this.content = fs.readFileSync(filename, "utf8");
    this.isSSR = options.ssr;

    this.clientImportMap = {
      imports: {
        // For this demo I’m using unpkg for the Svelte library
        "svelte/internal": "https://unpkg.com/svelte@3.48.0/internal/index.mjs"
      }
    };
  }

  getFilename() {
    return this.parsed.name + (this.isSSR ? "" : ".client") + ".js";
  }

  getImportUrl() {
    return "/" + path.join(this.parsed.dir, this.getFilename());
  }

  // pass in `hydratable: false, css: true` for a client only component
  generateClientBundle() {
    let options = {
      filename: this.filename,
      generate: "dom",
      hydratable: this.isSSR ? true : false,
      css: this.isSSR ? false : true,
    };

    let component = svelte.compile(this.content, options);

    // instead of the `sveltePath` option above, which tried to use the `cjs` not the `mjs`  version on unpkg
    let transformer = new ImportTransformer();
    let code = transformer.transform(component.js.code, this.clientImportMap)

    // TODO change _site to work with any output dir
    let outDir = path.join("./_site", this.parsed.dir);

    fs.mkdirSync(outDir, {recursive: true});
    fs.writeFileSync(path.join(outDir, this.getFilename()), code, "utf8");
  }

  renderOnServer(options = {}) {
    if(!this.isSSR || options.autoinit) {
      return {
        html: "",
        css: "",
      };
    }

    let component = svelte.compile(this.content, {
      filename: this.filename,
      generate: "ssr",
      format: "cjs",
    });

    // Careful this is Node specific stuff https://github.com/sveltejs/svelte/blob/dafbdc286eef3de2243088a9a826e6899e20465c/register.js
    let m = new Module();
    m.paths = module.paths;
    m._compile(component.js.code, this.filename);

    let fn = m.exports.default.render;
    let result = fn();
    return {
      html: result.html,
      css: result.css.code
    };
  }

  get(options = {
    autoinit: false
  }) {
    this.generateClientBundle(this.isSSR);

    let {html, css} = this.renderOnServer(options);

    return {
      html,
      css,
      clientJsUrl: this.getImportUrl()
    };
  }
}

module.exports = EleventySvelteComponent;
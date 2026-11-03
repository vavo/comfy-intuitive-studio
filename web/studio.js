import { app } from "../../scripts/app.js";

const style = document.createElement("link");
style.rel = "stylesheet";
style.href = new URL("./studio.css", import.meta.url).href;
document.head.append(style);

export function element(tag, text, attrs = {}) {
  const el = document.createElement(tag);
  if (text != null) el.textContent = text;
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
}

let helpSequence = 0;
function dismissFieldHelp(event) {
  const tip = document.querySelector(".studio-tooltip:popover-open");
  if (!tip) return;
  if (event.type === "keydown") {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
  } else if (tip.parentElement.contains(event.target)) return;
  tip.hidePopover();
}
document.addEventListener("pointerdown", dismissFieldHelp, true);
document.addEventListener("keydown", dismissFieldHelp, true);

export function fieldInfo(control, name, description) {
  const id = `studio-help-${++helpSequence}`;
  const wrap = element("span", null, {class:"studio-field-info"});
  const trigger = element("button", "ⓘ", {type:"button", class:"studio-info-trigger",
    "aria-label":`Help for ${name}`, "aria-describedby":id});
  const tip = element("span", description, {id, role:"tooltip", popover:"manual", class:"studio-tooltip"});
  control.setAttribute("aria-describedby", [control.getAttribute("aria-describedby"),id].filter(Boolean).join(" "));
  function show() {
    if (tip.matches(":popover-open")) return;
    document.querySelector(".studio-tooltip:popover-open")?.hidePopover();
    tip.showPopover();
    const anchor = trigger.getBoundingClientRect();
    const box = tip.getBoundingClientRect();
    tip.style.left = `${Math.max(6, Math.min(anchor.left, window.innerWidth - box.width - 6))}px`;
    tip.style.top = `${anchor.bottom + box.height <= window.innerHeight - 6
      ? anchor.bottom : Math.max(6, anchor.top - box.height)}px`;
  }
  trigger.onpointerenter = event => { if (event.pointerType !== "touch") show(); };
  trigger.onfocus = show;
  trigger.onclick = show;
  trigger.onblur = () => tip.hidePopover();
  wrap.onpointerleave = () => { if (document.activeElement !== trigger) tip.hidePopover(); };
  wrap.append(trigger, tip);
  return wrap;
}

export function fieldHeading(control, name, description) {
  const heading = element("div", null, {class:"studio-field-heading"});
  if (control.matches("input,select,textarea")) {
    control.id ||= `studio-control-${++helpSequence}`;
    heading.append(element("label", name, {for:control.id}));
  } else {
    control.setAttribute("role","group");
    control.setAttribute("aria-label",name);
    heading.append(element("span",name));
  }
  heading.append(fieldInfo(control, name.replace(/ \*$/, ""), description));
  return heading;
}

export function graphic(look) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 150 85");
  svg.setAttribute("aria-hidden", "true");
  const shapes = [["rect", {x: 0, y: 0, width: 150, height: 85, rx: 10, fill: "#22282a"}],
    ["circle", {cx: look === "sunset" ? 95 : 75, cy: 38, r: 26, fill: {studio: "#c3dfc3", sunset: "#f6b385", night: "#a5a7df"}[look]}],
    ["path", {d: "M0 76 L47 36 L81 68 L112 46 L150 80 V85 H0Z", fill: "#111719"}]];
  for (const [tag, attrs] of shapes) {
    const child = document.createElementNS(svg.namespaceURI, tag);
    for (const [name, value] of Object.entries(attrs)) child.setAttribute(name, value);
    svg.append(child);
  }
  return svg;
}

app.registerExtension({
  name: "IntuitiveStudio.Probe",
  beforeRegisterNodeDef(nodeType, data) {
    if (data.name !== "StudioProbe") return;
    const created = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      created?.apply(this, arguments);
      const node = this;
      const stateWidget = node.widgets.find(w => w.name === "request_json");
      const root = element("section", null, {class: "intuitive-studio", "aria-label": "Intuitive Studio capability probe"});
      const badge = element("p", "APP MODE LAB · NO-COST TEST", {class: "studio-eyebrow"});
      const heading = element("h2", "Make it yours.");
      const caption = element("p", "Custom graphics and controls, inside native ComfyUI App Mode.");
      const input = element("input", null, {"aria-label": "Test title", maxlength: "38"});
      const cards = element("div", null, {class: "studio-cards"});
      const help = element("p", "Choose a look, then use ComfyUI’s Run button. The resulting image proves the real queue executed.", {class: "studio-hint"});
      root.append(badge, heading, caption,
        fieldHeading(input, "Test title", "Enter up to 38 characters for the title printed on the local test image."), input,
        fieldHeading(cards, "Test look", "Choose the color palette for the local test image."), cards, help);
      function state() { try { return JSON.parse(stateWidget.value); } catch { return {}; } }
      function update(patch) {
        stateWidget.value = JSON.stringify({...state(), ...patch});
        stateWidget.callback?.(stateWidget.value);
        app.graph.change();
        render();
      }
      function render() {
        input.value = state().title || "App Mode capability proof";
        for (const button of cards.children) button.setAttribute("aria-pressed", String(button.dataset.look === (state().look || "studio")));
      }
      input.oninput = () => update({title: input.value});
      for (const look of ["studio", "sunset", "night"]) {
        const button = element("button", null, {type: "button", "aria-label": `Choose ${look} look`});
        button.dataset.look = look;
        button.append(graphic(look), element("span", look[0].toUpperCase() + look.slice(1)));
        button.onclick = () => update({look});
        cards.append(button);
      }
      const widget = node.addDOMWidget("studio_panel", "studio_panel", root, {serialize: false, hideOnZoom: false});
      widget.label = "Capability test";
      widget.computeSize = () => [360, 365];
      const configure = node.onConfigure;
      node.onConfigure = function () { configure?.apply(this, arguments); render(); };
      node.setSize([420, 600]);
      render();
    };
  }
});

import { element } from "./studio.js";

const sources = new WeakMap();
let mounted;
let owner;
let selection;
let observer;
const descriptions = {
  "text-to-image":"Prompt → image", "image-to-image":"Image → image",
  "text-to-video":"Prompt → video", "image-to-video":"Image → video",
  "first-last-frame-to-video":"Two frames → video", "reference-to-video":"References → video",
  "video-to-video":"Video → video", "audio-to-video":"Audio → video",
  "talking-portrait":"Portrait + voice → video", "motion-transfer":"Reference motion → video"
};
const paths = {
  "text-to-image":"M4 6h12v14H4z M6 16l3-4 3 3 2-2 M18 3v6 M15 6h6",
  "image-to-image":"M4 4h10v16H4z M6 16l3-4 3 3 M14 12l6-6 2 2-6 6-3 1z",
  "text-to-video":"M3 6h13v12H3z M16 10l5-3v10l-5-3 M7 9l5 3-5 3z",
  "image-to-video":"M3 4h12v16H3z M5 15l3-4 3 3 M18 8l4 4-4 4z",
  "first-last-frame-to-video":"M2 5h6v14H2z M16 5h6v14h-6z M10 12h4 M12 10l2 2-2 2",
  "reference-to-video":"M3 3h10v6H3z M3 12h10v9H3z M17 8l5 4-5 4z",
  "video-to-video":"M3 7h8v10H3z M15 7h6v10h-6z M8 3h9l-2-2 M16 21H7l2 2",
  "audio-to-video":"M2 10v4 M5 7v10 M8 4v16 M12 7h10v10H12z M15 10l4 2-4 2z",
  "talking-portrait":"M4 20v-3c0-5 10-5 10 0v3 M5 7a4 4 0 1 0 8 0 4 4 0 1 0-8 0 M18 8v8 M21 5v14",
  "motion-transfer":"M4 4h16v16H4z M7 10c4-6 10-3 10 2 M14 10l3 2 2-3 M7 16h5"
};
function icon(mode) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [name,value] of Object.entries({viewBox:"0 0 24 24",fill:"none",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round","stroke-linejoin":"round","aria-hidden":"true"})) svg.setAttribute(name,value);
  const path = document.createElementNS(svg.namespaceURI,"path");
  path.setAttribute("d",paths[mode]);svg.append(path);return svg;
}
function clear() {
  mounted?.remove();mounted = null;owner = null;selection = null;
  document.querySelectorAll(".studio-welcome-replaced").forEach(el=>el.classList.remove("studio-welcome-replaced"));
}
function sync() {
  const welcome = document.querySelector('#linearCenterPanel [data-testid="linear-welcome"]');
  const root = document.querySelector('#linear-right-panel .intuitive-studio[aria-label="Intuitive Studio"]');
  const source = root && sources.get(root);
  const data = source?.();
  if (!welcome || !data) {clear();return;}
  if (owner === root && selection === data.mode && mounted?.isConnected) return;
  clear();owner = root;selection = data.mode;
  const panel = element("section",null,{class:"studio-launcher","aria-label":"Choose a workflow"});
  panel.append(element("p","INTUITIVE STUDIO",{class:"studio-launcher-eyebrow"}),element("h1","What will you make?"));
  const grid = element("div",null,{class:"studio-launcher-grid"});
  const more = element("details",null,{class:"studio-launcher-more"});
  const unavailable = element("div",null,{class:"studio-launcher-grid"});
  let count = 0;
  for (const mode of data.catalog.workflows) {
    const available = data.catalog.models.some(model=>model.workflows.includes(mode));
    const button = element("button",null,{type:"button","aria-label":data.labels[mode],"aria-pressed":String(mode===data.mode)});
    button.append(icon(mode),element("strong",data.labels[mode]),element("span",descriptions[mode]));
    if (available) {
      button.onclick = async () => {
        for (const item of grid.querySelectorAll("button")) item.disabled = true;
        try {await data.switchWorkflow(mode);} finally {
          for (const item of grid.querySelectorAll("button")) item.disabled = false;
        }
      };
      grid.append(button);
    } else {button.disabled = true;unavailable.append(button);count++;}
  }
  panel.append(grid);
  if (count) {
    more.append(element("summary",`More workflows · ${count} awaiting endpoints`),unavailable);
    panel.append(more);
  }
  welcome.classList.add("studio-welcome-replaced");
  welcome.after(panel);mounted = panel;
}
export function registerLauncher(root, source) {
  sources.set(root,source);
  if (!observer) {
    let scheduled = false;
    observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {scheduled = false;sync();});
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }
  sync();
  return () => {sources.delete(root);if (owner === root) clear();};
}

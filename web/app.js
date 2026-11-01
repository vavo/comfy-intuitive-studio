import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { element } from "./studio.js";
import { sizeControls } from "./size-controls.js";
import { connectionPanel } from "./connection.js";

const labels = {
  "text-to-image": "Create an image", "image-to-image": "Edit an image",
  "text-to-video": "Create a video", "image-to-video": "Animate an image",
  "first-last-frame-to-video": "Connect two frames", "reference-to-video": "Video from references",
  "video-to-video": "Edit a video", "audio-to-video": "Video from audio",
  "talking-portrait": "Talking portrait", "motion-transfer": "Transfer motion"
};
const catalogPromise = api.fetchApi("/intuitive-studio/catalog").then(async r => {
  if (!r.ok) throw new Error("Studio catalog unavailable. Restart ComfyUI after installing the extension.");
  return r.json();
});

const previewCache = new Map();
function rememberPreview(reference, url) {
  if (previewCache.has(reference)) URL.revokeObjectURL(previewCache.get(reference));
  previewCache.set(reference, url);
  if (previewCache.size > 24) {
    const oldest = previewCache.keys().next().value;
    URL.revokeObjectURL(previewCache.get(oldest));
    previewCache.delete(oldest);
  }
}
async function assetPreview(reference, kind, target) {
  if (!reference) return;
  const media = element(kind === "image" ? "img" : kind, null, {class:"studio-reference", "aria-label":"Reference preview"});
  if (kind === "image") media.alt = "Starting asset";
  else { media.controls = true; media.preload = "metadata"; }
  const message = element("span", "Loading preview…", {class:"studio-hint"});
  target.append(message);
  try {
    let url = previewCache.get(reference);
    if (!url && reference.startsWith("asset:")) {
      const response = await api.fetchApi("/intuitive-studio/preview", {method:"POST", headers:{"Content-Type":"application/json","X-Intuitive-Studio":"1"}, body:JSON.stringify({reference,kind})});
      if (!response.ok) throw new Error();
      url = URL.createObjectURL(await response.blob());
      rememberPreview(reference, url);
    }
    if (!url) {
      const parsed = new URL(reference);
      if (parsed.protocol !== "https:") throw new Error();
      url = parsed.href;
    }
    media.referrerPolicy = "no-referrer";
    media.onerror = () => {media.replaceWith(element("span", "Preview unavailable. Reference retained.", {class:"studio-hint"}));};
    media.src = url;
    message.replaceWith(media);
  } catch { message.textContent = "Preview unavailable. Reference retained."; }
}
function sizeLabel(value) {
  const pair = String(value).split("*").map(Number);
  if (pair.length !== 2 || pair.some(n => !Number.isFinite(n))) return ({"480p":"Low · 480p","720p":"High · 720p"})[value] || value;
  const [width,height] = pair;
  return `${width === height ? "Square" : width > height ? "Wide" : "Portrait"} · ${width} × ${height}`;
}

async function post(path, body, contentType = "application/json") {
  const response = await api.fetchApi(`/intuitive-studio/${path}`, {method:"POST", headers:{"Content-Type":contentType,"X-Intuitive-Studio":"1"}, body});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Studio request failed.");
  return result;
}

app.registerExtension({
  name: "IntuitiveStudio.App",
  setup() {
    api.addEventListener("execution_error", ({detail}) => {
      app.graph.getNodeById(detail.node_id)?.studioError?.(detail.exception_message);
    });
  },
  beforeRegisterNodeDef(nodeType, data) {
    if (!["StudioImage", "StudioVideo"].includes(data.name)) return;
    const created = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      created?.apply(this, arguments);
      const node = this;
      const raw = node.widgets.find(w => w.name === "request_json");
      const root = element("section", null, {class:"intuitive-studio", "aria-label":"Intuitive Studio"});
      const connection = connectionPanel(() => {
        for (const url of previewCache.values()) URL.revokeObjectURL(url);
        previewCache.clear();
        status.textContent = "Forma connection changed. Check the price before running.";
      });
      let catalog, revision = 0, switching = false;
      let previewMotion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const previewObserver = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (entry.isIntersecting && previewMotion) entry.target.play().catch(() => {});
          else entry.target.pause();
        }
      });
      const removed = node.onRemoved;
      node.onRemoved = function () {
        for (const video of root.querySelectorAll(".studio-cards video")) video.pause();
        connection.dispose();previewObserver.disconnect();removed?.apply(this, arguments);
      };
      const status = element("p", "Loading the verified model catalog…", {class:"studio-status", role:"status", "aria-live":"polite"});
      node.studioError = message => {status.textContent=String(message || "Generation failed. Check the native error details.");};
      function state() { try { return JSON.parse(raw.value); } catch { return {}; } }
      function update(patch) {
        raw.value = JSON.stringify({...state(), ...patch});
        raw.callback?.(raw.value);
        revision++;
        status.textContent = "Settings changed. Check the price before running.";
        app.graph.change();
      }
      function setField(name, value) { update({values:{...state().values,[name]:value}}); }
      function model() { return catalog.models.find(m => m.id === state().model); }
      function fields(m) {
        return m.fields.filter(f => !["loras","enable_prompt_optimization","enable_prompt_expansion","prompt_upsampling"].includes(f.name));
      }
      async function switchWorkflow(mode, reference) {
        if (switching || mode === state().workflow && !reference) return;
        switching = true;
        try {
          const active = app.extensionManager.workflow.activeWorkflow;
          if (!active) throw new Error("Open a Studio workflow first.");
          const snapshot = JSON.parse(JSON.stringify(app.graph.serialize()));
          const stages = snapshot.extra.studio_stages || {};
          delete snapshot.extra.studio_stages;
          snapshot.extra.studio_outputs = JSON.parse(JSON.stringify(app.nodeOutputs));
          stages[state().workflow] = snapshot;
          const response = await api.fetchApi(`/intuitive-studio/workflow/${mode}`);
          if (!response.ok) throw new Error("Workflow template is unavailable.");
          const template = await response.json();
          const graph = JSON.parse(JSON.stringify(stages[mode] || template));
          if (reference) {
            const next = JSON.parse(graph.nodes[0].widgets_values[0]);
            const selected = catalog.models.find(m => m.id === next.model);
            const imageField = selected?.fields.find(f => f.media === "image");
            if (imageField) next.values[imageField.name] = reference;
            graph.nodes[0].widgets_values[0] = JSON.stringify(next);
          }
          graph.id = snapshot.id;
          graph.extra.studio_stages = stages;
          const outputs = graph.extra.studio_outputs || {};
          await app.loadGraphData(graph, true, true, active);
          app.nodeOutputs = outputs;
          app.graph.change();
        } catch (error) { status.textContent = error.message; }
        finally { switching = false; }
      }
      function makeField(field, parent) {
        const value = state().values?.[field.name] ?? field.default ?? "";
        if (field.name === "size" && field.choices?.every(v => /^\d+\*\d+$/.test(v))) {
          parent.append(sizeControls(field.choices, String(value), size => setField(field.name,size)));
          return;
        }
        const label = element("label", field.label + (field.required ? " *" : ""));
        let input;
        let durationValue;
        if (field.name === "duration") {
          const options = field.choices || Array.from({length:Math.floor((field.max-field.min)/(field.step || 1))+1}, (_,i)=>field.min+i*(field.step || 1));
          input = element("input", null, {type:"range",min:"0",max:String(options.length-1),step:"1","aria-label":field.label});
          input.value = String(Math.max(0, options.indexOf(Number(value))));
          const output = element("output", `${options[Number(input.value)]} seconds`);
          durationValue = () => options[Number(input.value)];
          input.setAttribute("aria-valuetext", output.textContent);
          input.addEventListener("input", () => {output.textContent=`${durationValue()} seconds`;input.setAttribute("aria-valuetext",output.textContent);});
          label.append(output);
          const ticks = element("div", null, {class:"studio-duration-ticks", "aria-hidden":"true"});
          for (const seconds of options) ticks.append(element("span", `${seconds}s`));
          label.append(ticks);
        } else if (field.choices) {
          input = element("select", null, {"aria-label":field.label});
          for (const option of field.choices) input.append(element("option", field.name === "size" ? sizeLabel(option) : String(option), {value:String(option)}));
          input.value = String(value);
        } else if (field.type === "boolean") {
          input = element("select", null, {"aria-label":field.label});
          input.append(element("option","Off",{value:"false"}),element("option","On",{value:"true"}));
          input.value = String(value || false);
        } else {
          const multiline = field.name === "prompt" || field.media && field.type === "array";
          input = element(multiline ? "textarea" : "input", null, {"aria-label":field.label});
          if (!multiline) input.type = ["integer","number","float"].includes(field.type) ? "number" : "text";
          if (field.min != null) input.min = String(field.min);
          if (field.max != null) input.max = String(field.max);
          input.step = String(field.step ?? (field.type === "integer" ? 1 : "any"));
          input.value = String(value);
        }
        input.title = field.description || "";
        input.oninput = () => {
          let value = durationValue ? durationValue() : input.value;
          if (field.type === "boolean") value = value === "true";
          else if (["integer","number","float"].includes(field.type) && value !== "") value = Number(value);
          setField(field.name, value);
        };
        label.append(input);
        parent.append(label);
        if (field.media) {
          const previews = element("div", null, {class:"studio-references"});
          const showPreviews = () => {
            previews.replaceChildren();
            for (const ref of String(state().values?.[field.name] || "").split(/\n/).filter(Boolean)) assetPreview(ref.trim(), field.media, previews);
          };
          input.addEventListener("change", showPreviews);
          parent.append(previews);
          showPreviews();
          const file = element("input", null, {type:"file",accept:field.media+"/*", "aria-label":`Upload ${field.label}`});
          file.onchange = async () => {
            const selected = file.files?.[0];
            if (!selected) return;
            if (selected.size > 32*1024*1024) { status.textContent="Upload limit is 32 MB."; return; }
            const before = revision;
            file.disabled = true;
            status.textContent = "Uploading to your Forma library…";
            try {
              const result = await post("upload", selected, selected.type);
              if (revision !== before) { status.textContent="Upload completed; settings changed. Reference: "+result.reference; return; }
              const prior = field.type === "array" ? String(state().values?.[field.name] || "").trim() : "";
              input.value = [prior,result.reference].filter(Boolean).join("\n");
              setField(field.name,input.value);
              rememberPreview(result.reference, URL.createObjectURL(selected));
              showPreviews();
              status.textContent="Reference saved in your Forma library. No inference purchased.";
            } catch(error) { status.textContent=error.message; }
            finally { file.disabled=false; }
          };
          parent.append(file);
        }
      }
      function render() {
        if (!catalog) return;
        for (const video of root.querySelectorAll(".studio-cards video")) {video.pause();previewObserver.unobserve(video);}
        root.replaceChildren();
        root.append(element("p","INTUITIVE STUDIO · OPEN WEIGHTS",{class:"studio-eyebrow"}),
          element("h2",labels[state().workflow] || "Make something."),
          element("p","Your idea. Your model. One Forma balance.",{class:"studio-hint"}));
        root.append(connection.element);
        const modes = element("select",null,{"aria-label":"Workflow"});
        for (const mode of catalog.workflows) {
          const count = catalog.models.filter(m => m.workflows.includes(mode)).length;
          modes.append(element("option", `${labels[mode]}${count ? ` · ${count} models` : " · awaiting endpoint"}`, {value:mode}));
        }
        modes.value=state().workflow;
        modes.onchange=()=>switchWorkflow(modes.value);
        const modeLabel=element("label","What would you like to do?"); modeLabel.append(modes); root.append(modeLabel);
        const compatible=catalog.models.filter(m=>m.workflows.includes(state().workflow));
        if (!compatible.length) {
          root.append(element("p","This workflow is preserved. No verified open-weight Runpod endpoint is currently configured through Forma. Running is blocked on the server.",{class:"studio-status"}));
          return;
        }
        const select=element("select",null,{"aria-label":"Model"});
        for (const m of compatible) select.append(element("option",m.name,{value:m.id}));
        select.value=state().model;
        select.onchange=()=>{update({model:select.value,values:{prompt:state().values?.prompt || ""}});render();};
        const modelLabel=element("label","Model"); modelLabel.append(select); root.append(modelLabel);
        const m=model();
        if (!m) { root.append(element("p","Select a model to configure this workflow.")); return; }
        const cards=element("div",null,{class:"studio-cards"});
        const presets=m.kind==="image" ? [["studio","Studio light","Soft studio lighting, clean composition."],["sunset","Warm light","Warm golden-hour lighting."],["night","Night light","Cool cinematic night lighting."]] : [["studio","Gentle push","Slow gentle camera push-in."],["sunset","Slow orbit","Slow smooth camera orbit around the subject."],["night","Locked shot","Static camera, subtle natural movement."]];
        for (const [look,title,suffix] of presets) {
          const button=element("button",null,{type:"button","aria-pressed":String(state().look===look),"aria-label":title});
          const photo = m.kind === "image" ? look : {studio:"push",sunset:"orbit",night:"locked"}[look];
          if (m.kind === "video" && photo !== "locked") {
            const video = element("video", null, {src:new URL(`./assets/${photo}.mp4`,import.meta.url).href,
              poster:new URL("./assets/studio.png",import.meta.url).href,preload:"metadata","aria-hidden":"true"});
            video.muted = true; video.loop = true; video.playsInline = true;
            button.append(video);
            previewObserver.observe(video);
          } else button.append(element("img", null, {src:new URL(`./assets/${m.kind === "video" ? "studio" : photo}.png`,import.meta.url).href,alt:"",loading:"lazy"}));
          button.append(element("span",title));
          button.onclick=()=>{update({look,values:{...state().values,prompt:((state().values?.prompt||"").replace(/\n\[Studio recipe\][\s\S]*$/,"")+"\n[Studio recipe] "+suffix).trim()}});render();};
          cards.append(button);
        }
        root.append(cards);
        if (m.kind === "video") {
          const playback = element("button", previewMotion ? "Pause previews" : "Play previews", {type:"button",class:"studio-preview-toggle"});
          playback.onclick = () => {
            previewMotion = !previewMotion;
            playback.textContent = previewMotion ? "Pause previews" : "Play previews";
            for (const video of cards.querySelectorAll("video")) {
              if (previewMotion) video.play().catch(() => {});
              else video.pause();
            }
          };
          root.append(playback);
        }
        const advanced=element("details"); advanced.append(element("summary","Advanced model settings"));
        const modelFields = fields(m);
        if (modelFields.some(f => f.name === "width") && modelFields.some(f => f.name === "height")) {
          const width = modelFields.find(f => f.name === "width"), height = modelFields.find(f => f.name === "height");
          const presets = [[768,768],[1024,1024],[768,1024],[1152,1536],[1024,768],[1536,1152]].filter(([w,h]) => w >= width.min && w <= width.max && h >= height.min && h <= height.max);
          const current = [state().values?.width ?? width.default,state().values?.height ?? height.default];
          if (!presets.some(([w,h]) => w === current[0] && h === current[1])) presets.unshift(current);
          root.append(sizeControls(presets.map(pair=>pair.join("*")),current.join("*"), value => {
            const [width,height]=value.split("*").map(Number);
            update({values:{...state().values,width,height}});
          }));
        }
        for (const field of modelFields.filter(f => !["width","height"].includes(f.name))) {
          const primary=field.name==="prompt" || field.media || ["size","duration","width","height"].includes(field.name);
          makeField(field,primary ? root : advanced);
        }
        root.append(advanced);
        const capLabel=element("label","Maximum spend for this run (USD cents)");
        const cap=element("input",null,{type:"number",min:"0",max:"300",step:"1","aria-label":"Maximum spend in cents"});
        cap.value=state().cap ?? 0; cap.oninput=()=>update({cap:Number(cap.value)}); capLabel.append(cap); root.append(capLabel);
        root.append(element("p",`Take ${state().run || 1}. Unchanged requests recover the same generation.`,{class:"studio-hint"}));
        const actions=element("div",null,{class:"studio-actions"});
        const price=element("button","Check price",{type:"button"});
        price.onclick=async()=>{
          const before=revision; price.disabled=true; status.textContent="Checking Forma price…";
          try {
            const quote=await post("quote",raw.value);
            status.textContent=revision!==before ? "Settings changed. Check the price again." : `Quote: $${(quote.cents/100).toFixed(2)}. Limit: $${(state().cap/100).toFixed(2)}. ${quote.cents>state().cap ? "Raise the limit to run." : "Use ComfyUI’s Run button when ready."}`;
          } catch(error) {status.textContent=error.message;}
          finally {price.disabled=false;}
        };
        const next=element("button","New take",{type:"button"});
        next.onclick=()=>{update({run:(state().run||1)+1});render();status.textContent="New take selected. Running will purchase a new generation.";};
        actions.append(price,next);root.append(actions,status);

        const results=node.properties.studio_results || [];
        const latest=results.at(-1);
        if (latest) {
          const resultActions=element("div",null,{class:"studio-actions"});
          if (latest.kind==="image") for (const [mode,title] of [["image-to-image","Edit this result"],["image-to-video","Animate this result"]]) {
            const button=element("button",title,{type:"button"});button.onclick=()=>switchWorkflow(mode,latest.reference);resultActions.append(button);
          }
          root.append(element("p",`${results.length} completed result(s) in this workflow. Output files are saved by ComfyUI.`,{class:"studio-hint"}),resultActions);
        }
      }
      root.append(status);
      const widget=node.addDOMWidget("studio_panel","studio_panel",root,{serialize:false,hideOnZoom:false});
      widget.label="Studio";
      widget.computeSize=()=>[360,Math.max(400,root.scrollHeight)];
      const configure=node.onConfigure;
      node.onConfigure=function(){configure?.apply(this,arguments);render();};
      const executed=node.onExecuted;
      node.onExecuted=function(message){
        executed?.apply(this,arguments);
        const result=message.studio_result?.[0];
        if(result){
          const list=node.properties.studio_results ||= [];
          if(!list.some(r=>r.reference===result.reference))list.push(result);
          if(list.length>24)list.shift();
          app.graph.change();
          render();status.textContent="Completed through Forma. Continue with this result below.";
        }
      };
      catalogPromise.then(data=>{catalog=data;status.textContent="Ready. Check the price, then use ComfyUI’s Run button.";render();}).catch(error=>{status.textContent=error.message;});
      node.setSize([420,800]);
    };
  }
});

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { element, graphic } from "./studio.js";

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

async function post(path, body, contentType = "application/json") {
  const response = await api.fetchApi(`/intuitive-studio/${path}`, {method:"POST", headers:{"Content-Type":contentType,"X-Intuitive-Studio":"1"}, body});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Studio request failed.");
  return result;
}

app.registerExtension({
  name: "IntuitiveStudio.App",
  beforeRegisterNodeDef(nodeType, data) {
    if (!["StudioImage", "StudioVideo"].includes(data.name)) return;
    const created = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      created?.apply(this, arguments);
      const node = this;
      const raw = node.widgets.find(w => w.name === "request_json");
      const root = element("section", null, {class:"intuitive-studio", "aria-label":"Intuitive Studio"});
      let catalog, revision = 0;
      const status = element("p", "Loading the verified model catalog…", {class:"studio-status", role:"status", "aria-live":"polite"});
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
        try {
          const response = await api.fetchApi(`/intuitive-studio/workflow/${mode}`);
          if (!response.ok) throw new Error("Workflow template is unavailable.");
          const graph = await response.json();
          if (reference) {
            const next = JSON.parse(graph.nodes[0].widgets_values[0]);
            const selected = catalog.models.find(m => m.id === next.model);
            const imageField = selected?.fields.find(f => f.media === "image");
            if (imageField) next.values[imageField.name] = reference;
            graph.nodes[0].widgets_values[0] = JSON.stringify(next);
          }
          // Native workflow loading retains ComfyUI's graph, queue and App Mode.
          await app.loadGraphData(graph, true, true, `${mode}.app.json`);
        } catch (error) { status.textContent = error.message; }
      }
      function makeField(field, parent) {
        const value = state().values?.[field.name] ?? field.default ?? "";
        const label = element("label", field.label + (field.required ? " *" : ""));
        let input;
        if (field.choices) {
          input = element("select", null, {"aria-label":field.label});
          for (const option of field.choices) input.append(element("option", String(option), {value:String(option)}));
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
          let value = input.value;
          if (field.type === "boolean") value = value === "true";
          else if (["integer","number","float"].includes(field.type) && value !== "") value = Number(value);
          setField(field.name, value);
        };
        label.append(input);
        parent.append(label);
        if (field.media) {
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
              status.textContent="Reference saved in your Forma library. No inference purchased.";
            } catch(error) { status.textContent=error.message; }
            finally { file.disabled=false; }
          };
          parent.append(file);
        }
      }
      function render() {
        if (!catalog) return;
        root.replaceChildren();
        root.append(element("p","INTUITIVE STUDIO · OPEN WEIGHTS",{class:"studio-eyebrow"}),
          element("h2",labels[state().workflow] || "Make something."),
          element("p","Your idea. Your model. One Forma balance.",{class:"studio-hint"}));
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
          button.append(graphic(look),element("span",title));
          button.onclick=()=>{update({look,values:{...state().values,prompt:((state().values?.prompt||"").replace(/\n\[Studio recipe\][\s\S]*$/,"")+"\n[Studio recipe] "+suffix).trim()}});render();};
          cards.append(button);
        }
        root.append(cards);
        const advanced=element("details"); advanced.append(element("summary","Advanced model settings"));
        for (const field of fields(m)) {
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
        if (!catalog.keyConfigured) status.textContent="Set FORMA_API_KEY_FILE on the ComfyUI server. Keys never belong in workflows.";
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

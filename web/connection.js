import { api } from "../../scripts/api.js";
import { element, fieldHeading } from "./studio.js";

let current;
let pending;
const listeners = new Set();
async function request(body) {
  const response = await api.fetchApi("/intuitive-studio/connection", {
    method:"POST", headers:{"Content-Type":"application/json", "X-Intuitive-Studio":"1"},
    body:JSON.stringify(body)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not connect to Forma.");
  return result;
}
function publish(value, changed = false) {
  current = value;
  for (const listener of listeners) listener(value, changed);
}
function check() {
  if (!pending) {
    publish({checking:true});
    pending = request({}).then(publish).catch(error => publish({error:error.message}))
      .finally(() => {pending = null;});
  }
  return pending;
}

export function connectionPanel(onChange) {
  const panel = element("details", null, {class:"studio-connection"});
  const summary = element("summary", "Connect Forma · Checking…");
  const status = element("p", "Checking connection…", {class:"studio-hint", role:"status", "aria-live":"polite"});
  const input = element("input", null, {type:"password", "aria-label":"Forma API key", autocomplete:"off", placeholder:"forma_…", spellcheck:"false"});
  input.maxLength = 70;
  const save = element("button", "Save and connect", {type:"button"});
  save.disabled = true;
  const retry = element("button", "Check connection", {type:"button"});
  const actions = element("div", null, {class:"studio-actions"});
  const hint = element("p", "Saved on this ComfyUI server, shared by its workflows. Never included in workflow exports.", {class:"studio-hint"});
  actions.append(save,retry);panel.append(summary,status,fieldHeading(input, "Forma API key", "Paste a key from Forma Account settings to use that account’s balance. Save and connect verifies it before replacing the current key."),input,actions,hint);
  let busy = false;
  function update(value, changed) {
    summary.textContent = `Connect Forma · ${value.checking ? "Checking…" : value.connected ? "Connected" : value.error ? "Connection failed" : "Not connected"}`;
    status.textContent = value.checking ? "Checking connection…" : value.connected
      ? value.source === "server" ? "Connected using the server key. Save a key here to replace it for this Studio." : "Connected using your saved key. Enter another key to change accounts."
      : value.error || "Enter a key from Forma Account settings.";
    retry.disabled = busy || !!value.checking;
    if (!value.connected && !value.checking) panel.open = true;
    if (changed) onChange();
  }
  input.oninput = () => {save.disabled = busy || !input.value.trim();};
  retry.onclick = check;
  save.onclick = async () => {
    busy = true;save.disabled = true;retry.disabled = true;input.disabled = true;
    const body = {key:input.value.trim()};
    input.value = "";
    status.textContent = "Verifying key…";
    try {
      // Finish any old-key check before publishing the replacement's status.
      await pending;
      publish(await request(body), true);
    } catch (error) {
      status.textContent = `${error.message} Previous connection kept.`;
    } finally {
      delete body.key;
      busy = false;input.disabled = false;retry.disabled = false;
    }
  };
  listeners.add(update);
  if (current) update(current);
  else check();
  return {element:panel, dispose() {input.value = "";listeners.delete(update);}};
}

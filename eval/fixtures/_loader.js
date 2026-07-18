// Applies mutations passed via query params. `css` is injected synchronously
// (before first paint); `remove`/`text` run at DOMContentLoaded, which still
// precedes the `load` event kiyas screenshots after.
const q = new URLSearchParams(location.search);
if (q.get("css")) {
  document.write("<style>" + q.get("css") + "</style>");
}
addEventListener("DOMContentLoaded", () => {
  if (q.get("remove")) {
    document.querySelectorAll(q.get("remove")).forEach((el) => el.remove());
  }
  if (q.get("text")) {
    const [selector, value] = JSON.parse(q.get("text"));
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  }
});

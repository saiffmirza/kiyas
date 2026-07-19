import { test } from "node:test";
import assert from "node:assert";
import { generateHtmlReport } from "../packages/core/src/report/html.js";

// The desktop app renders reports in an iframe, so every model- and
// user-derived field flowing into html.ts must stay escaped. This guards the
// invariant: an unescaped interpolation should fail the build, not a review.

const SCRIPT_PAYLOAD = "<script>alert('kiyas-xss')</script>";
const ATTR_PAYLOAD = '" onmouseover="alert(1)';

test("report escapes model- and user-derived fields", async () => {
  const html = await generateHtmlReport({
    name: `Header ${SCRIPT_PAYLOAD}`,
    designSource: `https://www.figma.com/design/x${ATTR_PAYLOAD}`,
    targetUrl: `http://localhost:3000/${SCRIPT_PAYLOAD}`,
    model: SCRIPT_PAYLOAD,
    threshold: "all",
    discrepancies: [
      {
        element: SCRIPT_PAYLOAD,
        property: ATTR_PAYLOAD,
        expected: SCRIPT_PAYLOAD,
        actual: `#fff ${ATTR_PAYLOAD}`,
        severity: "HIGH",
      },
    ],
  });

  assert.ok(
    !html.includes(SCRIPT_PAYLOAD),
    "raw <script> payload leaked into the report"
  );
  assert.ok(
    !html.includes(ATTR_PAYLOAD),
    "raw quote payload leaked into an attribute context"
  );
  assert.ok(html.includes("&lt;script&gt;alert("));
  assert.ok(html.includes("&quot; onmouseover=&quot;alert(1)"));
});
